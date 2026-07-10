# Karteikasten 🗃️

A trilingual **German / English / Urdu** vocabulary trainer using the **Leitner box**
spaced-repetition system. Installable as a PWA on your phone, works fully offline.

## Features

- **Leitner boxes 1–5** — correct answer promotes a card, wrong answer resets it to Box 1.
  Review intervals: 1, 2, 4, 8, 16 days.
- **Auto-loaded decks** — every CSV under `src/decks/A1` and `src/decks/A2` is bundled and
  seeded into the on-device database on first launch (2200+ cards, 28 topics).
- **Swipe to grade** — tap a card to reveal the other two languages, then
  **swipe left = correct**, **swipe right = wrong** (or use the buttons).
- **Direction modes** — DE→EN/UR, EN/UR→DE, EN→DE, UR→DE, or Mixed.
- **Filters** — study by level (A1/A2) and topic.
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

## Tech

React + Vite · Tailwind CSS · PapaParse · Dexie (IndexedDB) · vite-plugin-pwa
