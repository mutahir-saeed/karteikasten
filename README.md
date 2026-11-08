# Karteikasten 🗃️

A trilingual **German / English / Urdu** vocabulary trainer using the **Leitner box**
spaced-repetition system. Installable as a PWA on your phone, works fully offline.

## Features

- **Leitner boxes 1–5** — correct answer promotes a card, wrong answer resets it to Box 1.
  Review intervals: 1, 2, 4, 8, 16 days.
- **Auto-loaded decks** — every CSV under `src/decks/<LEVEL>` is bundled and seeded
  into the on-device database on first launch (1,930 B1 cards). New deck files
  added by an app update are synced in on next launch without touching your
  progress, and cards merge by German word, so one word is always one card.
- **Archive** — the A1 and A2 decks were retired in favour of B1. On a phone that
  already had them, their cards are archived rather than deleted: boxes and due
  dates are kept, and **Manage → Archiv** restores or clears them. A word that
  also appears in the B1 deck simply carries its old progress over.
- **Swipe to grade** — tap a card to reveal the other two languages, then
  **swipe left = correct**, **swipe right = wrong** (or use the buttons).
- **Direction modes** — DE→EN/UR, EN/UR→DE, EN→DE, UR→DE, or Mixed.
- **Filters** — study by topic, plus **facet filters**: a verb
  carries every group it belongs to at once (`anfangen` is trennbar, prefix an-,
  strong with the pattern a → ie → a, word family *fangen*, meaning field
  *Anfangen und aufhören*), and the filter sheet combines them — OR inside a
  dimension, AND across dimensions.
- **Grouped learning** — the B1 deck is tagged by **Bedeutungsfeld** (55 meaning
  fields), **Wortfamilie** (103 root families), Struktur, Vorsilbe, Präposition +
  Fall, Vokalmuster, Perfekt mit haben/sein, Stufe and **Lektion**, so a session
  can be "all 17 verbs built on *nehmen*" or "Kurs DaF Lektion 4".
- **Stats** — cards per box, due-today count, mastered count, and a "words to watch" list.
- **Backup & restore** — export/import your progress as a JSON file.
- **Offline PWA** — the whole app and your deck work with no internet after first load.

## How your data is stored

- The **vocabulary** is baked into the app — it always reloads, you can't lose it.
- Your **progress** (box, due dates, stats) is stored in **IndexedDB on your device**.
  It is never uploaded anywhere; it survives restarts and works offline. It does **not**
  sync between devices. Use **Manage → Save backup** to keep a copy.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Regenerate app icons after changing the design: `npm run icons`.

## Deploy to Vercel

1. Push this repo to GitHub (already done).
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**.
3. Import the `karteikasten` repo. Vercel auto-detects **Vite**
   (build: `npm run build`, output: `dist`) — just click **Deploy**.
4. Open the resulting URL on your phone → browser menu → **Add to Home Screen**.

Every `git push` to `main` redeploys automatically.

## Deck format

`German,English,Urdu,Category,Tags,Forms,Note` (Sätze files use
`German,English,Urdu,Category,Lemma,Type`). `Category` is the meaning field and
feeds the topic dropdown; `Tags` is a `;`-separated list of `dimension:value`
pairs and feeds the filter sheet; `Forms` holds Präteritum and Partizip II.
Dimensions are defined in `src/lib/facets.js`.

## Tech

React + Vite · Tailwind CSS · PapaParse · Dexie (IndexedDB) · vite-plugin-pwa
