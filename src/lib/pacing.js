// Daily "new card" pacing (Anki-style).
//
// Without this, every card in every loaded deck has dueDate = today the
// moment it's imported, so a 116-verb deck would dump all of its cards into
// the review queue on day one. Instead we group cards by "lemma" (a word
// card and all of its sentence cards share the same lemma, e.g. "gehen")
// and release only N new lemma-groups per calendar day. Once a group is
// released it stays released forever — normal Leitner box/dueDate scheduling
// takes over from there.

import { startOfDay } from './leitner.js'

export function groupKey(card) {
  return (card.lemma || card.german || card.english || card.id || '').toLowerCase().trim()
}

function todayStr(now = new Date()) {
  return startOfDay(now).toISOString().slice(0, 10)
}

const emptyState = () => ({ releasedLemmas: [], releasedToday: { date: '', lemmas: [] } })

// Pure function: given all cards, the persisted pacing state, and today's cap,
// returns the updated set of released lemma-keys plus the new state to persist.
export function computeRelease(cards, state, capPerDay, now = new Date()) {
  const safeState = state || emptyState()
  const today = todayStr(now)
  const releasedSet = new Set(safeState.releasedLemmas || [])
  const todayLemmas =
    safeState.releasedToday?.date === today ? [...safeState.releasedToday.lemmas] : []

  const neverReviewed = cards.filter((c) => c.lastReviewed === null)
  const byGroup = new Map()
  for (const c of neverReviewed) {
    const k = groupKey(c)
    if (!byGroup.has(k)) byGroup.set(k, [])
    byGroup.get(k).push(c)
  }
  // Earliest-introduced group first (stable via seq, falls back to 0).
  const orderedGroups = [...byGroup.entries()].sort((a, b) => {
    const sa = Math.min(...a[1].map((c) => c.seq ?? 0))
    const sb = Math.min(...b[1].map((c) => c.seq ?? 0))
    return sa - sb
  })

  let slots = Math.max(0, (capPerDay ?? 7) - todayLemmas.length)
  for (const [key] of orderedGroups) {
    if (releasedSet.has(key)) continue
    if (slots <= 0) break
    releasedSet.add(key)
    todayLemmas.push(key)
    slots--
  }

  const nextState = {
    releasedLemmas: [...releasedSet],
    releasedToday: { date: today, lemmas: todayLemmas },
  }
  return { releasedSet, nextState }
}

// Cards visible in review right now: anything already reviewed at least once
// (normal Leitner scheduling applies) plus new cards whose lemma-group has
// been released.
export function applyPacing(cards, releasedSet) {
  if (!releasedSet) return cards
  return cards.filter((c) => c.lastReviewed !== null || releasedSet.has(groupKey(c)))
}

// How many distinct new verbs/words are still waiting to be released.
export function countWaitingGroups(cards, releasedSet) {
  if (!releasedSet) return 0
  const waiting = new Set()
  for (const c of cards) {
    if (c.lastReviewed === null && !releasedSet.has(groupKey(c))) waiting.add(groupKey(c))
  }
  return waiting.size
}
