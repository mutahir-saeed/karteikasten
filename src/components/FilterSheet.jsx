import { useMemo, useState } from 'react'
import { DIMENSIONS, countSelected, toggle } from '../lib/facets.js'

// How many chips a dimension shows before it collapses. Wortfamilie has over a
// hundred values and Vorsilbe a long tail of one-offs, so the common ones show
// and the rest hide behind "mehr".
const PREVIEW = 12

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-2.5 py-1 rounded-full text-[13px] border transition active:scale-95 ${
        active
          ? 'bg-brass text-paper-card border-brass shadow-sm'
          : 'bg-paper-card/70 text-ink-soft border-ink/15'
      }`}
    >
      {children}
    </button>
  )
}

function Dimension({ dim, values, selected, onToggle, query }) {
  const [open, setOpen] = useState(false)
  const picked = selected[dim.id] || []
  const filtered = query
    ? values.filter((v) => v.value.toLowerCase().includes(query.toLowerCase()))
    : values
  if (!filtered.length) return null
  const shown = open || query ? filtered : filtered.slice(0, PREVIEW)
  const hidden = filtered.length - shown.length

  return (
    <section className="py-3 border-b border-ink/10 last:border-0">
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="font-display text-base text-ink">{dim.label}</h3>
        {dim.hint && <span className="text-[11px] text-ink-faint">{dim.hint}</span>}
        {picked.length > 0 && (
          <span className="ml-auto text-[11px] text-brass-deep">{picked.length} gewählt</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((v) => (
          <Chip
            key={v.value}
            active={picked.includes(v.value)}
            onClick={() => onToggle(dim.id, v.value)}
          >
            {v.value} <span className="opacity-60 tabular-nums">{v.count}</span>
          </Chip>
        ))}
        {hidden > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 px-2.5 py-1 rounded-full text-[13px] border border-dashed border-ink/25 text-ink-faint"
          >
            +{hidden} mehr
          </button>
        )}
      </div>
    </section>
  )
}

export default function FilterSheet({ index, selected, onChange, onClose, matchCount }) {
  const [query, setQuery] = useState('')
  const dims = useMemo(
    () => DIMENSIONS.filter((d) => index[d.id]?.length),
    [index]
  )
  const total = countSelected(selected)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-paper rounded-t-2xl shadow-card max-h-[85vh] flex flex-col animate-pop">
        <div className="px-4 pt-3 pb-2 border-b border-ink/10">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl text-ink">Filter</h2>
            <span className="text-xs text-ink-faint">
              {matchCount} {matchCount === 1 ? 'Karte' : 'Karten'}
            </span>
            {total > 0 && (
              <button
                onClick={() => onChange({})}
                className="ml-auto text-xs text-margin underline underline-offset-2"
              >
                alle löschen
              </button>
            )}
            <button
              onClick={onClose}
              className={`${total > 0 ? '' : 'ml-auto'} px-3 py-1.5 rounded-lg bg-brass text-paper-card text-sm font-medium`}
            >
              Fertig
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen: nehmen, auf, Geld, Lektion…"
            className="mt-2 w-full rounded-lg border border-ink/15 bg-paper-card/80 px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brass/40"
          />
        </div>
        <div className="overflow-y-auto px-4 pb-6">
          {dims.map((d) => (
            <Dimension
              key={d.id}
              dim={d}
              values={index[d.id]}
              selected={selected}
              query={query}
              onToggle={(dim, val) => onChange(toggle(selected, dim, val))}
            />
          ))}
          {!dims.length && (
            <p className="py-6 text-sm text-ink-faint">
              This deck has no tagged cards yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
