import { useMemo, useRef, useState } from 'react'
import { parseCsvToCards } from '../lib/csv.js'
import {
  importCardsDeduped,
  addCards,
  deleteCard,
  resetAllBoxes,
  restoreCards,
  allCards,
  clearPacer,
} from '../lib/db.js'
import { rowToCard } from '../lib/csv.js'
import {
  loadReminder,
  saveReminder,
  getPermission,
  requestPermission,
  scheduleDaily,
  cancelDaily,
  triggersSupported,
} from '../lib/reminders.js'

function newCard(fields, deck) {
  return rowToCard(
    {
      german: fields.german,
      english: fields.english,
      urdu: fields.urdu,
      topic: fields.topic,
      type: fields.type,
      lemma: fields.lemma,
    },
    { level: fields.level || '', deck }
  )
}

export default function ManageView({ deck = 'vocab', cards, onChanged }) {
  const isSaetze = deck === 'saetze'
  const fileRef = useRef(null)
  const restoreRef = useRef(null)
  const [flash, setFlash] = useState(null)
  const [form, setForm] = useState({
    german: '', english: '', urdu: '', topic: '', level: '', type: 'word', lemma: '',
  })
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')
  const [reminder, setReminder] = useState(loadReminder)
  const remindersOk = triggersSupported()

  async function setReminderEnabled(enabled) {
    if (enabled) {
      const perm = getPermission() === 'granted' ? 'granted' : await requestPermission()
      if (perm !== 'granted') {
        notify('Allow notifications to get reminders.')
        return
      }
      const ok = await scheduleDaily(reminder.time)
      const next = { ...reminder, enabled: true }
      setReminder(next)
      saveReminder(next)
      notify(ok ? `Daily reminder set for ${reminder.time}.` : 'Reminder saved.')
    } else {
      await cancelDaily()
      const next = { ...reminder, enabled: false }
      setReminder(next)
      saveReminder(next)
      notify('Daily reminder turned off.')
    }
  }

  async function setReminderTime(time) {
    const next = { ...reminder, time }
    setReminder(next)
    saveReminder(next)
    if (next.enabled && getPermission() === 'granted') {
      await scheduleDaily(time)
      notify(`Reminder moved to ${time}.`)
    }
  }

  const topics = useMemo(
    () => [...new Set(cards.map((c) => c.topic))].sort((a, b) => a.localeCompare(b)),
    [cards]
  )

  function notify(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3000)
  }

  async function handleFile(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    let added = 0
    let skipped = 0
    for (const file of files) {
      const text = await file.text()
      // Try to infer level from filename (e.g. A1_..., B2 ...).
      const lvl = (file.name.match(/\b([ABC][12])\b/i) || [])[1]?.toUpperCase() || ''
      const parsed = parseCsvToCards(text, { level: lvl, deck })
      const res = await importCardsDeduped(parsed)
      added += res.added
      skipped += res.skipped
    }
    notify(`Imported ${added} card${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`)
    if (fileRef.current) fileRef.current.value = ''
    onChanged()
  }

  async function handleAdd(e) {
    e.preventDefault()
    const card = newCard(form, deck)
    if (!card) {
      notify('Enter at least one language.')
      return
    }
    await addCards([card])
    setForm({
      german: '', english: '', urdu: '', topic: form.topic, level: form.level,
      type: isSaetze ? 'sentence' : 'word', lemma: '',
    })
    notify('Card added to Box 1.')
    onChanged()
  }

  async function handleDelete(id) {
    await deleteCard(id)
    onChanged()
  }

  async function handleBackup() {
    const data = await allCards()
    const blob = new Blob([JSON.stringify({ app: 'karteikasten', version: 1, exportedAt: new Date().toISOString(), cards: data }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `karteikasten-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Backed up ${data.length} cards.`)
  }

  async function handleRestore(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const cards = Array.isArray(parsed) ? parsed : parsed.cards
      const n = await restoreCards(cards)
      notify(`Restored ${n} cards from backup.`)
      onChanged()
    } catch {
      notify('Could not read that backup file.')
    }
    if (restoreRef.current) restoreRef.current.value = ''
  }

  async function handleReset() {
    const label = isSaetze ? 'sentence cards' : 'word cards'
    const extra = isSaetze ? ' The daily verb schedule restarts too.' : ''
    if (!confirm(`Send all ${label} back to Box 1? Your review progress will be cleared.${extra}`))
      return
    const n = await resetAllBoxes(deck)
    if (isSaetze) await clearPacer()
    notify(`Reset ${n} cards to Box 1.`)
    onChanged()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards
      .filter((c) => topicFilter === 'all' || c.topic === topicFilter)
      .filter(
        (c) =>
          !q ||
          c.german.toLowerCase().includes(q) ||
          c.english.toLowerCase().includes(q) ||
          c.urdu.includes(query.trim())
      )
      .slice(0, 300)
  }, [cards, query, topicFilter])

  const field = 'w-full rounded-lg border border-ink/15 bg-paper-card px-3 py-2 text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brass/50'

  return (
    <div className="px-4 py-4 max-w-md mx-auto space-y-6">
      {flash && (
        <div className="fixed left-1/2 -translate-x-1/2 top-3 z-50 bg-ink text-paper-card text-sm px-4 py-2 rounded-full shadow-card animate-pop">
          {flash}
        </div>
      )}

      {/* CSV import */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <h2 className="font-display text-xl text-ink mb-1">
          Import CSV → {isSaetze ? 'Sätze' : 'Wörter'}
        </h2>
        <p className="text-sm text-ink-soft mb-3">
          Columns auto-detected (case-insensitive): german/deutsch, english, urdu, topic/category,
          type{isSaetze ? ', lemma/verb' : ''}. Files import into the{' '}
          <strong>{isSaetze ? 'Sätze' : 'Wörter'}</strong> deck. You can select multiple files.
        </p>
        <input ref={fileRef} type="file" accept=".csv" multiple onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 rounded-xl bg-brass text-paper-card font-medium shadow-card active:scale-[0.98] transition"
        >
          Choose CSV file(s)
        </button>
      </section>

      {/* Backup / restore — progress lives only on this device, so keep a copy */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <h2 className="font-display text-xl text-ink mb-1">Backup &amp; restore</h2>
        <p className="text-sm text-ink-soft mb-3">
          Your progress is saved on this device only. Save a backup file to keep it safe or move it
          to another phone.
        </p>
        <input ref={restoreRef} type="file" accept="application/json,.json" onChange={handleRestore} className="hidden" />
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={handleBackup}
            className="py-2.5 rounded-xl bg-ink text-paper-card font-medium shadow-card active:scale-[0.98] transition">
            Save backup
          </button>
          <button onClick={() => restoreRef.current?.click()}
            className="py-2.5 rounded-xl border border-ink/20 text-ink font-medium active:scale-[0.98] transition">
            Restore
          </button>
        </div>
      </section>

      {/* Daily study reminder */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl text-ink">Daily reminder</h2>
          <button
            role="switch"
            aria-checked={reminder.enabled}
            disabled={!remindersOk}
            onClick={() => setReminderEnabled(!reminder.enabled)}
            className={`relative w-12 h-7 rounded-full transition disabled:opacity-40 ${
              reminder.enabled ? 'bg-felt' : 'bg-ink/20'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-paper-card shadow transition-transform ${
                reminder.enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-ink-soft mb-3">
          Get a notification each day to review your due cards.
        </p>
        <label className="flex items-center gap-3">
          <span className="text-sm text-ink-soft">Remind me at</span>
          <input
            type="time"
            value={reminder.time}
            disabled={!remindersOk}
            onChange={(e) => setReminderTime(e.target.value)}
            className={`${field} max-w-[8rem] disabled:opacity-40`}
          />
        </label>
        {!remindersOk && (
          <p className="text-xs text-ink-faint mt-3">
            Scheduled reminders work in the installed app on Android (Chrome). On iPhone,
            the phone's own reminders/alarm app is the reliable option.
          </p>
        )}
      </section>

      {/* Add card */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <h2 className="font-display text-xl text-ink mb-3">
          Add a {isSaetze ? 'sentence' : 'card'}
        </h2>
        <form onSubmit={handleAdd} className="space-y-2.5">
          <input className={field} placeholder="German / Deutsch" value={form.german}
            onChange={(e) => setForm({ ...form, german: e.target.value })} />
          <input className={field} placeholder="English" value={form.english}
            onChange={(e) => setForm({ ...form, english: e.target.value })} />
          <input className={`${field} font-urdu text-right`} dir="rtl" placeholder="اردو" value={form.urdu}
            onChange={(e) => setForm({ ...form, urdu: e.target.value })} />
          {isSaetze && (
            <input className={field} placeholder="Verb / Lemma (e.g. gehen)" value={form.lemma}
              onChange={(e) => setForm({ ...form, lemma: e.target.value })} />
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <input className={field} placeholder="Topic" value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <input className={field} placeholder="Level (A1…)" value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })} />
          </div>
          <select className={field} value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="word">word</option>
            <option value="sentence">sentence</option>
          </select>
          <button type="submit"
            className="w-full py-2.5 rounded-xl bg-ink text-paper-card font-medium shadow-card active:scale-[0.98] transition">
            Add card
          </button>
        </form>
      </section>

      {/* Deck list */}
      <section className="rounded-2xl bg-paper-card/70 ring-1 ring-ink/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-ink">
            {isSaetze ? 'Sätze' : 'Wörter'} · {cards.length}
          </h2>
          <button onClick={handleReset}
            className="text-sm px-3 py-1.5 rounded-lg border border-rust/40 text-rust active:scale-95 transition">
            Reset all boxes
          </button>
        </div>
        <div className="flex gap-2 mb-3">
          <input className={field} placeholder="Search…" value={query}
            onChange={(e) => setQuery(e.target.value)} />
          <select className={`${field} max-w-[45%]`} value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="all">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-ink/10">
          {filtered.map((c) => (
            <li key={c.id} className="py-2.5 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-paper-deep text-ink-soft text-xs font-semibold shrink-0">
                {c.box}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-ink truncate">{c.german || c.english || c.urdu}</div>
                <div className="text-xs text-ink-faint truncate">
                  {c.english}{c.urdu ? ` · ` : ''}<span className="font-urdu">{c.urdu}</span>
                </div>
                <div className="text-[11px] text-brass-deep/70 truncate">
                  {c.level ? `${c.level} · ` : ''}{c.topic}
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)}
                className="text-ink-faint hover:text-rust text-lg px-2 shrink-0" aria-label="delete">
                ✕
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-6 text-center text-ink-faint text-sm">No cards match.</li>
          )}
        </ul>
        {cards.length > filtered.length && (
          <p className="text-center text-xs text-ink-faint mt-3">
            Showing {filtered.length} of {cards.length}. Narrow with search or topic.
          </p>
        )}
      </section>
    </div>
  )
}
