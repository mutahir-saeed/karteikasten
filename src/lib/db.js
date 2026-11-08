import Dexie from 'dexie'
import { loadBundledCards, loadSaetzeCards } from './csv.js'
import { startOfDay } from './leitner.js'

// Persistent store. IndexedDB survives app restarts and works offline.
export const db = new Dexie('karteikasten')

db.version(1).stores({
  cards: 'id, box, topic, level, dueDate, type',
  meta: 'key',
})

// v2 adds the `deck` field ('vocab' | 'saetze') so the sentence module lives
// alongside the word deck. Existing installs are migrated in place: their cards
// predate `deck`/`lemma`/`seq`, so we backfill them as vocabulary.
db.version(2)
  .stores({
    cards: 'id, box, topic, level, dueDate, type, deck',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('cards')
      .toCollection()
      .modify((c) => {
        if (!c.deck) c.deck = 'vocab'
        if (c.lemma == null) c.lemma = (c.german || '').toLowerCase().trim()
        if (c.seq == null) c.seq = 0
      })
  })

// v3 adds the facet model: `facets` (dimension -> values, from the Tags
// column), `levels` (a word can sit in A1 and B1 at once), plus `forms` and
// `note` from the grammar sheets. Existing cards are backfilled so nothing has
// to be re-seeded and no progress is lost.
db.version(3)
  .stores({
    cards: 'id, box, topic, level, dueDate, type, deck',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('cards')
      .toCollection()
      .modify((c) => {
        if (!c.facets) c.facets = {}
        if (!c.levels) c.levels = c.level ? [c.level] : []
        if (c.forms == null) c.forms = ''
        if (c.note == null) c.note = ''
      })
  })

const wordKey = (c) => (c.german || '').trim().toLowerCase()

// Pick up deck files added by an app update, without disturbing progress.
//
// seedIfEmpty only ever runs on a fresh install, so on an existing phone a new
// CSV would otherwise never appear. This adds the cards that aren't there yet
// and refreshes the teaching data (facets, forms, note, topic) on the ones that
// are. Box, dueDate and lastReviewed are the user's and are never touched.
export async function syncBundledVocab() {
  const bundled = loadBundledCards()
  if (!bundled.length) return { added: 0, updated: 0 }
  const existing = await db.cards.where('deck').equals('vocab').toArray()
  const byWord = new Map()
  for (const c of existing) {
    const k = wordKey(c)
    if (!byWord.has(k)) byWord.set(k, c) // older installs may hold duplicates
  }
  const fresh = []
  const touched = []
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  for (const b of bundled) {
    const cur = byWord.get(wordKey(b))
    if (!cur) {
      fresh.push(b)
      continue
    }
    const patch = {}
    if (!same(cur.facets, b.facets)) patch.facets = b.facets
    if (!same(cur.levels, b.levels)) patch.levels = b.levels
    if ((cur.forms || '') !== b.forms) patch.forms = b.forms
    if ((cur.note || '') !== b.note) patch.note = b.note
    if (b.english && b.english !== cur.english) patch.english = b.english
    if (b.urdu && !cur.urdu) patch.urdu = b.urdu
    if (b.topic && b.topic !== 'Uncategorized' && b.topic !== cur.topic) patch.topic = b.topic
    if (b.seq != null && cur.seq !== b.seq) patch.seq = b.seq
    if (Object.keys(patch).length) touched.push({ ...cur, ...patch })
  }
  // bulkPut, not bulkAdd: these ids are new, and putting them twice is a
  // no-op rather than a duplicate.
  if (fresh.length) await db.cards.bulkPut(fresh)
  if (touched.length) await db.cards.bulkPut(touched)
  return { added: fresh.length, updated: touched.length }
}

// Same idea for the Sätze deck. Its ids are content-derived, so "already
// there" is just an id check — and only missing ones are added, because a
// bulkPut would reset the box and due date of a sentence already in rotation.
export async function syncBundledSaetze() {
  const bundled = loadSaetzeCards()
  if (!bundled.length) return { added: 0 }
  const ids = new Set(await db.cards.where('deck').equals('saetze').primaryKeys())
  const fresh = bundled.filter((c) => !ids.has(c.id))
  if (fresh.length) await db.cards.bulkPut(fresh)
  return { added: fresh.length }
}

// Seed the bundled word deck the first time the app runs. Idempotent.
export async function seedIfEmpty() {
  const seeded = await db.meta.get('seeded')
  const vocabCount = await db.cards.where('deck').equals('vocab').count()
  if (seeded && vocabCount > 0) return { seeded: false, count: vocabCount }

  if (vocabCount === 0) {
    const cards = loadBundledCards()
    // bulkPut + deterministic ids => safe if this races with itself.
    if (cards.length) await db.cards.bulkPut(cards)
    await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
    return { seeded: true, count: cards.length }
  }
  await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
  return { seeded: false, count: vocabCount }
}

// Seed the Sätze (verb-sentence) deck. Runs independently of the word deck so
// existing installs pick up the new deck on their next update.
export async function seedSaetzeIfEmpty() {
  const existing = await db.cards.where('deck').equals('saetze').count()
  if (existing > 0) return { seeded: false, count: existing }
  const cards = loadSaetzeCards()
  // bulkPut + deterministic ids => idempotent even if this races with itself.
  if (cards.length) await db.cards.bulkPut(cards)
  return { seeded: cards.length > 0, count: cards.length }
}

export async function allCards() {
  return db.cards.toArray()
}

export async function addCards(cards) {
  if (!cards.length) return 0
  await db.cards.bulkAdd(cards)
  return cards.length
}

// Import cards but skip ones already present (same german|english|urdu).
export async function importCardsDeduped(cards) {
  const existing = await db.cards.toArray()
  const seen = new Set(
    existing.map((c) => `${c.german}|${c.english}|${c.urdu}`.toLowerCase())
  )
  const fresh = []
  for (const c of cards) {
    const key = `${c.german}|${c.english}|${c.urdu}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    fresh.push(c)
  }
  if (fresh.length) await db.cards.bulkAdd(fresh)
  return { added: fresh.length, skipped: cards.length - fresh.length }
}

export async function updateCard(card) {
  await db.cards.put(card)
}

export async function deleteCard(id) {
  await db.cards.delete(id)
}

// Reset cards back to Box 1, due today. Optionally scope to one deck.
export async function resetAllBoxes(deck = null) {
  const today = startOfDay(new Date()).toISOString()
  const cards = deck
    ? await db.cards.where('deck').equals(deck).toArray()
    : await db.cards.toArray()
  const updated = cards.map((c) => ({
    ...c,
    box: 1,
    dueDate: today,
    lastReviewed: null,
  }))
  await db.cards.bulkPut(updated)
  return updated.length
}

// Merge a backup (array of cards) into the store, overwriting by id.
export async function restoreCards(cards) {
  if (!Array.isArray(cards) || !cards.length) return 0
  const valid = cards.filter((c) => c && c.id && (c.german || c.english || c.urdu))
  await db.cards.bulkPut(valid)
  await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
  return valid.length
}

// --- Sätze daily-pacer state (which verbs have been released) ---------------
const PACER_KEY = 'saetze-pacer'

export async function getPacerState() {
  const rec = await db.meta.get(PACER_KEY)
  return rec?.state || null
}

export async function savePacerState(state) {
  await db.meta.put({ key: PACER_KEY, state, at: new Date().toISOString() })
}

export async function clearPacer() {
  await db.meta.delete(PACER_KEY)
}

export async function getTopics() {
  const cards = await db.cards.toArray()
  return [...new Set(cards.map((c) => c.topic))].sort((a, b) => a.localeCompare(b))
}
