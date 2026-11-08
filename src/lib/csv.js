import Papa from 'papaparse'
import { startOfDay } from './leitner.js'
import { parseTags } from './facets.js'

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
  // Facet tags, as `dimension:value` pairs separated by ';'. This is what
  // drives every filter row except the level one.
  tags: 'tags',
  schlagworte: 'tags',
  // Präteritum / Partizip II, and the one-line note from the grammar sheets.
  forms: 'forms',
  formen: 'forms',
  note: 'note',
  notiz: 'note',
  hinweis: 'note',
}

function normalizeHeader(h) {
  return String(h || '')
    .replace(/^﻿/, '') // strip BOM
    .trim()
    .toLowerCase()
}

// Build a map from a parsed row (using original headers) to canonical fields.
function mapRow(row) {
  const out = { german: '', english: '', urdu: '', topic: '', type: '', lemma: '',
    tags: '', forms: '', note: '' }
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
    levels: level ? [level] : [],
    type,
    deck,
    // Structural and semantic grouping: see lib/facets.js.
    facets: parseTags(mapped.tags),
    forms: mapped.forms || '',
    note: mapped.note || '',
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

// One card per German word, merged across every bundled file.
//
// The same verb legitimately appears in several sheets: `abholen` is an A1
// word, a trennbares Verb and a Kurs DaF Lektion 1 item. Keeping three cards
// would mean answering it three times, so instead the rows merge into one card
// that carries all of their facets, all of their levels and the richest
// teaching data of the three.
function mergeCards(a, b) {
  const longer = (x, y) => ((x || '').length >= (y || '').length ? x || y : y || x) || ''
  const union = (x = [], y = []) => [...new Set([...x, ...y])]
  const english =
    a.english && b.english && !a.english.toLowerCase().includes(b.english.toLowerCase())
      ? b.english.toLowerCase().includes(a.english.toLowerCase())
        ? b.english
        : `${a.english} / ${b.english}`
      : longer(a.english, b.english)
  const facets = { ...a.facets }
  for (const dim of Object.keys(b.facets || {})) {
    facets[dim] = union(facets[dim], b.facets[dim])
  }
  return {
    ...a,
    english,
    urdu: longer(a.urdu, b.urdu),
    // The richer sheet names the topic: a meaning field beats "Uncategorized".
    topic: a.topic && a.topic !== 'Uncategorized' ? a.topic : b.topic,
    levels: union(a.levels, b.levels),
    facets,
    forms: longer(a.forms, b.forms),
    note: longer(a.note, b.note),
    lemma: a.lemma || b.lemma,
  }
}

// Returns all bundled word cards, one per German word.
export function loadBundledCards() {
  const byWord = new Map()
  const order = []
  for (const path of Object.keys(deckModules).sort()) {
    const m = path.match(/decks\/([^/]+)\//)
    const level = m ? m[1] : ''
    for (const card of parseCsvToCards(deckModules[path], { level, deck: 'vocab' })) {
      const key = card.german.trim().toLowerCase()
      if (!key) continue
      if (!byWord.has(key)) {
        byWord.set(key, card)
        order.push(key)
      } else {
        byWord.set(key, mergeCards(byWord.get(key), card))
      }
    }
  }
  const all = order.map((k) => byWord.get(k))
  all.forEach((c, i) => {
    c.seq = i
    // Content-derived id: seeding and syncing become idempotent, so a double
    // mount (React StrictMode in dev, or a reload mid-seed) can't insert the
    // same word twice.
    c.id = `v:${c.german.trim().toLowerCase()}`
  })
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
