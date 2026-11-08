// Facet model for the card catalog.
//
// A verb is never just one thing: `anfangen` is trennbar, carries the prefix
// an-, is strong with the pattern a → ie → a, belongs to the word family
// fangen and to the meaning field "Anfangen und aufhören". The deck CSVs carry
// all of that in a `Tags` column of `dimension:value` pairs; this module turns
// it into a filter model. Selections are OR inside one dimension and AND
// across dimensions, so "trennbar + untrennbar, prefix auf-" means
// "either structure, as long as the prefix is auf-".

// Display order matters: the two that make things easiest to memorise come
// first, because grouping by meaning or by root is the whole point.
export const DIMENSIONS = [
  { id: 'feld', label: 'Bedeutungsfeld', hint: 'same meaning, learned together' },
  { id: 'familie', label: 'Wortfamilie', hint: 'same root verb' },
  { id: 'lektion', label: 'Lektion', hint: 'Kurs DaF B1, chapter by chapter' },
  { id: 'struktur', label: 'Struktur' },
  { id: 'vorsilbe', label: 'Vorsilbe' },
  { id: 'praep', label: 'Präposition' },
  { id: 'fall', label: 'Fall' },
  { id: 'muster', label: 'Vokalmuster' },
  { id: 'perfekt', label: 'Perfekt mit' },
  { id: 'wortart', label: 'Wortart' },
  { id: 'wortfeld', label: 'Wortfeld' },
  { id: 'thema', label: 'Thema' },
  { id: 'stufe', label: 'Stufe' },
  { id: 'quelle', label: 'Quelle' },
]

export const DIM_LABEL = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.label]))

// "struktur:trennbar;vorsilbe:ab" -> { struktur: ['trennbar'], vorsilbe: ['ab'] }
export function parseTags(raw) {
  const out = {}
  if (!raw) return out
  for (const part of String(raw).split(';')) {
    const i = part.indexOf(':')
    if (i < 1) continue
    const dim = part.slice(0, i).trim()
    const val = part.slice(i + 1).trim()
    if (!dim || !val) continue
    if (!out[dim]) out[dim] = []
    if (!out[dim].includes(val)) out[dim].push(val)
  }
  return out
}

// Which values exist in this card set, and how many cards each one covers.
// Sorted by count so the prefixes you actually meet (ab-, an-, auf-) come
// before the one-offs (durcheinander-, zurecht-).
export function buildIndex(cards) {
  const index = {}
  for (const card of cards) {
    const f = card.facets
    if (!f) continue
    for (const dim of Object.keys(f)) {
      if (!index[dim]) index[dim] = new Map()
      for (const val of f[dim]) index[dim].set(val, (index[dim].get(val) || 0) + 1)
    }
  }
  const out = {}
  for (const dim of Object.keys(index)) {
    out[dim] = [...index[dim].entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'de'))
  }
  return out
}

// OR within a dimension, AND across dimensions.
export function matches(card, selected) {
  for (const dim of Object.keys(selected)) {
    const want = selected[dim]
    if (!want || !want.length) continue
    const have = card.facets?.[dim]
    if (!have || !want.some((v) => have.includes(v))) return false
  }
  return true
}

export function countSelected(selected) {
  return Object.values(selected).reduce((n, v) => n + (v?.length || 0), 0)
}

export function toggle(selected, dim, value) {
  const cur = selected[dim] || []
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
  const out = { ...selected }
  if (next.length) out[dim] = next
  else delete out[dim]
  return out
}
