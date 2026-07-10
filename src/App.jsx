import { useEffect, useMemo, useState } from 'react'
import ReviewView from './components/ReviewView.jsx'
import ManageView from './components/ManageView.jsx'
import StatsView from './components/StatsView.jsx'
import { seedIfEmpty, allCards } from './lib/db.js'
import { isDue } from './lib/leitner.js'

const TABS = [
  { id: 'review', label: 'Review', icon: '🃏' },
  { id: 'manage', label: 'Manage', icon: '🗂️' },
  { id: 'stats', label: 'Stats', icon: '📊' },
]

export default function App() {
  const [view, setView] = useState('review')
  const [cards, setCards] = useState([])
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState({ mode: 'de', topic: 'all', level: 'all' })

  async function refresh() {
    setCards(await allCards())
  }

  useEffect(() => {
    ;(async () => {
      await seedIfEmpty()
      await refresh()
      setReady(true)
    })()
  }, [])

  const topics = useMemo(
    () => [...new Set(cards.map((c) => c.topic))].sort((a, b) => a.localeCompare(b)),
    [cards]
  )
  const levels = useMemo(
    () => [...new Set(cards.map((c) => c.level).filter(Boolean))].sort(),
    [cards]
  )
  const dueCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          isDue(c) &&
          (settings.topic === 'all' || c.topic === settings.topic) &&
          (settings.level === 'all' || c.level === settings.level)
      ).length,
    [cards, settings.topic, settings.level]
  )

  const select =
    'rounded-lg border border-ink/15 bg-paper-card/80 px-2.5 py-1.5 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brass/40 max-w-[48%]'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — brass drawer label */}
      <header className="safe-top sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-ink/10">
        <div className="max-w-md mx-auto px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl text-ink tracking-tight">
              Karteikasten
            </h1>
            <span className="text-xs text-brass-deep uppercase tracking-[0.2em]">
              {dueCount} due
            </span>
          </div>

          {view === 'review' && (
            <div className="flex gap-2 mt-2">
              <select
                className={select + ' flex-1'}
                value={settings.level}
                onChange={(e) => setSettings((s) => ({ ...s, level: e.target.value }))}
              >
                <option value="all">All levels</option>
                {levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <select
                className={select + ' flex-1'}
                value={settings.topic}
                onChange={(e) => setSettings((s) => ({ ...s, topic: e.target.value }))}
              >
                <option value="all">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
            cards={cards}
            topic={settings.topic}
            level={settings.level}
            mode={settings.mode}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onReviewed={refresh}
          />
        ) : view === 'manage' ? (
          <ManageView cards={cards} onChanged={refresh} />
        ) : (
          <StatsView cards={cards} />
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
    </div>
  )
}
