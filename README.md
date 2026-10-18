# PAD-Q

<p align="center">
  <img src="public/PADQ.png" alt="PAD-Q logo" width="560" />
</p>

**Real-time queue and matchmaking software for singles and doubles play.** PAD-Q helps a host organize players, rotate matches across one or more courts, record results, and share a live spectator view without requiring viewers to install an application.

[Live demo](https://pad-q.vercel.app) · [GitHub repository](https://github.com/Sceyo/PadQ)

## Project status

PAD-Q is an independently developed product in **active production**. The `main` branch contains the production V1 release; the complete experimental feature set is preserved on `all-features-archive`.

- Production release: **`v1.0.0`**
- Deployed on Vercel with Firebase Cloud Firestore and Firebase App Check enforcement
- **278 automated unit, component, simulation, and scenario tests passing** across 25 test files (0 failures)
- Protected `main` branch with a required GitHub Actions quality gate
- Designed for browser-based host and spectator experiences

V1.0 is production-ready, featuring multi-court doubles (1–3 courts, up to 30 players), Global Asynchronous Partner Pairing, toggleable multi-court match scoring with 1-tap presets, Point Differential and Opponent Win Percentage (OWP) tiebreakers, and real-time Live Watch spectator sync.

### V1 operating contract

- Up to **30 players**, **3 courts**, and **30 simultaneous Live Watch viewers**
- One host device and one anonymous session owner
- Temporary event rooms rather than permanent venue or player accounts
- Firebase Spark and Vercel Hobby operation with a **$0 / ₱0 infrastructure target**
- Online-first operation with safe manual retry after a failed result submission

## The problem

Running a club night or casual sports session becomes difficult when one person has to manually remember:

- who has waited the longest;
- which players or teams have already met;
- who should rotate after a win or loss;
- how to distribute players across several courts;
- which players are sitting out or temporarily absent; and
- how to keep waiting players and spectators informed.

PAD-Q turns those decisions into a shared, real-time workflow. The host manages the session from one browser, while viewers follow current court assignments, the queue, completed results, history, and statistics through a room code or shared link. Single-court sessions can also share a live score.

## Key features

### Session management

- Singles and doubles session setup
- Six-character room codes, direct watch links, and QR sharing
- Explicit **Go Live** control before a session is shown to viewers
- Automatic same-browser host recovery through Firebase Anonymous Authentication
- Responsive light and dark interfaces

### Match and court operations

- Default singles and doubles queue rotation
- Shared multi-court assignment for one to three courts (up to 30 players)
- **Global Asynchronous Partner Pairing (Option 2):** Pair any two players across courts or queue with real-time location tags (`[QUEUE]`, `[COURT 1]`, etc.); queued partners hold their spot without blocking others (non-blocking leapfrog) and unite on the very next open court
- **Multi-Court Match Scoring:** Configurable `Match Scores: ON/OFF` toggle with 1-tap presets (`11–9`, `11–7`, etc.) and custom typing to record game scores directly
- Optional point-by-point live scoring for single-court sessions with deuce logic
- Redesigned CourtCard UI with dedicated Team 1 (Indigo) and Team 2 (Cyan) containers, individual player chips, ampersand connectors, and elevated `VS` badges
- Player sit-out, return, substitution, and “sit next” controls
- Single-step undo for supported match flows
- Score correction, duplicate-submit protection, failed-save rollback, and refresh persistence
- Saved club roster for faster future setup

### History and analytics

- Timestamped match results with score badges and winner indicators
- Session win/loss records, win rates, streaks, and rank tiers
- **4-Tier Deterministic Standings:** Ranked by Wins → Win % → Point Differential (`+/-`) → Opponent Win % (Matchup Strength / OWP)
- Device-local career statistics
- Spectator match history and real-time live court sync

## Product preview

### Session entry

![PAD-Q homepage with singles, doubles, and live-session options](public/screenshots/homepage.jpg)

The homepage gives players and organizers direct access to singles, doubles, and spectator experiences.

### Shared multi-court matchmaking

![PAD-Q multi-court matchmaking and waiting queue](public/screenshots/skilled.jpg)

The V1 launch flow prioritizes a clear shared waiting queue, fair court assignment, sit-out handling, and optional permanent partner pairs.

### Host scoring

![PAD-Q host scoreboard with configurable scoring](public/screenshots/scoreboard.jpg)

In a single-court session, the host can enable point-by-point scoring, select a target score, update either team, and record the winner from the same match view. In multi-court sessions, hosts have a **Match Scores** toggle (ON by default): recording a match triggers a clean direct scoring modal with 1-tap presets (`11–9`, `11–7`, etc.) and custom typing to power the Point Differential and Opponent Win % leaderboard, or can be toggled OFF for rapid winner-only recording.

### Live spectator view

![PAD-Q spectator view showing a live score and waiting queue](public/screenshots/live.jpg)

For a single court, spectators can follow the optional live score. In multi-court sessions, **Live Court Status** lets a viewer see current court matchups, live pulse indicators, completed scores, and the shared next-player queue in real time without requiring point-by-point entry.

During a live multi-court doubles session, the host can pair any two players across courts or queue using **Global Asynchronous Partner Pairing (Option 2)**. Real-time location tags (`[QUEUE]`, `[COURT 1]`, etc.) clarify where each player is; queued partners hold their spot in line without blocking others and automatically unite as teammates on the next available court.

### Multi-court management

![PAD-Q three-court doubles session](public/screenshots/3courts.jpg)

Multi-court sessions keep active matches visible together so a host can record results and continue player rotation across three courts.

Explore the current build through the [live demo](https://pad-q.vercel.app).

## My role and ownership

PAD-Q is an independent product that I own and develop as **Founder & Full-Stack Developer**. I designed and implemented the product experience, frontend architecture, queue and matchmaking engines, Firestore integration, automated tests, and deployment workflow.

Development has included feedback and code review from other people, along with AI-assisted review and development using Codex and Claude Code. Product ownership and final implementation decisions remain mine.

## Architecture

PAD-Q is a client-heavy Next.js application. Domain logic is kept in TypeScript queue engines, while a session hook and service layer coordinate shared Firestore state.

```mermaid
flowchart LR
    Host["Host browser"] --> UI["Next.js and React interface"]
    UI --> Engines["Queue and matchmaking engines"]
    Engines --> Hook["Session hook"]
    Hook --> Service["Firestore service layer"]
    Service --> Session["Session document"]
    Service --> History["History subcollection"]
    Session --> Host
    Session --> Viewer["Spectator browser"]
    History --> Host
    History --> Viewer
    UI --> Storage["Browser-local roster, recovery, and career data"]
```

### Data flow

1. A host action is validated and translated into a queue-engine transition.
2. The resulting session state is sent through `useSession` and `lib/sessionService.ts`.
3. Firestore stores shared state in `sessions/{sessionId}` and results in its `history` subcollection.
4. Real-time `onSnapshot` listeners update connected host and spectator browsers.
5. A completed match uses a revision-checked Firestore transaction so the session update and idempotent history entry commit together without lost updates.

There is no separate REST or GraphQL backend in this repository. The browser uses the Firebase SDK directly, making Firestore rules the effective authorization boundary.

## Technology stack

| Area | Technology | Use in PAD-Q |
|---|---|---|
| Framework | Next.js 16.3.1, App Router | Routing and application structure |
| UI | React 19.2.4 | Interactive host and spectator experiences |
| Language | TypeScript 5 | Typed application and matchmaking logic |
| Data | Firebase 12.17.1 / Cloud Firestore | Persistence and real-time synchronization |
| Testing | Vitest 4.1.9 | Unit and simulation tests |
| Styling | Custom CSS, CSS Modules, Tailwind CSS 4 | Responsive interface and theme styling |
| Supporting UI | Lucide React, `qrcode.react` | Icons and session QR codes |
| Deployment | Vercel | Hosted Next.js application |

## V1 matchmaking and rotation

### Default

- **Singles:** king-of-the-court rotation. A winner remains king until defeated or until reaching the three-win rotation limit.
- **Doubles:** an `INIT → WINNERS → LOSERS` state machine seeds the player pool and alternates between winner and loser groups.
- Candidate doubles teams are scored to reduce repeated partners, repeated matchups, immediate replay, and skill imbalance.

### Deferred modes

Tournament, Play-All, skill-based matchmaking, viewer PIN setup, and the legacy independent-court coordinator are hidden from the V1 production interface. Their implementations and documentation remain available on `all-features-archive` for later hardening and release.

The deferred skill engine groups players as Beginner, Intermediate, or Advanced. Court filling follows a priority cascade:

1. four players from one skill group;
2. a majority group plus an adjacent-level player;
3. a split between adjacent skill groups; and
4. a cross-bracket fallback when no closer match can be formed.

Wait-cycle counters provide a starvation override so a smaller skill group is not skipped indefinitely. Rest cycles are calculated from player count and available court capacity.

## Testing and quality assurance

The V1 automated test suite includes:

- **278 passing application unit, component, simulation, and scenario tests** across 25 test files (0 failures);
- 20 passing Firestore Emulator security and concurrency tests; and
- 16 passing browser end-to-end and stress scenarios.

The suite focuses on deterministic domain logic and verifies:

- singles king, challenger, fatigue, and forced-rotation behavior;
- doubles phase transitions, partner selection, pool limits, and serialization;
- **Global Asynchronous Partner Pairing (Option 2)**: cross-court pairs, non-blocking queue holding, court starvation protection, and partner unification;
- **Multi-Court Match Scoring & Point Differential**: 1-tap preset scores, custom score entry, auto-calculated winner scores, skip scores, and 4-tier tiebreaker sorting;
- skill-priority selection, rest cycles, starvation prevention, and idle-court filling;
- player statistics and matchmaking suggestions; and
- 25- and 30-player rush scenarios, three-court concurrent completion, queue
  removal, score recovery, reconnects, and 30 simultaneous Live Watch viewers.

The simulations check important invariants, including preventing a player from occupying two courts, keeping every player accounted for, bounding player-pool sizes, and ensuring waiting players eventually receive matches.

The repository includes Firestore Emulator rule tests, focused React component
tests for Live Court Status, and browser end-to-end tests against local
Authentication and Firestore emulators. GitHub Actions runs lint, the unit and
scenario suite, the production build, Firestore rules tests, browser/stress
tests, and a production dependency audit. This strict `verify` check is required
before protected `main` can accept a pull request. ESLint has no errors; existing
warnings remain tracked as non-blocking development limitations.

The detailed persona assessment is recorded in
[`V1-PERSONA-ACCEPTANCE-MATRIX.md`](docs/V1-PERSONA-ACCEPTANCE-MATRIX.md).

## Local setup

### Prerequisites

- Node.js 20 or a compatible current LTS release
- npm
- A Firebase project with a Firestore database

### 1. Clone the repository

```bash
git clone https://github.com/Sceyo/PadQ.git
cd PadQ
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

Create a Firebase project, enable Cloud Firestore, enable the **Anonymous** sign-in provider in Firebase Authentication, and register a web application. Add every production and local hostname to the Firebase API key's allowed HTTP referrers. Create `.env.local` in the repository root using placeholder values like these:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=false
NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=your_recaptcha_enterprise_site_key
```

Do not commit `.env.local` or paste real project configuration into issues, screenshots, or documentation.

For production, register the web app with Firebase App Check using reCAPTCHA
Enterprise, add the site key in Vercel, then set
`NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true`. Monitor verified requests before
enabling Firestore enforcement in Firebase Console. Keep the switch false for
unregistered local and preview environments.

Deploy the repository's Firestore rules and indexes to your selected Firebase project:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

Review `firestore.rules` and run `npm run test:rules` before using a project that contains real or sensitive data. The rules suite requires Java 21 or newer for the local Firestore emulator.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Safe local Firebase browser testing

Use two PowerShell terminals so browser tests cannot write to production.

Terminal 1:

```powershell
npm.cmd run emulators
```

Terminal 2:

```powershell
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS="true"
npm.cmd run dev
```

Set the switch before starting Next.js. If the development server was already
running, stop and restart it. The local Emulator UI is available at
[http://127.0.0.1:4000](http://127.0.0.1:4000).

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run emulators` | Start local Authentication and Firestore for safe browser tests |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:rules` | Run Firestore security and concurrency tests in the emulator |
| `npm run test:e2e` | Run the full browser and stress suite against local emulators |
| `npx tsc --noEmit --incremental false` | Run a standalone TypeScript check without emitting files |

## Deployment

The authoritative public-release register is
[`V1-PUBLIC-RELEASE-TASKS.md`](docs/V1-PUBLIC-RELEASE-TASKS.md). RC6 has completed
the automated, security, capacity, clean-CI, merge, tag, and production
deployment work. The final go/no-go activity is the supervised event described
in [`V1-SUPERVISED-EVENT-RUNBOOK.md`](docs/V1-SUPERVISED-EVENT-RUNBOOK.md). The
planned scope after launch, including multi-host sessions, is maintained in
[`PADQ-RELEASE-ROADMAP.md`](docs/PADQ-RELEASE-ROADMAP.md).

The live application is hosted on Vercel at [pad-q.vercel.app](https://pad-q.vercel.app).
A production deployment requires the six Firebase web configuration variables
plus `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED` and
`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`. Preview and local environments should
leave App Check disabled unless their hostnames are separately registered.

Firestore is managed separately:

- `firebase.json` selects the default Firestore database in `asia-southeast1`.
- `firestore.rules` contains database access rules.
- `firestore.indexes.json` currently defines no composite indexes.

The code updates a `lastActiveAt` server timestamp during host activity and detects when a session document disappears. Automatic expiry is **not currently confirmed as enabled**. Firestore TTL expects a TTL field to represent an expiration time, and deletion is not immediate. A correct expiry design and deployed TTL policy remain planned work.

## Known limitations

- **Single host:** V1 has one anonymous session owner. Multi-host management, delegated referees, and safe cross-device ownership transfer are deferred.
- **No guaranteed 30-minute expiry:** activity timestamps exist, but an appropriate expiration timestamp and confirmed deployed TTL policy do not.
- **Browser-local data:** saved rosters, skill assignments, court groups, recovery data, and career statistics are device-specific.
- **Online-first behavior:** a failed authoritative result safely restores the previous state and can be retried manually, but V1 has no durable automatic offline replay queue.
- **Multi-court point-by-point tracking:** V1 provides direct match score entry (1-tap presets and custom scores) to power Point Differential and Opponent Win % tiebreakers, alongside an instant toggle to switch between score entry and rapid winner-only recording. Point-by-point live incrementation remains single-court only.
- **Viewer and court ceiling:** the tested free-tier contract is 30 viewers and 3 courts. PAD-Q does not promise 300-viewer events or four or more courts in V1.
- **No ETA or competitive rating:** Live Watch shows current courts and next players, but not an estimated wait. Bronze–Diamond tiers summarize session win rate and are not Elo, DUPR, or opponent-adjusted ratings.
- **No permanent venue or player accounts:** V1 rooms are temporary, and PAD-Q does not claim certified GDPR compliance or provide cloud player-profile requests.
- **Partial test boundary:** automated browser coverage includes core host, viewer, capacity, reconnect, score recovery, and scope-seal journeys; the supervised real event remains the final human-use gate.
- **Open quality findings:** the test suite and build pass; linting still reports warnings.
- **Large controllers:** the main host and spectator pages still contain substantial orchestration logic and would benefit from further decomposition.

## Planned improvements

1. Add secure multi-host roles, delegated court scoring, and cross-device ownership recovery.
2. Add a compact spectator projection and high-fan-out realtime delivery for events beyond 30 viewers.
3. Implement a durable offline result outbox with automatic replay and clearer synchronization status.
4. Implement an explicit `expireAt` strategy and enable a verified Firestore TTL policy.
5. Add persistent venues and optional player accounts with appropriate privacy and deletion controls.
6. Add measured wait estimates only after PAD-Q can collect reliable match-duration data.
7. Add opponent-aware competitive ratings and tournament rules as separately validated modes.
8. Add CSV history export, roster import, stat-card sharing, and configurable rotation policies.
9. Further decompose the host and spectator controllers and resolve remaining lint warnings.

## Usage notice

Copyright © 2026 Francis Aliser. All rights reserved.

PADQ is proprietary software. This repository is publicly visible for review, evaluation, and portfolio purposes. No permission is granted to use, copy, modify, redistribute, sublicense, host, commercially exploit, or create derivative works from the source code or product assets without prior written permission from the copyright holder.

See the [proprietary software notice](LICENSE) for the complete terms. PADQ is not open-source software.

## Author and contact

- **Created and maintained by Francis Aliser**
- [GitHub](https://github.com/Sceyo)
- [LinkedIn](https://www.linkedin.com/in/francis-aliser/)
- [Portfolio](https://aliser-portfolio.vercel.app/)
