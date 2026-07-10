import Dexie from 'dexie'
import { loadBundledCards } from './csv.js'
import { startOfDay } from './leitner.js'

// Persistent store. IndexedDB survives app restarts and works offline.
export const db = new Dexie('karteikasten')

db.version(1).stores({
  // Primary key id; indexes on the fields we query/filter by.
  cards: 'id, box, topic, level, dueDate, type',
  meta: 'key',
})

// Seed the bundled decks the first time the app runs. Idempotent via a meta flag.
export async function seedIfEmpty() {
  const seeded = await db.meta.get('seeded')
  const count = await db.cards.count()
  if (seeded && count > 0) return { seeded: false, count }

  if (count === 0) {
    const cards = loadBundledCards()
    if (cards.length) await db.cards.bulkAdd(cards)
    await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
    return { seeded: true, count: cards.length }
  }
  await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
  return { seeded: false, count }
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

// Reset every card back to Box 1, due today.
export async function resetAllBoxes() {
  const today = startOfDay(new Date()).toISOString()
  const cards = await db.cards.toArray()
  const updated = cards.map((c) => ({
    ...c,
    box: 1,
    dueDate: today,
    lastReviewed: null,
  }))
  await db.cards.bulkPut(updated)
  return updated.length
}

// Merge a backup (array of cards) into the store, overwriting by id and adding
// any new ones. Returns how many were written.
export async function restoreCards(cards) {
  if (!Array.isArray(cards) || !cards.length) return 0
  // Only keep records that look like cards.
  const valid = cards.filter((c) => c && c.id && (c.german || c.english || c.urdu))
  await db.cards.bulkPut(valid)
  // Ensure the seed flag is set so we don't re-seed over a restore.
  await db.meta.put({ key: 'seeded', value: true, at: new Date().toISOString() })
  return valid.length
}

export async function getTopics() {
  const cards = await db.cards.toArray()
  return [...new Set(cards.map((c) => c.topic))].sort((a, b) =>
    a.localeCompare(b)
  )
}
