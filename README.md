# Badminton Match Coach PWA

An **eyes-free, real-time badminton match tracker and tactical shot analysis Progressive Web App (PWA)** for **Singles** and **Doubles**, built with official **BWF scoring, service-box parity, rotation, and change-of-ends rules**.

---

## Key Features

### 1. Pre-Match Setup, Disciplines & Age Categories
- **Match Information**: Configure optional **Tournament / Competition Name**, **Match Name / Round**, **Court Name**, and optional **Umpire Name** (all shown in match headers, court surround, analysis, and JSON export).
- **5 Standardized International BWF Disciplines** (always using international codes `MS`, `WS`, `MD`, `WD`, `XD` with full written-out names in the active language, so `XD` is unambiguously Mixed Doubles across all languages):
  - **MS** (*Men's Singles* / *Herrsingel*)
  - **WS** (*Women's Singles* / *Damsingel*)
  - **MD** (*Men's Doubles* / *Herrdubbel*)
  - **WD** (*Women's Doubles* / *Damdubbel*)
  - **XD** (*Mixed Doubles* / *Mixeddubbel*)
- **Age Categories (Standard International Codes + Localized Labels)**:
  - **Open / Senior**: Open class without age prefix (e.g., `MS`, `XD`).
  - **Junior (`U`)**: `U11`, `U13`, `U15`, `U17`, `U19`, `U22`, `U23` (formatted e.g. `U17 MS`).
  - **Veteran / Masters (`+`)**: 5-year intervals from `35+` up to `80+` (`35+`, `40+`, `45+`, `50+`, `55+`, `60+`, `65+`, `70+`, `75+`, `80+`, formatted e.g. `XD 45+`).
- **Players & Teams**: Configure 2 or 4 players with **Name**, **Club**, and 3-letter **Nationality** codes.
- **Official BWF Rule Presets & Custom Caps**:
  - Match length: Best of 1 (`1`), Best of 3 (`2`), or Best of 5 (`3`).
  - Scoring presets: **21 / 30**, **15 / 21**, **11 / 15**, or custom points-per-game and win-by-2 cap.
  - **International Intervals & Change of Ends (BWF)**: Toggleable rule preset (enabled by default) configuring **60s mid-game intervals** at the half-way point (`Math.ceil(pointsPerGame / 2)`, e.g. 11 pts) and **120s between-game intervals**.
- **Toss & Starting Lineup**:
  - Choose first serving side and swap starting court ends.
  - Assign right/left service box occupants at `0–0` in Doubles with a live **Starting Court Preview**.
- **Setup Draft & Match Archive**: Persists in-progress setup forms automatically and archives up to **20 recent matches** in `localStorage`.

### 2. Full-Screen Eyes-Free Court Interface (4+ Taps/Sec)
- **100% Responsive Orientation**: Automatically renders an official **1340 cm × 610 cm** BWF court horizontally in landscape and rotated 90° clockwise in portrait, with aspect-ratio-compensated upright typography and shot markers.
- **High-Speed Multi-Pointer Tracking**: Built to handle **4+ taps per second** (including overlapping two-thumb taps) using a concurrent pointer `Map` and zero-blocking in-memory shot updates during intense rallies.
- **Idle Service Box Illumination**: Highlights the active **Server** box (amber with shuttlecock icon) and diagonal **Receiver** box (emerald dashed), dynamically updating by score parity (even = right box, odd = left box).
- **Gesture-Driven Tracking (Zero UI Clutter During Play)**:
  - **Quick Tap**: Logs shot coordinates sequentially along the rally.
  - **Smart Guardrail**: Automatically mirrors accidental wrong-half taps onto the expected alternating court half (flagged as auto-corrected).
  - **Ghost Shot Gap-Filling**: If > 3 seconds pass between taps, realistic alternating ghost shots (~1 per 1.2s) are inserted with parity alignment so the resumed tap lands on the correct side.
  - **Swipe Left / Swipe Right**: Atomic **Undo** / **Redo** of the last tap action group during a rally; swiping **Left** between rallies reverts the last completed rally (score, rotation, and ends) and restores its shots right back into **rally mode**.
  - **Long-Press (450ms) During a Rally & Drag**: Enters **Free Landing Position Drag** with a live `(x cm, y cm)` readout; releasing opens the Rally Result sheet and immediately persists the rally.
  - **Long-Press (450ms) Between Rallies**: Opens the **Match Pause Menu**.

### 3. Official BWF Scoring & Rotation Engine
- **Automatic Rotation**:
  - **Singles**: Winner of rally serves next; court box follows server score parity.
  - **Doubles**: If the serving side wins, only the serving team swaps right/left boxes and the same player continues serving. On service-over, no one swaps boxes and the player standing in the new serving side's score-parity box serves.
- **Automatic Change of Ends & Official Intervals**:
  - Between every game (winner of preceding game serves first in the next) with an automatic **120s** interval.
  - At the mid-game interval in every game when the leading score reaches `Math.ceil(pointsPerGame / 2)` (e.g., **11 points** in a 21-point game) with an automatic **60s** interval — changing ends only in the deciding game per BWF Law 8.1.3.
- **Two-Step Rally Result Sheet**:
  - **Step 1**: Choose `IN`, `OUT`, `FAULT`, or `LET` (replay rally with no score change).
  - **Step 2**: Auto-infers winning side and finishing player (with one-tap **Swap** safeguard and Doubles hitter selector), plus finishing stroke type (`Smash`, `Clear`, `Drop`, `Net Stop`, `Drive`, `Lift`, `Serve`) and optional **Backhand** / **Deception** modifiers.

### 4. Pause Menu & Match Management
- **Automatic Interval Countdown & Live Timers**: When an official mid-game or between-game interval is reached, the Pause Menu opens automatically with a **countdown rest timer** (showing remaining rest time + progress bar and overtime indicator if exceeded, plus a **Change of Ends** indicator). For manual pauses, it displays a live count-up **Pause Timer** from the latest rally's landing point alongside **Match Time** (`MM:SS` / `H:MM:SS`).
- **Multi-Select Pause Reasons (`Other` Default)**: **Court Cleaning** and **Shuttle Change** (`+1 shuttle`) can be toggled simultaneously during the same stoppage (and combined with official **BWF Intervals**). If no specific reason is selected on manual pauses, **Other** (`Annat`) is active by default with an optional note field.
- **Umpire Call & Video Call Reviews**: Log umpire rulings (`Service Fault Called`, `Line Judge Overrule`, `Yellow Card`, `Red Card`, `Black Card / Disqualified`, `Medical / Injury Stoppage`, `Walkover (WO)`, `General Intervention`) and video challenge verdicts (combining any active shuttle/cleaning toggles and full pause duration). Warnings, cards, medical stoppages, Walkover (WO), and Black Card rulings prompt for the specific player involved; WO and Black Card immediately end the match in favor of the opposing side (with undo support).
- **Swipe Back to Undo Opening**: Swiping back (or pressing `Escape`) in the Pause Menu steps back from a subview or closes the Pause Menu without logging a pause event, immediately returning to the court.
- **Analyse Round-Trip**: Opening **Analyse** from the Pause Menu and closing it returns directly to the Pause Menu with the running pause timer and selected reasons preserved.

### 5. Tactical Match Analysis & JSON Export
- **KPI Overview**: Total rallies, average shots per rally, average rally duration, backhand/deception counts, shuttles used, and ghost shots.
- **Interactive Shuttle Placement Map**:
  - Filter finishing shots by **who struck the last shot** using actual **player/team names** (`All Shots`, individual players in Singles, or Teams + individual players in Doubles) and by outcome (`ALL`, `IN`, `OUT`, `FAULT`), with per-player outcome counts to highlight strengths and errors.
  - Displays player/team names directly on each court half and the active selection on the court mat.
  - Draws **origin-to-landing trajectory lines** (`○ Hit from → ● Landing` with directional arrows) showing where each finishing shot was struck and where it landed, plus an **All Strokes** toggle.
- **Finishing Shot Distribution & Set Progression**:
  - Breakdown across all 7 shot types, grouped into **Standard**, **Backhand**, and **Deception** per shot type with `All / Standard / Backhand / Deception` filter tabs and per-side **Won (`✓`) / Error (`✗`)** counts.
  - Game-by-game score progression list.
- **Complete Rally & Pause Timeline**:
  - Chronological list at the bottom of the Analysis view (filterable by game and sortable chronological / newest-first) showing all rallies interleaved with logged **Pause** events—including shot count, duration, resulting score, outcome, winner name, deciding shot (with Backhand/Deception & hitter), and pause reasons/durations/notes.
- **Export JSON**: Downloads a structured `.json` match report containing match config (including `tournamentName`, `courtName`, `umpireName`, `discipline`, `ageCategory`, and `categoryCode`), score summary, full rally/shot coordinates, and pause events.

### 6. In-App Browser Breakout, IndexedDB & Offline PWA
- **Meta / WhatsApp Browser Breakout**: Automatically detects embedded in-app browsers (Facebook, Instagram, Messenger, Threads, WhatsApp, TikTok, Snapchat, LinkedIn, LINE, Android WebView, iOS WKWebView) and guides users to open in their device's main browser (via Android `intent://` link or one-tap **Copy Link** + Safari/Chrome instructions) so IndexedDB data isn't trapped and the app can be installed as a PWA.
- **IndexedDB + Persistent Storage**: Mirrors active sessions, rally drafts, and archived matches to `IndexedDB` (`BadmintonMatchCoachDB`) alongside fast synchronous `localStorage` caching, and requests `navigator.storage.persist()` in full browsers.
- **Zero-Loss Recovery**: Automatically restores the exact view (`court` or `setup`), in-progress rally shots, undo/redo stacks, open modals (`Result`, `Pause`, `Analyse`), and running timers on app restart after a phone call, OS suspension, or crash.
- **Hybrid High-Speed Persistence**: Keeps rapid rally taps free of storage I/O lag while saving lightweight rally drafts after brief pauses and flushing the full session synchronously when opening the Result Menu, interacting with modals, or when `visibilitychange` / `pagehide` / `beforeunload` fires.
- **Offline-First PWA, Splash Screen & App Icons**: Installable on desktop, Android, and iOS (`Add to Home Screen` guide included), powered by `vite-plugin-pwa` with Workbox precaching, an automatic **Offline Mode** indicator, custom app icons (`192×192`, `512×512`, `maskable`, `apple-touch-icon`, `favicon.ico`) and splash screens (`splash-portrait.webp`, iOS `apple-touch-startup-image`, and startup `SplashScreen`) converted from `public/BadmintonMatchCoach.png`.

### 7. Multi-Language Support & External Language Packs
- **English (`en`) Default Built-In**: All UI strings, court labels, modals, and engine notices are externalized into `src/i18n/en.ts`, ensuring English always works offline out of the box with automatic key-level fallback.
- **Site-Hosted Language Packs (`/locales/`)**: Hosts `/locales/manifest.json`, `/locales/en.json`, and `/locales/sv.json` (Swedish) on the site. New languages can be added simply by dropping a `<lang>.json` file into `public/locales/` and registering it in `manifest.json`.
- **On-Demand Loading & Offline Caching**: Users can switch languages via the header language picker, load a custom language pack from any URL, import a local `.json` file, or download `en.json` as a translation template. Loaded packs are cached in `localStorage` (`_v2`) and via Workbox `locales-json-cache-v2` (`NetworkFirst`).

---

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Icons**: Lucide React
- **Animation**: Motion
- **PWA / Service Worker**: `vite-plugin-pwa` (Workbox)

---

## Project Structure

```text
├── index.html                        # App entry & PWA/meta configuration
├── vite.config.ts                    # Vite, Tailwind CSS & VitePWA manifest/Workbox config
├── public/
│   ├── locales/
│   │   ├── manifest.json             # Registry of site-hosted language packs
│   │   ├── en.json                   # English template language pack
│   │   └── sv.json                   # Swedish language pack
│   └── ...                           # App icons (SVG, PNG, maskable, Apple touch icon)
└── src/
    ├── App.tsx                       # Root state, rally/shot handlers & modal orchestration
    ├── main.tsx                      # React mount, I18nProvider & service worker registration
    ├── index.css                     # Tailwind import & touch-surface behavior rules
    ├── i18n/
    │   ├── en.ts                     # Strongly-typed built-in English base dictionary
    │   └── index.tsx                 # I18nProvider, dynamic JSON loader & offline cache
    ├── types/
    │   └── match.ts                  # MatchConfig, MatchState, ShotRecord, RallyRecord types
    ├── utils/
    │   ├── bwfEngine.ts              # BWF dimensions, tap/ghost shot engine, scoring & rotation
    │   ├── inAppBrowser.ts           # Meta/WhatsApp/WebView detector & Android intent builder
    │   └── storage.ts                # IndexedDB + localStorage persistence & JSON export
    ├── hooks/
    │   └── usePWAInstall.ts          # Install prompt & iOS standalone detection
    └── components/
        ├── MatchSetup.tsx            # Pre-match configuration, lineup preview & archive list
        ├── LanguageModal.tsx         # Language switcher, URL/file JSON loader & template export
        ├── BadmintonCourt.tsx        # Full-screen SVG court & touch gesture recognizer
        ├── ResultMenuModal.tsx       # 2-step rally outcome & finishing stroke logger
        ├── PauseMenuModal.tsx        # Live pause/match timers, multi-reason pauses, umpire/video calls
        ├── AnalyseModal.tsx          # Player-filtered trajectory map, shot grouping & rally/pause log
        ├── MatchCompleteModal.tsx    # Match summary, undo safeguard & export actions
        ├── InAppBrowserBreakout.tsx  # External browser breakout modal for Meta/WhatsApp/etc.
        ├── SplashScreen.tsx          # Branded startup splash screen with tap/key dismissal
        ├── PWAInstallButton.tsx      # Native install button & iOS Safari instructions
        └── OfflineIndicator.tsx      # Offline status badge
```

---

## Getting Started

### Prerequisites
- Node.js 20+ (or Bun)

### Installation & Development

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server at `http://localhost:3000` |
| `npm run build` | Builds the production bundle and PWA service worker into `dist/` |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |
| `npm run clean` | Removes `dist` and `server.js` build artifacts |
