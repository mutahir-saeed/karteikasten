import { useEffect, useMemo, useState } from 'react'
import ReviewView from './components/ReviewView.jsx'
import ManageView from './components/ManageView.jsx'
import StatsView from './components/StatsView.jsx'
import {
  seedIfEmpty,
  seedSaetzeIfEmpty,
  allCards,
  getPacerState,
  savePacerState,
} from './lib/db.js'
import { isDue } from './lib/leitner.js'
import { computeRelease, applyPacing, countWaitingGroups } from './lib/pacing.js'
import { useInstall } from './lib/useInstall.js'
import { syncReminders } from './lib/reminders.js'

const TABS = [
  { id: 'review', label: 'Review', icon: '🃏' },
  { id: 'manage', label: 'Manage', icon: '🗂️' },
  { id: 'stats', label: 'Stats', icon: '📊' },
]

// How many brand-new verbs the Sätze module introduces each day.
const DAILY_NEW_VERBS = 7

export default function App() {
  const [view, setView] = useState('review')
  const [deck, setDeck] = useState('vocab') // 'vocab' | 'saetze'
  const [cards, setCards] = useState([])
  const [ready, setReady] = useState(false)
  const [released, setReleased] = useState(null) // Set of released verb keys (Sätze)
  const [waitingVerbs, setWaitingVerbs] = useState(0)
  const [settings, setSettings] = useState({ mode: 'de', topic: 'all', level: 'all' })
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const install = useInstall()

  async function refresh() {
    const all = await allCards()
    setCards(all)
    return all
  }

  // Release the day's new verbs for the Sätze deck (Anki-style new-card pacing).
  async function runPacer(all) {
    const saetze = all.filter((c) => (c.deck || 'vocab') === 'saetze')
    if (!saetze.length) {
      setReleased(new Set())
      setWaitingVerbs(0)
      return
    }
    const state = await getPacerState()
    const { releasedSet, nextState } = computeRelease(saetze, state, DAILY_NEW_VERBS)
    await savePacerState(nextState)
    setReleased(releasedSet)
    setWaitingVerbs(countWaitingGroups(saetze, releasedSet))
  }

  useEffect(() => {
    ;(async () => {
      await seedIfEmpty()
      await seedSaetzeIfEmpty()
      const all = await refresh()
      await runPacer(all)
      setReady(true)
      syncReminders().catch(() => {})
    })()
  }, [])

  const deckCards = useMemo(
    () => cards.filter((c) => (c.deck || 'vocab') === deck),
    [cards, deck]
  )

  const releasedForDeck = deck === 'saetze' ? released : null

  // Cards actually visible right now (Sätze hides not-yet-released verbs).
  const visibleCards = useMemo(() => {
    if (deck === 'saetze' && released) return applyPacing(deckCards, released)
    return deckCards
  }, [deckCards, deck, released])

  const topics = useMemo(() => {
    const scoped =
      settings.level === 'all' ? deckCards : deckCards.filter((c) => c.level === settings.level)
    return [...new Set(scoped.map((c) => c.topic))].sort((a, b) => a.localeCompare(b))
  }, [deckCards, settings.level])

  const levels = useMemo(
    () => [...new Set(deckCards.map((c) => c.level).filter(Boolean))].sort(),
    [deckCards]
  )

  function changeLevel(level) {
    setSettings((s) => ({ ...s, level, topic: 'all' }))
  }

  function changeDeck(next) {
    setDeck(next)
    setSettings((s) => ({ ...s, topic: 'all', level: 'all' }))
  }

  const dueCount = useMemo(
    () =>
      visibleCards.filter(
        (c) =>
          isDue(c) &&
          (settings.topic === 'all' || c.topic === settings.topic) &&
          (settings.level === 'all' || c.level === settings.level)
      ).length,
    [visibleCards, settings.topic, settings.level]
  )

  const select =
    'rounded-lg border border-ink/15 bg-paper-card/80 px-2.5 py-1.5 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brass/40'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — brass drawer label */}
      <header className="safe-top sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-ink/10">
        <div className="max-w-md mx-auto px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl text-ink tracking-tight">Karteikasten</h1>
            <div className="flex items-center gap-3">
              {install.canShow && (
                <button
                  onClick={() =>
                    install.canPrompt ? install.promptInstall() : setShowInstallHelp(true)
                  }
                  className="text-xs px-2.5 py-1 rounded-full bg-brass text-paper-card font-medium shadow-sm active:scale-95 transition"
                >
                  ⤓ Install
                </button>
              )}
              <span className="text-xs text-brass-deep uppercase tracking-[0.2em]">
                {dueCount} due
              </span>
            </div>
          </div>

          {/* Deck switch: words vs. verb sentences */}
          <div className="mt-2 grid grid-cols-2 gap-1 bg-paper-deep/60 rounded-xl p-1">
            {[
              { id: 'vocab', label: 'Wörter', sub: 'words' },
              { id: 'saetze', label: 'Sätze', sub: 'verb sentences' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => changeDeck(d.id)}
                className={`py-1.5 rounded-lg text-sm font-medium transition ${
                  deck === d.id
                    ? 'bg-paper-card text-ink shadow-sm'
                    : 'text-ink-soft'
                }`}
              >
                {d.label}
                <span className="block text-[10px] font-normal text-ink-faint">{d.sub}</span>
              </button>
            ))}
          </div>

          {view === 'review' && (
            <div className="flex items-center gap-2 mt-2">
              <select
                className={select + ' flex-1'}
                value={settings.level}
                onChange={(e) => changeLevel(e.target.value)}
              >
                <option value="all">All levels</option>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {deck === 'vocab' ? (
                <select
                  className={select + ' flex-1'}
                  value={settings.topic}
                  onChange={(e) => setSettings((s) => ({ ...s, topic: e.target.value }))}
                >
                  <option value="all">All topics</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-center text-xs text-ink-faint px-2 py-1.5 rounded-lg bg-paper-card/60 border border-ink/10">
                  {waitingVerbs} verbs left to unlock
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1">
        {!ready ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-ink-faint">
            <div className="text-5xl mb-3 animate-pulse">🗃️</div>
            <p>Opening the card catalog…</p>
          </div>
        ) : view === 'review' ? (
          <ReviewView
            key={deck}
            cards={deckCards}
            releasedSet={releasedForDeck}
            deck={deck}
            dailyNew={DAILY_NEW_VERBS}
            topic={settings.topic}
            level={settings.level}
            mode={settings.mode}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onReviewed={refresh}
          />
        ) : view === 'manage' ? (
          <ManageView deck={deck} cards={deckCards} onChanged={refresh} />
        ) : (
          <StatsView
            deck={deck}
            cards={deckCards}
            releasedSet={releasedForDeck}
            dailyNew={DAILY_NEW_VERBS}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="safe-bottom sticky bottom-0 z-30 bg-paper-card/90 backdrop-blur border-t border-ink/10">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-xs transition ${
                view === t.id ? 'text-brass-deep' : 'text-ink-faint'
              }`}
            >
              <span className={`text-lg ${view === t.id ? 'scale-110' : ''} transition`}>
                {t.icon}
              </span>
              <span className={view === t.id ? 'font-medium' : ''}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* iOS manual install instructions (no beforeinstallprompt on Safari) */}
      {showInstallHelp && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowInstallHelp(false)}
        >
          <div
            className="bg-paper-card rounded-2xl shadow-card max-w-sm w-full p-5 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-ink mb-2">Add to Home Screen</h2>
            <ol className="text-sm text-ink-soft space-y-2 list-decimal list-inside">
              <li>
                Tap the <strong>Share</strong> button in Safari (the square with an ↑).
              </li>
              <li>
                Scroll down and tap <strong>“Add to Home Screen”</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> — Karteikasten opens full-screen like an app.
              </li>
            </ol>
            <button
              onClick={() => setShowInstallHelp(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-ink text-paper-card font-medium active:scale-[0.98] transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
