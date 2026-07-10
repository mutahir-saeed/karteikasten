import Papa from 'papaparse'
import { startOfDay } from './leitner.js'

// Case-insensitive column aliases -> canonical field.
const COLUMN_ALIASES = {
  german: 'german',
  deutsch: 'german',
  english: 'english',
  englisch: 'english',
  urdu: 'urdu',
  اردو: 'urdu',
  topic: 'topic',
  thema: 'topic',
  category: 'topic',
  kategorie: 'topic',
  type: 'type',
  typ: 'type',
  // The base verb a sentence belongs to. Groups a verb's sentences together so
  // the Sätze pacer can release them as one "new verb" per day.
  lemma: 'lemma',
  grundform: 'lemma',
  verb: 'lemma',
}

function normalizeHeader(h) {
  return String(h || '')
    .replace(/^﻿/, '') // strip BOM
    .trim()
    .toLowerCase()
}

// Build a map from a parsed row (using original headers) to canonical fields.
function mapRow(row) {
  const out = { german: '', english: '', urdu: '', topic: '', type: '', lemma: '' }
  for (const key of Object.keys(row)) {
    const canonical = COLUMN_ALIASES[normalizeHeader(key)]
    if (canonical && !out[canonical]) {
      out[canonical] = String(row[key] ?? '').trim()
    }
  }
  return out
}

let uid = 0
function newId() {
  return `${Date.now().toString(36)}-${(uid++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// Convert a mapped row into a fresh Box-1 card. Returns null for empty rows.
// opts: { level, deck } — deck is 'vocab' (words) or 'saetze' (verb sentences).
export function rowToCard(mapped, opts = {}) {
  const { level = '', deck = 'vocab' } = typeof opts === 'string' ? { level: opts } : opts
  const german = mapped.german
  const english = mapped.english
  const urdu = mapped.urdu
  if (!german && !english && !urdu) return null

  const now = new Date()
  // Sätze cards are sentences by default; otherwise honor the CSV's type column.
  const type =
    deck === 'saetze' || /satz|sentence|phrase/i.test(mapped.type) ? 'sentence' : 'word'
  return {
    id: newId(),
    german,
    english,
    urdu,
    topic: mapped.topic || 'Uncategorized',
    level,
    type,
    deck,
    // The verb this card trains (for the daily pacer). Falls back to the German
    // text so plain word cards remain self-grouped.
    lemma: (mapped.lemma || german || '').toLowerCase().trim(),
    box: 1,
    dueDate: startOfDay(now).toISOString(), // due immediately (gating handled by pacer)
    createdAt: now.toISOString(),
    lastReviewed: null,
    seq: 0, // stable order index, set by the loaders below
  }
}

// Parse raw CSV text into an array of cards.
export function parseCsvToCards(text, opts = {}) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h, // keep original; we normalize in mapRow
  })
  const cards = []
  for (const row of result.data) {
    const card = rowToCard(mapRow(row), opts)
    if (card) cards.push(card)
  }
  return cards
}

// --- Vocabulary deck (words) ------------------------------------------------
// Every CSV under src/decks/<LEVEL>/*.csv, bundled at build time.
const deckModules = import.meta.glob('../decks/**/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Returns all bundled word cards, deduped by german|english|urdu.
export function loadBundledCards() {
  const seen = new Set()
  const all = []
  for (const path in deckModules) {
    const m = path.match(/decks\/([^/]+)\//)
    const level = m ? m[1] : ''
    const cards = parseCsvToCards(deckModules[path], { level, deck: 'vocab' })
    for (const card of cards) {
      const key = `${card.german}|${card.english}|${card.urdu}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      all.push(card)
    }
  }
  all.forEach((c, i) => (c.seq = i))
  return all
}

// --- Sätze deck (verb sentences) --------------------------------------------
// Every CSV under src/saetze/*.csv. Files are named like A1_Verben_Saetze.csv.
const saetzeModules = import.meta.glob('../saetze/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Returns all bundled sentence cards. seq preserves file+row order so the pacer
// introduces verbs in a sensible sequence (A1 before A2, top of file first).
export function loadSaetzeCards() {
  const seen = new Set()
  const all = []
  const paths = Object.keys(saetzeModules).sort() // A1 before A2
  for (const path of paths) {
    const level = (path.match(/([ABC][12])/) || [])[1] || ''
    const cards = parseCsvToCards(saetzeModules[path], { level, deck: 'saetze' })
    for (const card of cards) {
      const key = `${card.german}|${card.lemma}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      // Deterministic id (content-based) so re-seeding is idempotent — a second
      // seed writes the same ids instead of creating duplicates.
      card.id = `s:${key}`
      all.push(card)
    }
  }
  all.forEach((c, i) => (c.seq = i))
  return all
}
