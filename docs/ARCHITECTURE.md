# HomeLedger — How It Works & How the Code Is Structured

HomeLedger is a mobile-first web app that acts as a lifetime service record for a home: projects, costs, documents, and a visual "house view" that doubles as a handoff packet for a future buyer. This doc covers what the app does, how data flows through it, and where to find things in the code.

---

## 1. Product behavior at a glance

| Area | What it does |
|---|---|
| **Onboarding** | Creates the property (address, optional purchase date/price). The app ships pre-seeded with a sample home (123 Main Street, 14 projects); *Settings → Reset* returns to blank onboarding. |
| **Dashboard** | Project count, documented investment, adjusted cost basis, recent projects, and buttons to add a project or open the Home Report. |
| **Add Project** | Title, category, date, cost, notes, an optional **Where in the house** picker (rooms/floors), an optional **Paid with** section (cash, HELOC draw, loan, card, insurance, other), and optional document uploads (photos/PDFs). |
| **Classification flow** | Three one-at-a-time questions, then a suggested classification with a confidence score and plain-language reason. The user can confirm or override. |
| **Project Detail / Timeline** | Per-project view (including funding, which can be added or edited later); a year-grouped history of the whole home. |
| **Funding** | Records HELOC draws (date, institution, amount, note) and ties them to projects. A filterable project list flags which HELOC-funded projects *potentially count* — a reminder, not tax advice. See §5b. |
| **Home Report** | Three tabs: **Overview** (cost basis math, basis-over-time chart, system "ages" snapshot, zip export), **Floors** (pivot-style floor → room → project counts, see §5c), and **House** (isometric layered house + per-floor floorplans drawn from the user's own layouts). |
| **Export** | One `.zip` containing documents in folders, a CSV ledger, a cost-basis summary, and a README. |
| **Settings** | Property info, export, an explanation of how classification works, and reset. |

### Design principles baked into the code
- **Non-judgmental language.** The UI never says "illegal" or "non-compliant." Results are labeled *"AI classification estimate"* and always paired with a disclaimer that the app is not a tax authority, inspector, or legal advisor.
- **The user always overrides.** AI output is a suggestion; the user's choice is stored separately and wins.
- **Projects trump the drawing.** In the House view, the feature checklist only shapes the illustration — any feature implied by a logged project is locked on.
- **No AI APIs.** The "AI" is a local, transparent rule-based scorer (see §3).

---

## 2. Project layout

```
homeledger/
├── index.html              Vite entry HTML
├── package.json            react, react-dom, lucide-react + vite/tailwind tooling
├── vite.config.js
├── tailwind.config.js      scans index.html and src/**/*.{js,jsx}
├── postcss.config.js
├── README.md               setup, Vercel deploy, and phone-install instructions
├── vercel.json             cache headers for sw.js, content-type for the manifest
├── public/                 static files copied to the site root
│   ├── manifest.webmanifest   PWA manifest (name, theme, icons)
│   ├── sw.js                  minimal network-first service worker
│   ├── favicon.svg
│   └── icons/                 app icons (192, 512, maskable, Apple touch, favicon)
├── docs/
│   └── ARCHITECTURE.md     this file
└── src/
    ├── main.jsx            mounts <App /> into #root; registers the service worker in production
    ├── App.jsx             the entire application (≈2,500 lines, see §4)
    └── index.css           Tailwind directives + page backdrop
```

There is no router, no backend, and no state library. `App.jsx` is deliberately a single file for now; §8 describes how to split it.

**Tech:** React 18, Vite, Tailwind CSS 3 (layout/spacing utilities), `lucide-react` (icons). Colors, fonts, and most visual styling are applied through inline `style` objects driven by design-token constants rather than Tailwind config.

---

## 3. Core data model

There are no classes or schemas — everything is plain JS objects held in React state.

**Property**
```js
{ address: "123 Main Street", purchaseDate: "2018-04-01", purchasePrice: "350000" }
```

**Project**
```js
{
  id,                    // crypto.randomUUID()
  title, description,
  date,                  // "YYYY-MM-DD"
  cost,                  // string of digits (parsed with Number() when used)
  category,              // one of CATEGORIES
  documents: [           // see below
    { id, name, type: "PDF" | "Photo" | "File", previewUrl, file }
  ],
  aiClassification: { label, confidence, reason, score },
  userClassification,    // null unless the user overrode the AI label
}
```

- `finalClass(p)` returns `userClassification || aiClassification.label` — this is the single source of truth for "what is this project classified as."
- `isCapital(p)` is true when `finalClass(p) === "Likely Capital Improvement"`.
- `documents[].file` is the real `File` object for uploads made in the current session; seeded demo documents have no `file` and only carry metadata.

**Placement** (on each Project — where in the house the work happened)
```js
{ rooms: [roomId],   // specific rooms the work touched
  floors: [level] }  // "whole floor" placements, with no specific room
```
Both empty ⇒ the project falls back to the floor its category usually lives on (`LEVEL_OF_CATEGORY`) and shows as *Not placed in a room*.

**Layouts** (app-level state; one list of room blocks per floor)
```js
{ "1st": [{ id, name, x, y, w, h }], basement: [...], "2nd": [...], attic: [...], exterior: [...] }
```
Units are grid cells on a 12 × 8 grid. `DEFAULT_LAYOUTS` provides starter rooms (with the bottom two rows left open so *Add a room* works immediately).

**Draw** (a HELOC transaction record — manual entry, a pointer for when you look back at bank documents)
```js
{ id, date: "YYYY-MM-DD", institution, amount, note }   // amount is optional
```

**Funding** (array on each Project; empty by default)
```js
[{ id, source: "cash" | "heloc" | "loan" | "card" | "insurance" | "other",
   drawId,   // heloc entries only — points at a Draw
   amount }] // optional: how much of this source went to this project
```
One draw can fund many projects and one project can use many sources. Amounts are optional so nothing blocks on missing information.

**Categories:** Roof, HVAC, Plumbing, Electrical, Kitchen, Bathroom, Flooring, Windows, Doors, Landscaping, Deck, Patio, Driveway, Other.

---

## 4. `App.jsx` — section-by-section map

The file is organized top to bottom in this order (search for the banner comments to jump around):

| # | Section | Contents |
|---|---|---|
| 1 | **Imports & header comment** | React hooks, `lucide-react` icons. |
| 2 | **Design tokens** | `COLOR` (warm paper ledger palette used by most screens), `BLUE` (navy palette used only by the Home Report), `FONT_IMPORT_URL` (Fraunces / Inter / IBM Plex Mono). |
| 3 | **Data helpers** | `CATEGORIES`, `CATEGORY_PRIOR`, `currency`, `yearOf`, `shortDate`, `finalClass`, `isCapital`, `yearsAgo`. |
| 4 | **Classification engine** | `classifyProject(project, answers)` — see §5. |
| 5 | **Seed data** | `SAMPLE_PROPERTY`, `SAMPLE_PROJECTS` (14 projects, 2019–2026, mixed capital/repair). |
| 6 | **ZIP export** | `crc32`, `buildZip` (hand-written store-only ZIP writer), `buildExportZip`, `downloadBlob` — see §7. |
| 7 | **UI primitives** | `Screen`, `TopRule`, `BigButton`, `Pill`, `Header`, `Field`, `LedgerRow`, `MiniBasisChart`. |
| 8 | **Ledger screens** | `Onboarding`, `Dashboard`, `AddProject`, `ClassifyFlow` + `ResultCard`, `ProjectDetail`, `Timeline`, `SettingsScreen`. |
| 8c | **Floors & rooms** | Layout logic (`clampRect`, `collides`, `findFreeSpot`), `DEFAULT_LAYOUTS`, `projectPlacements`, `buildPivot`, `FloorsPivot`, `LayoutEditor`, `LocationEditor` — see §5c. |
| 8b | **Funding** | Helpers (`helocStatus`, `drawAllocated`, …), seed draws, `DrawForm`, `FundingEditor`, `FundingList`, `FundingScreen` — see §5b. |
| 9 | **House View** | Themes, feature logic, hotspot map, geometry, `IsoHouse`, floorplans, checklist, bottom sheet, `HouseView` — see §6. |
| 10 | **Home Report** | `ReportOverview` (cost basis, chart, export) and `HomeReport` (Overview/House tabs). |
| 11 | **Navigation** | `BottomNav`. |
| 12 | **Root `App`** | State, screen switching, export handler. |

### Root state and navigation (`App`)

```js
const [property, setProperty]     // null → shows Onboarding
const [projects, setProjects]     // array of Project
const [screen, setScreen]         // "dashboard" | "add" | "classify" | "detail" | "report" | "timeline" | "settings" | "funding"
const [draft, setDraft]           // in-progress project between Add and Classify
const [selectedId, setSelectedId] // which project Detail shows
const [exportState, setExportState] // "idle" | "working" | "done" | "error"
const [draws, setDraws]       // array of Draw (HELOC transactions)
const [detailFrom, setDetailFrom] // which screen Project Detail returns to
const [layouts, setLayouts]   // floor layouts (see §5c)
const [manualFeatures, setManualFeatures] // House checklist state, shared by Floors + House tabs
const [reportTab, setReportTab] // "overview" | "floors" | "house" — kept in App so it survives opening a project
const [pivotOpen, setPivotOpen] // which pivot rows are expanded — also kept in App
```
`screen` also includes `"funding"`.

Navigation is just `setScreen(...)` plus a conditional render. The bottom nav shows on `dashboard`, `timeline`, `settings`, and `report`; it hides during the add/classify/detail flows.

**Add-project flow:** `AddProject` → `onNext(draft)` → `ClassifyFlow` → on confirm, builds the new project (`aiClassification` + `userClassification`, which is stored only if it differs from the AI label) and prepends it to `projects`.

The outer frame is `width: 100%; max-width: 390px; height: 100dvh; max-height: 780px` so it fills a phone screen and appears as a centered phone-sized column on desktop.

---

## 5. The rule-based classification engine

`classifyProject({ category, cost }, answers)` produces a **0–100 score** where higher means "leans capital improvement." It starts at 50 (ambiguous) and adjusts:

| Signal | Effect on score |
|---|---|
| Q1 "Beyond original condition?" — Yes / No | +22 / −22 |
| Q1 — Not sure | no score change; adds 20 points of *uncertainty* |
| Q2 — Added new / Replaced existing | +14 / −6 |
| Q3 — Part of larger renovation: Yes / No | +14 / −4 |
| Category prior (`CATEGORY_PRIOR`) | small nudge, e.g. Kitchen +10, Plumbing −6 |
| Cost ≥ $5,000 | +10 |
| Cost $1–$499 | −10 |

The score is clamped to 0–100, then mapped to a label:

- **≥ 62** → *Likely Capital Improvement*
- **≤ 38** → *Likely Repair / Maintenance*
- otherwise → *Unclear — worth a closer look*

**Confidence** = `|score − 50| × 1.9`, minus any uncertainty, clamped to 5–97 (and capped at 55 for "Unclear"). A short **reason** string is assembled from the top two contributing factors in neutral language.

Because it is one pure function with a stable return shape (`{ label, confidence, reason, score }`), it can later be replaced by an LLM call without touching any UI.

### Cost basis math
```
adjusted basis = purchasePrice + Σ cost of projects where isCapital(p)
```
Repairs/maintenance are excluded. The UI labels this an estimate and recommends a tax professional confirm what qualifies. "Documented investment" is the separate, simpler total of *all* project costs.

---

## 5b. Funding & the HELOC flag

**Principle: funding never affects classification.** How a project was paid for doesn't change whether it's a capital improvement, so `classifyProject` is untouched and never reads `funding`. Funding only drives a separate, derived flag.

`helocStatus(project)` returns one of:

| Status | Meaning | Label shown |
|---|---|---|
| `none` | No HELOC draw is tied to the project | *(no flag)* |
| `potential` | HELOC-funded **and** `isCapital(project)` | **Potentially counts** |
| `review` | HELOC-funded, but classified as repair/maintenance or unclear | **Worth a closer look** |

The flag is deliberately soft: it's a reminder for the user to look closer, always accompanied by wording that it isn't tax advice and that a tax professional can confirm what qualifies.

**Where funding is entered**
- *Add Project → "Paid with"* — toggle sources; choosing HELOC shows existing draws (select one or more, with an optional amount each) and a **New draw** inline form.
- *Project Detail → Funding → Add/Edit* — the same `FundingEditor`, so seeded or older projects can be tied to a draw later.
- *Funding screen → HELOC draws → Add a draw* — create, edit, or remove a draw. Removing a draw also unlinks it from every project (`deleteDraw` in `App`).

**The Funding screen** (Dashboard → *Funding & HELOC*)
- Summary: draws recorded and total; how many projects potentially count and the amount tied from draws.
- **Projects tab** with filter chips: All · HELOC-funded · Potentially counts · Worth a closer look · No HELOC.
- **HELOC draws tab**: each draw shows date, amount, its note, linked projects, and a neutral allocation line — "$X not yet tied to a project", "Fully tied to projects", or "Tied amounts are $X over this draw — worth a double-check." Nothing is flagged as wrong.

Because the Project Detail screen can now be reached from the Funding screen, `openProject(id)` records `detailFrom` and Back returns to wherever you came from.

---

## 5c. Floors, rooms & the pivot report

**Why:** the isometric house shows *what kind* of work happened; the Floors tab answers *where* and *how much*. It is built like a pivot table: rows group by floor, expand into rooms, and expand again into the projects behind each number.

**Placement model.** `projectPlacements(project, layouts)` returns every place a project shows up (`[{ level, roomId | null }]`), always at least one: its `rooms`, plus any "whole floor" `floors`, or — if neither is set — the inferred category default. A project that touches several rooms is counted in each.

**The pivot** (`buildPivot` → `FloorsPivot`):

| Row | Projects | Spend |
|---|---|---|
| Whole house | distinct projects | sum of all project costs (matches *Documented investment*) |
| Floor | distinct projects on that floor | cost share on that floor |
| Room | projects tied to that room | cost share in that room |
| *Not placed in a room* | projects on the floor with no room | cost share |

A project's cost is **split evenly across its placements**, so every level adds up to the whole house; the UI footnotes this and shows "of $X" on shared lines. Because a project can span floors, floor counts may sum to more than the whole-house count. Rooms with no projects stay visible (dimmed) so gaps are easy to spot. Tapping a project opens it; Back returns to the same tab with the same rows expanded.

**Laying out a floor** (`LayoutEditor`, opened from *Floors → Edit {floor} layout* or *House → Floorplan → Edit layout*): blocks snap to the grid. Tap to select, drag to move, drag the gold corner to resize, or use the width/height/move buttons for precision. Blocks can't overlap or leave the grid (`clampRect` + `collides`). *Add a room* drops a block in the first free spot (`findFreeSpot`); a room can be renamed, removed, or the floor reset to the starter layout. Removing a room never loses a project: anything tied only to that room stays on the floor as a "whole floor" placement.

**Tying projects to rooms:** *Add Project → Where in the house* and *Project Detail → Where in the house → Edit* both use `LocationEditor` (pick rooms per floor, or "Whole floor"). Choosing a room clears that floor's "Whole floor" and vice versa.

**Knock-on effects.** The House tab's floorplan now renders the user's layout (cropped to its rooms) and counts from placements, and the feature checklist's "locked on" logic follows placements (a project placed in a basement room keeps the basement on). The isometric hotspots are still keyed by *category*, not by room.

---

## 6. The House View (isometric + floorplan)

Rendered inside the Home Report's **House** tab by `HouseView({ projects })`. It is entirely driven by the real `projects` array.

### Controls (kept compact so the drawing dominates the screen)
- **Theme:** `Dark` (anatomy-style) or `Sketch` (light, muted 3D model look) — both are first-class options defined in `HOUSE_THEMES`.
- **Mode:** isometric layers vs. floorplan.
- **Layer tabs** (isometric mode): Structural / Systems / Cosmetic.
- **Gear icon:** opens the feature checklist overlay.

### Category → layer / level mapping
Two lookup tables turn each project's `category` into placement:

- `LAYER_OF_CATEGORY` — which layer tab it appears under (e.g. Roof → structural, HVAC → systems, Kitchen → cosmetic).
- `LEVEL_OF_CATEGORY` — which floor it belongs to (e.g. HVAC → basement, Bathroom → 2nd, Roof → attic; Driveway/Landscaping → exterior).

### Feature checklist & "projects trump the drawing"
Features: `basement`, `secondFloor`, `attic`, `frontYard`, `backYard`, `driveway`, `deck`.

```
effective feature = manualCheckbox || impliedByProjects
```

`computeImpliedFeatures(projects)` turns on any feature a project requires (a basement-level project implies a basement; a Deck project implies a deck; etc.). Implied features render as **locked-on** checkboxes with an explanation. The drawing therefore can never contradict the record.

### Isometric drawing
- The house is a **fixed generic shape** on purpose — it's meant to read as "a house," never "*my* house."
- `buildHouseGeometry(features)` returns the band positions. Basement, 1st, and 2nd floor bands have fixed y-ranges and are simply shown or hidden; **only the roof moves** (it sits on whichever floor is topmost, and is taller with an attic than without).
- Faces are drawn as SVG polygons using a constant depth offset (`HDX`, `HDY`) to fake the receding side wall.
- **Hotspots** (`CATEGORY_HOTSPOTS`) are fixed-coordinate tap points per category, grouped by layer. A hotspot renders only if (a) its required feature is on and (b) at least one project exists in that category. Tapping opens `HouseBottomSheet` listing every project in that category, newest first.
- Floor labels on the left edge jump straight to that level's floorplan.

### Floorplans
`HOUSE_FLOORPLANS` defines simple rectangles per level (basement, 1st, 2nd, attic, exterior), each tagged with the **categories** it contains. Rooms with projects are shaded and show a count; tapping a room opens the same bottom sheet. Level tabs only appear for levels that exist under the current feature set.

---

## 7. Export (ZIP) implementation

No zip library is used. `buildZip(entries)` is a small hand-written **store-only (uncompressed)** ZIP writer: CRC-32 table, local file headers, central directory, end-of-central-directory record. The output is a standard ZIP any OS can open.

`buildExportZip(property, projects)` assembles:

```
Documents/{category}/{date}_{project-title}/{file}
project-ledger.csv          all projects, costs, classifications, notes
cost-basis-summary.txt      the adjusted-basis math in plain language
README.txt                  what's in the package
```

- Uploaded files from the current session are included with **real bytes** (`await doc.file.arrayBuffer()`).
- Seeded demo documents have no real file, so a clearly labeled `*.NOTE.txt` placeholder is written instead.
- Projects with no documents get a `.keep` note so the folder still appears.
- `downloadBlob` triggers the browser download via a temporary object URL.

The export is reachable from both **Settings** and the Home Report **Overview** tab.

---

## 8. Known limitations & suggested next steps

1. **No persistence.** All state (property, projects, uploaded files) lives in React memory and resets on refresh. Outside the chat sandbox, `localStorage` is fine for metadata; **IndexedDB** is the right home for document bytes.
2. **House View UI state resets** each time the report is opened (theme, mode, checklist) because that state is local to `HouseView`. Lift it into `App` (or persist it) if it should stick.
3. **Isometric hotspots are still category-based** (e.g. Bathroom pins sit on the 2nd floor). Floorplans and the Floors pivot use real room placements, so a 1st-floor half-bath is handled there; the isometric pin is the remaining approximation. Layouts have no persistence yet, so they reset on refresh with everything else.
4. **`yearsAgo` uses a fixed reference date** (`2026-07-09`) for the "last touched N years ago" snapshot. Swap to `new Date()` for production.
5. **Object URLs for image previews are never revoked** — fine for a session, worth cleaning up once persistence exists.
6. **Single-file app.** Suggested split when the product direction settles:
   ```
   src/
   ├── lib/        classifyProject, houseFeatures, zipExport, format helpers
   ├── data/       seed data, category/level/hotspot maps
   ├── components/ primitives (Screen, BigButton, Pill, …)
   └── screens/    Dashboard, AddProject, ClassifyFlow, HomeReport, HouseView, …
   ```
7. **Funding data isn't in the export yet.** The zip's `project-ledger.csv` doesn't include funding columns, and draws aren't exported. Adding a funding column plus a `heloc-draws.csv` is a small follow-up.
8. **Draws created mid-flow persist.** A draw added from inside Add Project is saved immediately; if the user then cancels the project, the draw remains (and shows as untied on the draws tab).
9. **Future (intentionally not built):** OCR receipt scanning, email/bank/retail imports, warranty reminders, insurance and tax-basis reports, rental-conversion tracking, user accounts. The classification function and project model are the main seams for these.

---

## 9. Quick reference — "where do I change X?"

| I want to… | Look at |
|---|---|
| Tune how projects are scored | `classifyProject`, `CATEGORY_PRIOR` |
| Change the three questions | `QUESTIONS` array |
| Add a project category | `CATEGORIES`, `CATEGORY_PRIOR`, `LAYER_OF_CATEGORY`, `LEVEL_OF_CATEGORY`, `CATEGORY_HOTSPOTS`, and a room in `HOUSE_FLOORPLANS` |
| Move a tap point on the house | `CATEGORY_HOTSPOTS` (x/y in the 420×360 SVG viewBox) |
| Add a house feature (e.g. garage) | `FEATURE_LABEL`, `FEATURE_GROUPS`, `DEFAULT_MANUAL_FEATURES`, `computeImpliedFeatures`, `IsoHouse` drawing |
| Restyle the ledger screens | `COLOR` tokens; report/house colors live in `BLUE` and `HOUSE_THEMES` |
| Change what's in the export zip | `buildExportZip` (floor/room placement isn't exported yet) |
| Change the starter floorplans | `DEFAULT_LAYOUTS` (and the matching `rooms: [...]` ids in `SAMPLE_PROJECTS`) |
| Change the grid size | `GRID_COLS`, `GRID_ROWS`, `CELL` |
| Change how pivot spend is shared across rooms | `buildPivot` |
| Change the sample data | `SAMPLE_PROPERTY`, `SAMPLE_PROJECTS`, `SAMPLE_DRAWS` |
| Change what counts as "potentially counts" | `helocStatus` |
| Add a funding source type (e.g. 401k loan) | `FUNDING_SOURCES` |
| Change draw fields | `DrawForm`, the draw shape in `SAMPLE_DRAWS`, and the draw card in `FundingScreen` |
