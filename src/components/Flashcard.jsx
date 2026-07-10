import { useEffect, useRef, useState } from 'react'
import { intervalLabel } from '../lib/leitner.js'

const LANG_META = {
  de: { label: 'Deutsch', dir: 'ltr', cls: 'font-display' },
  en: { label: 'English', dir: 'ltr', cls: 'font-sans' },
  ur: { label: 'اردو', dir: 'rtl', cls: 'font-urdu' },
}

const FIELD = { de: 'german', en: 'english', ur: 'urdu' }

// Resolve which languages sit on the front vs. back for a given card + mode.
export function facesForCard(card, mode) {
  let frontLangs
  if (mode === 'de') frontLangs = ['de']
  else if (mode === 'en') frontLangs = ['en']
  else if (mode === 'ur') frontLangs = ['ur']
  else if (mode === 'enur') frontLangs = ['en', 'ur']
  else {
    // mixed: deterministic per-card random front language
    const langs = ['de', 'en', 'ur']
    const seed = [...card.id].reduce((a, c) => a + c.charCodeAt(0), 0)
    frontLangs = [langs[seed % 3]]
  }
  const backLangs = ['de', 'en', 'ur'].filter((l) => !frontLangs.includes(l))
  return { frontLangs, backLangs }
}

function LangLine({ lang, text, big }) {
  const meta = LANG_META[lang]
  if (!text) {
    return (
      <div className="text-ink-faint text-sm italic" dir={meta.dir}>
        — {meta.label} —
      </div>
    )
  }
  return (
    <div dir={meta.dir} className={`${meta.cls} ${meta.dir === 'rtl' ? 'text-right' : ''}`}>
      <div className="text-[11px] uppercase tracking-widest text-brass-deep/70 mb-1">
        {meta.label}
      </div>
      <div
        className={`${big ? 'text-3xl sm:text-4xl' : 'text-2xl'} leading-snug text-ink ${
          lang === 'ur' ? 'leading-[2]' : ''
        }`}
      >
        {text}
      </div>
    </div>
  )
}

const SWIPE_THRESHOLD = 110

export default function Flashcard({ card, mode, onAnswer }) {
  const [revealed, setRevealed] = useState(false)
  const [drag, setDrag] = useState(0)
  const [leaving, setLeaving] = useState(null) // 'left' | 'right' | null
  const startX = useRef(null)
  const startY = useRef(null)
  const dragging = useRef(false)

  // Reset per card.
  useEffect(() => {
    setRevealed(false)
    setDrag(0)
    setLeaving(null)
  }, [card.id])

  const { frontLangs, backLangs } = facesForCard(card, mode)

  function commit(correct) {
    setLeaving(correct ? 'left' : 'right')
    // let the fly-off animation play, then report
    setTimeout(() => onAnswer(correct), 220)
  }

  function onPointerDown(e) {
    if (!revealed || leaving) return
    dragging.current = true
    startX.current = e.clientX
    startY.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    // ignore mostly-vertical gestures (let the page scroll)
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 12) return
    setDrag(dx)
  }
  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (drag <= -SWIPE_THRESHOLD) commit(true) // swipe LEFT = correct
    else if (drag >= SWIPE_THRESHOLD) commit(false) // swipe RIGHT = wrong
    else setDrag(0)
  }

  // Visual state derived from drag / leaving.
  const dir = leaving === 'left' ? -1 : leaving === 'right' ? 1 : Math.sign(drag)
  const offset = leaving ? dir * 520 : drag
  const rotate = leaving ? dir * 18 : drag / 22
  const intent = drag <= -40 ? 'correct' : drag >= 40 ? 'wrong' : null
  const overlayOpacity = Math.min(Math.abs(drag) / SWIPE_THRESHOLD, 1)

  return (
    <div className="relative w-full max-w-md mx-auto select-none no-select">
      {/* Meta row: box + interval */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brass text-paper-card font-semibold text-sm shadow-sm">
            {card.box}
          </span>
          <span className="text-ink-faint">Box {card.box} · {intervalLabel(card.box)}</span>
        </span>
        <span className="text-xs uppercase tracking-widest text-brass-deep/80">
          {card.level ? `${card.level} · ` : ''}{card.type}
        </span>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => !dragging.current && Math.abs(drag) < 6 && setRevealed((r) => !r)}
        className="relative cursor-pointer touch-pan-y"
        style={{
          transform: `translateX(${offset}px) rotate(${rotate}deg)`,
          transition: leaving || drag === 0 ? 'transform 0.22s cubic-bezier(0.2,0.7,0.2,1)' : 'none',
        }}
      >
        {/* The index card */}
        <div className="relative overflow-hidden rounded-2xl bg-paper-card shadow-card ring-1 ring-ink/10 min-h-[19rem] flex">
          {/* red margin line */}
          <div className="absolute top-0 bottom-0 left-10 w-px bg-margin/70" />
          {/* punch hole (catalog card) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-paper-deep ring-1 ring-ink/10 shadow-inner" />

          {/* ruled lines */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 33px, rgba(201,191,166,0.9) 33px 34px)',
              backgroundPosition: '0 22px',
            }}
          />

          <div className="relative flex-1 pl-16 pr-6 py-8 flex flex-col justify-center gap-5">
            {!revealed ? (
              <>
                {frontLangs.map((l) => (
                  <LangLine key={l} lang={l} text={card[FIELD[l]]} big />
                ))}
                <div className="mt-2 text-xs text-ink-faint tracking-wide">tap to reveal</div>
              </>
            ) : (
              <div className="animate-pop flex flex-col gap-4">
                {frontLangs.map((l) => (
                  <LangLine key={l} lang={l} text={card[FIELD[l]]} />
                ))}
                <div className="h-px bg-rule/80 my-1" />
                {backLangs.map((l) => (
                  <LangLine key={l} lang={l} text={card[FIELD[l]]} big />
                ))}
              </div>
            )}
          </div>

          {/* swipe intent overlays */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none flex items-start justify-between p-5"
            style={{ opacity: overlayOpacity }}
          >
            {intent === 'correct' && (
              <span className="rotate-[-12deg] border-4 border-felt text-felt font-display font-bold text-2xl px-3 py-1 rounded-lg bg-paper-card/80">
                RICHTIG
              </span>
            )}
            <span className="flex-1" />
            {intent === 'wrong' && (
              <span className="rotate-[12deg] border-4 border-rust text-rust font-display font-bold text-2xl px-3 py-1 rounded-lg bg-paper-card/80">
                NOCHMAL
              </span>
            )}
          </div>
          {intent && (
            <div
              className={`absolute inset-0 rounded-2xl pointer-events-none ${
                intent === 'correct' ? 'bg-felt/15' : 'bg-rust/15'
              }`}
              style={{ opacity: overlayOpacity }}
            />
          )}
        </div>
      </div>

      {/* Grade buttons (always available once revealed) */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          disabled={!revealed}
          onClick={() => commit(true)}
          className="flex flex-col items-center gap-0.5 py-3 rounded-xl bg-felt text-paper-card font-medium shadow-card disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition"
        >
          <span className="text-base">✓ Know it</span>
          <span className="text-[11px] opacity-80">swipe left</span>
        </button>
        <button
          disabled={!revealed}
          onClick={() => commit(false)}
          className="flex flex-col items-center gap-0.5 py-3 rounded-xl bg-rust text-paper-card font-medium shadow-card disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition"
        >
          <span className="text-base">✗ Don't know</span>
          <span className="text-[11px] opacity-80">swipe right</span>
        </button>
      </div>
      {!revealed && (
        <p className="text-center text-xs text-ink-faint mt-3">
          Reveal the answer before grading.
        </p>
      )}
    </div>
  )
}
