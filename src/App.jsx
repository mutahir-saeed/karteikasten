import { useEffect, useMemo, useState } from 'react'
import ReviewView from './components/ReviewView.jsx'
import ManageView from './components/ManageView.jsx'
import StatsView from './components/StatsView.jsx'
import FilterSheet from './components/FilterSheet.jsx'
import {
  seedIfEmpty,
  seedSaetzeIfEmpty,
  syncBundledVocab,
  syncBundledSaetze,
  archiveUnbundled,
  countArchived,
  restoreArchived,
  deleteArchived,
  allCards,
  getPacerState,
  savePacerState,
} from './lib/db.js'
import { buildIndex, matches, countSelected, DIM_LABEL } from './lib/facets.js'
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

// Seeding runs once per page load even if the component mounts twice (React
// StrictMode does exactly that in development).
let bootOnce = null
function boot() {
  if (!bootOnce) {
    bootOnce = (async () => {
      await seedIfEmpty()
      await seedSaetzeIfEmpty()
      // Deck files added by an app update land here, progress untouched.
      await syncBundledVocab()
      await syncBundledSaetze()
      // A1/A2 left the bundle; their cards step aside but keep their progress.
      await archiveUnbundled()
    })()
  }
  return bootOnce
}

export default function App() {
  const [view, setView] = useState('review')
  const [deck, setDeck] = useState('vocab') // 'vocab' | 'saetze'
  const [cards, setCards] = useState([])
  const [ready, setReady] = useState(false)
  const [released, setReleased] = useState(null) // Set of released verb keys (Sätze)
  const [waitingVerbs, setWaitingVerbs] = useState(0)
  const [archived, setArchived] = useState(0)
  const [settings, setSettings] = useState({ mode: 'de', topic: 'all', level: 'all' })
  // Facet selection: { dimension: [values] }. OR inside, AND across.
  const [facetSel, setFacetSel] = useState({})
  const [showFilter, setShowFilter] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const install = useInstall()

  async function refresh() {
    const all = await allCards()
    setCards(all)
    setArchived(await countArchived())
    return all
  }

  // Put the archived A1/A2 cards back in rotation, or clear them for good.
  async function handleArchive(action) {
    if (action === 'delete') {
      if (!confirm(`Delete ${archived} archived A1/A2 cards for good? This cannot be undone.`)) return
      await deleteArchived()
    } else {
      await restoreArchived()
    }
    await refresh()
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
      await boot()
      const all = await refresh()
      await runPacer(all)
      setReady(true)
      syncReminders().catch(() => {})
    })()
  }, [])

  const deckCards = useMemo(
    () => cards.filter((c) => (c.deck || 'vocab') === deck && !c.archived),
    [cards, deck]
  )

  const releasedForDeck = deck === 'saetze' ? released : null

  // Cards actually visible right now (Sätze hides not-yet-released verbs).
  const visibleCards = useMemo(() => {
    if (deck === 'saetze' && released) return applyPacing(deckCards, released)
    return deckCards
  }, [deckCards, deck, released])

  // A merged card can belong to more than one level (abholen is A1 and B1).
  const atLevel = (c, level) =>
    level === 'all' || c.level === level || (c.levels || []).includes(level)

  const topics = useMemo(() => {
    const scoped = deckCards.filter((c) => atLevel(c, settings.level))
    return [...new Set(scoped.map((c) => c.topic))].sort((a, b) => a.localeCompare(b))
  }, [deckCards, settings.level])

  const levels = useMemo(
    () => [...new Set(deckCards.flatMap((c) => c.levels?.length ? c.levels : [c.level]).filter(Boolean))].sort(),
    [deckCards]
  )

  // Which facet values exist within the current level and topic, and how many
  // cards each covers. Scoped so the counts on the chips tell the truth.
  const facetIndex = useMemo(() => {
    const scoped = deckCards.filter(
      (c) => atLevel(c, settings.level) && (settings.topic === 'all' || c.topic === settings.topic)
    )
    return buildIndex(scoped)
  }, [deckCards, settings.level, settings.topic])

  const facetCount = countSelected(facetSel)
  const facetMatches = useMemo(
    () =>
      deckCards.filter(
        (c) =>
          atLevel(c, settings.level) &&
          (settings.topic === 'all' || c.topic === settings.topic) &&
          matches(c, facetSel)
      ).length,
    [deckCards, settings.level, settings.topic, facetSel]
  )

  function changeLevel(level) {
    setSettings((s) => ({ ...s, level, topic: 'all' }))
    setFacetSel({})
  }

  function changeDeck(next) {
    setDeck(next)
    setSettings((s) => ({ ...s, topic: 'all', level: 'all' }))
    setFacetSel({})
  }

  const dueCount = useMemo(
    () =>
      visibleCards.filter(
        (c) =>
          isDue(c) &&
          (settings.topic === 'all' || c.topic === settings.topic) &&
          atLevel(c, settings.level) &&
          matches(c, facetSel)
      ).length,
    [visibleCards, settings.topic, settings.level, facetSel]
  )

  // min-w-0 matters: without it a flex item refuses to shrink below its widest
  // option, and a long topic name pushes the filter button off the screen.
  const select =
    'min-w-0 rounded-lg border border-ink/15 bg-paper-card/80 px-2.5 py-1.5 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brass/40'

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
              {levels.length > 1 && (
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
              )}
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
              <button
                onClick={() => setShowFilter(true)}
                aria-label="Filter"
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-sm transition active:scale-95 ${
                  facetCount
                    ? 'bg-brass text-paper-card border-brass shadow-sm'
                    : 'bg-paper-card/80 text-ink-soft border-ink/15'
                }`}
              >
                ⚲{facetCount ? ` ${facetCount}` : ''}
              </button>
            </div>
          )}

          {/* Active facets, tap to drop one */}
          {view === 'review' && facetCount > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              {Object.entries(facetSel).flatMap(([dim, vals]) =>
                vals.map((v) => (
                  <button
                    key={dim + v}
                    onClick={() =>
                      setFacetSel((sel) => {
                        const next = { ...sel, [dim]: sel[dim].filter((x) => x !== v) }
                        if (!next[dim].length) delete next[dim]
                        return next
                      })
                    }
                    className="shrink-0 px-2.5 py-1 rounded-full text-[12px] bg-brass/15 text-brass-deep border border-brass/30"
                  >
                    <span className="opacity-60">{DIM_LABEL[dim] || dim}: </span>
                    {v} ✕
                  </button>
                ))
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
            facetSel={facetSel}
            mode={settings.mode}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onReviewed={refresh}
          />
        ) : view === 'manage' ? (
          <ManageView
            deck={deck}
            cards={deckCards}
            archived={archived}
            onArchive={handleArchive}
            onChanged={refresh}
          />
        ) : (
          <StatsView
            deck={deck}
            cards={deckCards}
            releasedSet={releasedForDeck}
            dailyNew={DAILY_NEW_VERBS}
          />
        )}
      </main>

      {showFilter && (
        <FilterSheet
          index={facetIndex}
          selected={facetSel}
          matchCount={facetMatches}
          onChange={setFacetSel}
          onClose={() => setShowFilter(false)}
        />
      )}

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
