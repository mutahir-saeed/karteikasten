import { useMemo } from 'react'
import { BOX_COUNT, isDue, intervalLabel } from '../lib/leitner.js'
import { applyPacing } from '../lib/pacing.js'

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4 text-center">
      <div className={`font-display text-3xl ${accent || 'text-ink'}`}>{value}</div>
      <div className="text-xs uppercase tracking-widest text-ink-faint mt-1">{label}</div>
    </div>
  )
}

export default function StatsView({ cards, deck = 'vocab', releasedSet }) {
  const isSaetze = deck === 'saetze'

  const s = useMemo(() => {
    // For Sätze, stats reflect the cards actually in play (released verbs).
    const active = isSaetze && releasedSet ? applyPacing(cards, releasedSet) : cards
    const perBox = [0, 0, 0, 0, 0]
    let due = 0
    for (const c of active) {
      perBox[Math.min(c.box, BOX_COUNT) - 1]++
      if (isDue(c)) due++
    }
    const topics = new Set(cards.map((c) => c.topic))
    const allVerbs = new Set(cards.map((c) => c.lemma).filter(Boolean))
    const introducedVerbs = releasedSet ? releasedSet.size : allVerbs.size
    // "Struggling": stuck in Box 1 but reviewed before -> got it wrong at least once.
    const struggling = active
      .filter((c) => c.box === 1 && c.lastReviewed)
      .sort((a, b) => new Date(b.lastReviewed) - new Date(a.lastReviewed))
    return {
      perBox,
      due,
      activeTotal: active.length,
      total: cards.length,
      topics: topics.size,
      verbs: allVerbs.size,
      introducedVerbs,
      mastered: perBox[BOX_COUNT - 1],
      struggling,
    }
  }, [cards, isSaetze, releasedSet])

  const maxBox = Math.max(1, ...s.perBox)

  return (
    <div className="px-4 py-4 max-w-md mx-auto space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Due today" value={s.due} accent="text-brass-deep" />
        {isSaetze ? (
          <>
            <Stat label="Verbs unlocked" value={`${s.introducedVerbs}/${s.verbs}`} />
            <Stat label="Sentences in play" value={s.activeTotal} />
            <Stat label="Mastered · Box 5" value={s.mastered} accent="text-felt" />
          </>
        ) : (
          <>
            <Stat label="Total cards" value={s.total} />
            <Stat label="Topics" value={s.topics} />
            <Stat label="Mastered · Box 5" value={s.mastered} accent="text-felt" />
          </>
        )}
      </div>

      {/* Per-box bar chart */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <h2 className="font-display text-xl text-ink mb-4">Cards per box</h2>
        <div className="flex items-end justify-between gap-3 h-44">
          {s.perBox.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-sm text-ink-soft mb-1">{count}</div>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-brass-deep to-brass-light transition-all"
                style={{ height: `${(count / maxBox) * 100}%`, minHeight: count ? '6px' : '0' }}
              />
              <div className="text-xs text-ink-faint mt-2">Box {i + 1}</div>
              <div className="text-[10px] text-ink-faint/70">{intervalLabel(i + 1)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Struggling words */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <h2 className="font-display text-xl text-ink mb-1">
          {isSaetze ? 'Sentences' : 'Words'} to watch · {s.struggling.length}
        </h2>
        <p className="text-sm text-ink-soft mb-3">
          Reset to Box 1 after a wrong answer — these are the ones not sticking yet.
        </p>
        {s.struggling.length === 0 ? (
          <p className="text-ink-faint text-sm py-4 text-center">
            Nothing stuck in Box 1 yet. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 max-h-80 overflow-y-auto">
            {s.struggling.slice(0, 50).map((c) => (
              <li key={c.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-ink truncate">{c.german || c.english}</div>
                  <div className="text-xs text-ink-faint truncate">
                    {c.english}{c.urdu ? ' · ' : ''}<span className="font-urdu">{c.urdu}</span>
                  </div>
                </div>
                <span className="text-[11px] text-brass-deep/70 shrink-0">{c.topic}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
