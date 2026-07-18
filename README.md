# HomeLedger

A digital lifetime record for your home — projects, maintenance, receipts,
photos, and warranties, organized by category and floor, with a local
rule-based engine that suggests whether a project is a capital improvement
or routine maintenance (no AI API calls).

This is the MVP milestone: property + project tracking, the swipe-style
classification flow, a timeline, a Home Report (cost basis + an isometric
"House View" you can explore by layer or floorplan), and a zip export of
documents/ledger/summary.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

The build output goes to `dist/`.

## Deploy to Vercel

**Option A — via GitHub (recommended)**
1. Push this folder to a new GitHub repo.
2. In Vercel, click **Add New → Project**, import that repo.
3. Vercel auto-detects Vite. Leave the defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy.

**Option B — Vercel CLI**
```bash
npm install -g vercel
vercel        # first deploy, follow the prompts
vercel --prod # subsequent production deploys
```

No environment variables are required — there's no backend and no AI API
calls in this milestone.

## Project structure

```
homeledger/
├── index.html            Vite entry HTML
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx           Mounts <App /> into #root
    ├── App.jsx            The entire app (screens, classification engine,
    │                       house view, export logic) — this is the same
    │                       component you've been testing as an artifact
    └── index.css          Tailwind directives + page backdrop
```

`App.jsx` is intentionally still one file for now, matching what's been
tested — splitting it into `components/`, `lib/`, etc. is a reasonable
next step once the product direction stops moving.

## Known limitations to plan for next

- **No persistence yet.** State (property, projects, documents) lives only
  in memory and resets on refresh. This was a constraint of testing inside
  the chat artifact sandbox — outside that sandbox, `localStorage` or
  `IndexedDB` both work fine and would be the natural next addition.
- **Bathroom projects assume the 2nd floor** in the House View / floorplan
  placement logic — there's no concept of a 1st-floor powder room yet.
- **Document uploads aren't persisted** across a reload for the same
  reason as above — the zip export captures real bytes for anything
  uploaded in the current session, but a refresh loses them.
- Still no AI APIs — classification is a local, transparent rule-based
  scorer (`classifyProject` in `App.jsx`). Swapping in an LLM later is a
  drop-in replacement for that one function.
