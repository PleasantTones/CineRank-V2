# CineRank v2

Fantasy Box Office ELO ranking app for Gabe, Jordan, Justin, Nate, and Tyler.

## Stack
- **Vite + React 18** — fast builds, HMR in dev
- **Tailwind CSS 3** — design token system
- **Framer Motion** — page transitions, micro-animations
- **Zustand** — global state with localStorage persistence
- **Supabase** — ratings, matchups, chat, arcade scores
- **React Router v6** — client-side routing

## Local Development

```bash
npm install
npm run dev       # → http://localhost:5173
```

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import in Vercel → it auto-detects Vite
3. No environment variables needed (credentials embedded)
4. Every push to `main` auto-deploys

## Build

```bash
npm run build     # → dist/ folder
npm run preview   # preview the production build locally
```

## Project Structure

```
src/
├── components/
│   ├── Arcade/       # 4 canvas-based arcade games
│   ├── Layout/       # Header, BottomNav, PlayerSelect
│   ├── UI/           # Toast, Confetti, MovieModal, Skeleton, ErrorBoundary
│   └── Vote/         # MatchupStats, SwipeCard
├── lib/              # supabase.js, elo.js, movies.js, sounds.js, shareCard.js
├── pages/            # Vote, Leaderboard, MyMovies, Friends, Arcade, Hall
└── store/            # useStore.js (Zustand)
```

## Supabase Tables

| Table | Description |
|-------|-------------|
| `ratings` | Per-player ELO ratings for each movie |
| `matchups` | Head-to-head vote history |
| `chat` | Group chat messages |
| `arcade_scores` | High scores per game per player |
