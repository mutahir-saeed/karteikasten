// Core Leitner spaced-repetition logic.
//
// 5 boxes. A correct answer promotes a card one box (max 5).
// A wrong answer resets it to box 1.
// Review interval (in days) grows with the box number.

export const BOX_COUNT = 5

// Interval in days per box: Box1=1 (daily), 2=2, 3=4, 4=8, 5=16.
export const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }

export function intervalForBox(box) {
  return BOX_INTERVALS[box] ?? 1
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Midnight of the given date (local time). Cards are scheduled by calendar day.
export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, days) {
  return new Date(startOfDay(date).getTime() + days * MS_PER_DAY)
}

// A card is due when its dueDate is today or earlier.
export function isDue(card, now = new Date()) {
  return new Date(card.dueDate).getTime() <= startOfDay(now).getTime() + (MS_PER_DAY - 1)
}

// Produce the updated card fields after a review answer.
export function applyAnswer(card, correct, now = new Date()) {
  const nextBox = correct ? Math.min(card.box + 1, BOX_COUNT) : 1
  return {
    ...card,
    box: nextBox,
    lastReviewed: now.toISOString(),
    dueDate: addDays(now, intervalForBox(nextBox)).toISOString(),
  }
}

// Human label for the next-review interval of a box.
export function intervalLabel(box) {
  const days = intervalForBox(box)
  if (days === 1) return 'daily'
  return `every ${days} days`
}
