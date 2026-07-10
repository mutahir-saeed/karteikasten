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
}

function normalizeHeader(h) {
  return String(h || '')
    .replace(/^﻿/, '') // strip BOM
    .trim()
    .toLowerCase()
}

// Build a map from a parsed row (using original headers) to canonical fields.
function mapRow(row) {
  const out = { german: '', english: '', urdu: '', topic: '', type: '' }
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
export function rowToCard(mapped, level = '') {
  const german = mapped.german
  const english = mapped.english
  const urdu = mapped.urdu
  if (!german && !english && !urdu) return null

  const now = new Date()
  const type = /satz|sentence|phrase/i.test(mapped.type) ? 'sentence' : 'word'
  return {
    id: newId(),
    german,
    english,
    urdu,
    topic: mapped.topic || 'Uncategorized',
    level,
    type,
    box: 1,
    dueDate: startOfDay(now).toISOString(), // due immediately
    createdAt: now.toISOString(),
    lastReviewed: null,
  }
}

// Parse raw CSV text into an array of cards.
export function parseCsvToCards(text, level = '') {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h, // keep original; we normalize in mapRow
  })
  const cards = []
  for (const row of result.data) {
    const card = rowToCard(mapRow(row), level)
    if (card) cards.push(card)
  }
  return cards
}

// Eagerly bundle every CSV under src/decks/<LEVEL>/*.csv at build time so the
// app "catches the folder" and seeds all topics on first run — no upload needed.
const deckModules = import.meta.glob('../decks/**/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Returns all bundled cards, deduped by german|english|urdu (handles overlap
// between per-topic files and any combined word-list file).
export function loadBundledCards() {
  const seen = new Set()
  const all = []
  for (const path in deckModules) {
    // path like ../decks/A1/A1_Farben.csv  ->  level = "A1"
    const m = path.match(/decks\/([^/]+)\//)
    const level = m ? m[1] : ''
    const cards = parseCsvToCards(deckModules[path], level)
    for (const card of cards) {
      const key = `${card.german}|${card.english}|${card.urdu}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      all.push(card)
    }
  }
  return all
}
