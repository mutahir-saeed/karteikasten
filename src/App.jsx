import { useEffect, useMemo, useState } from 'react'
import ReviewView from './components/ReviewView.jsx'
import ManageView from './components/ManageView.jsx'
import StatsView from './components/StatsView.jsx'
import { seedIfEmpty, allCards } from './lib/db.js'
import { isDue } from './lib/leitner.js'
import { useInstall } from './lib/useInstall.js'
import { syncReminders } from './lib/reminders.js'

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
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const install = useInstall()

  async function refresh() {
    setCards(await allCards())
  }

  useEffect(() => {
    ;(async () => {
      await seedIfEmpty()
      await refresh()
      setReady(true)
      // Keep the rolling reminder schedule fresh (if the user enabled it).
      syncReminders().catch(() => {})
    })()
  }, [])

  // Topics are scoped to the selected level: pick A1 and you only see A1 topics.
  const topics = useMemo(() => {
    const scoped =
      settings.level === 'all' ? cards : cards.filter((c) => c.level === settings.level)
    return [...new Set(scoped.map((c) => c.topic))].sort((a, b) => a.localeCompare(b))
  }, [cards, settings.level])
  const levels = useMemo(
    () => [...new Set(cards.map((c) => c.level).filter(Boolean))].sort(),
    [cards]
  )

  // Changing level resets the topic so a stale (out-of-level) topic can't linger.
  function changeLevel(level) {
    setSettings((s) => ({ ...s, level, topic: 'all' }))
  }
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
            <div className="flex items-center gap-3">
              {install.canShow && (
                <button
                  onClick={() => (install.canPrompt ? install.promptInstall() : setShowInstallHelp(true))}
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

          {view === 'review' && (
            <div className="flex gap-2 mt-2">
              <select
                className={select + ' flex-1'}
                value={settings.level}
                onChange={(e) => changeLevel(e.target.value)}
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
              <li>Tap the <strong>Share</strong> button in Safari (the square with an ↑).</li>
              <li>Scroll down and tap <strong>“Add to Home Screen”</strong>.</li>
              <li>Tap <strong>Add</strong> — Karteikasten opens full-screen like an app.</li>
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
