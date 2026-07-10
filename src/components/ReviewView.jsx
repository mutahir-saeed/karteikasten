import { useEffect, useMemo, useState } from 'react'
import Flashcard from './Flashcard.jsx'
import { applyAnswer, isDue } from '../lib/leitner.js'
import { applyPacing } from '../lib/pacing.js'
import { updateCard } from '../lib/db.js'

const MODES = [
  { id: 'de', label: 'DE → EN/UR' },
  { id: 'enur', label: 'EN/UR → DE' },
  { id: 'en', label: 'EN → DE' },
  { id: 'ur', label: 'UR → DE' },
  { id: 'mixed', label: 'Mixed' },
]

export default function ReviewView({
  cards,
  releasedSet,
  deck,
  topic,
  level,
  mode,
  onSettings,
  onReviewed,
}) {
  // Build the due queue for the current filters. Frozen at session start so
  // answered cards (which get a future dueDate) don't vanish mid-shuffle.
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [session, setSession] = useState({ correct: 0, wrong: 0 })

  const dueList = useMemo(() => {
    // For the Sätze deck, hide verbs that today's pacer hasn't released yet.
    const pool = releasedSet ? applyPacing(cards, releasedSet) : cards
    return pool.filter(
      (c) =>
        isDue(c) &&
        (topic === 'all' || c.topic === topic) &&
        (level === 'all' || c.level === level)
    )
  }, [cards, releasedSet, topic, level])

  function startSession() {
    // shuffle
    const shuffled = [...dueList].sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setIdx(0)
    setSession({ correct: 0, wrong: 0 })
  }

  // (Re)build the queue whenever filters or the released set change.
  useEffect(() => {
    startSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, level, releasedSet])

  async function handleAnswer(correct) {
    const card = queue[idx]
    const updated = applyAnswer(card, correct)
    await updateCard(updated)
    setSession((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }))
    onReviewed?.()
    setIdx((i) => i + 1)
  }

  const current = queue[idx]
  const done = idx >= queue.length

  return (
    <div className="flex flex-col min-h-full">
      {/* Direction + filter bar */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onSettings({ mode: m.id })}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition ${
                mode === m.id
                  ? 'bg-ink text-paper-card border-ink shadow-sm'
                  : 'bg-paper-card/60 text-ink-soft border-ink/15'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        {done ? (
          <div className="text-center max-w-sm animate-pop">
            <div className="text-6xl mb-4">🗃️</div>
            {queue.length === 0 ? (
              <>
                <h2 className="font-display text-2xl text-ink mb-2">All caught up</h2>
                <p className="text-ink-soft">
                  {deck === 'saetze'
                    ? "You've cleared today's verbs. Come back tomorrow for 7 new ones — anything you missed returns on its Leitner schedule."
                    : 'No cards due right now for this filter. Come back when your boxes are ready, or pick another topic.'}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl text-ink mb-2">Session complete</h2>
                <p className="text-ink-soft mb-5">
                  {session.correct} correct · {session.wrong} to repeat
                </p>
                <button
                  onClick={startSession}
                  className="px-5 py-2.5 rounded-xl bg-brass text-paper-card font-medium shadow-card active:scale-95 transition"
                >
                  Review again
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="text-center text-sm text-ink-faint mb-4">
              {idx + 1} / {queue.length} due
            </div>
            <Flashcard card={current} mode={mode} onAnswer={handleAnswer} />
          </div>
        )}
      </div>
    </div>
  )
}
