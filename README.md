# PAD-Q

<p align="center">
  <img src="public/PADQ.png" alt="PAD-Q logo" width="560" />
</p>

**Real-time queue and matchmaking software for singles and doubles play.** PAD-Q helps a host organize players, rotate matches across one or more courts, record results, and share a live spectator view without requiring viewers to install an application.

[Live demo](https://pad-q.vercel.app) · [GitHub repository](https://github.com/Sceyo/PadQ)

## Project status

PAD-Q is an independently developed product in **active development**. The current build is deployed and used for field testing during games with friends and family.

- Deployed on Vercel
- Backed by Firebase Cloud Firestore
- 146 automated tests currently passing
- Designed for browser-based host and spectator experiences

The project is functional, but it should still be treated as a testing build rather than a production-secure service. Current limitations are documented below.

## The problem

Running a club night or casual sports session becomes difficult when one person has to manually remember:

- who has waited the longest;
- which players or teams have already met;
- who should rotate after a win or loss;
- how to distribute players across several courts;
- which players are sitting out or temporarily absent; and
- how to keep waiting players and spectators informed.

PAD-Q turns those decisions into a shared, real-time workflow. The host manages the session from one browser, while viewers follow the current match, queue, score, history, and statistics through a room code or shared link.

## Key features

### Session management

- Singles and doubles session setup
- Four-character room codes, direct watch links, and QR sharing
- Explicit **Go Live** control before a session is shown to viewers
- Optional viewer PIN gate
- Host session-key recovery on the same or another device
- Responsive light and dark interfaces

### Match and court operations

- Default, tournament, Play-All, and skill-based queue modes
- Multi-court assignment and a read-only coordinator overview
- Point-by-point live scoring with configurable 11- or 21-point targets and deuce handling
- Player sit-out, return, substitution, and “sit next” controls
- Single-step undo for supported match flows
- Saved club roster for faster future setup

### History and analytics

- Timestamped match results and optional scores
- Session win/loss records, win rates, streaks, and rank tiers
- Skill-bracket leaderboards
- Device-local career statistics
- Spectator match history and next-match announcements

## Product preview

### Session entry

![PAD-Q homepage with singles, doubles, and live-session options](public/screenshots/homepage.jpg)

The homepage gives players and organizers direct access to singles, doubles, and spectator experiences.

### Skilled matchmaking

![PAD-Q skilled matchmaking court and waiting queue](public/screenshots/skilled.jpg)

Skill-aware matchmaking groups players by ability while tracking the waiting queue and preventing smaller groups from being skipped indefinitely.

### Host scoring

![PAD-Q host scoreboard with configurable scoring](public/screenshots/scoreboard.jpg)

The host can enable point-by-point scoring, select a target score, update either team, and record the winner from the same match view.

### Live spectator view

![PAD-Q spectator view showing a live score and waiting queue](public/screenshots/live.jpg)

Spectators can follow the live score, current format, room status, active courts, and waiting queue without receiving host controls.

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
    UI --> Storage["Browser-local roster, recovery, skills, and career data"]
```

### Data flow

1. A host action is validated and translated into a queue-engine transition.
2. The resulting session state is sent through `useSession` and `lib/sessionService.ts`.
3. Firestore stores shared state in `sessions/{sessionId}` and results in its `history` subcollection.
4. Real-time `onSnapshot` listeners update connected host and spectator browsers.
5. A completed match uses a Firestore write batch so the session update and history entry are committed together.

There is no separate REST or GraphQL backend in this repository. The browser uses the Firebase SDK directly, making Firestore rules the effective authorization boundary.

## Technology stack

| Area | Technology | Use in PAD-Q |
|---|---|---|
| Framework | Next.js 16.2.1, App Router | Routing and application structure |
| UI | React 19.2.4 | Interactive host and spectator experiences |
| Language | TypeScript 5 | Typed application and matchmaking logic |
| Data | Firebase 12.11.0 / Cloud Firestore | Persistence and real-time synchronization |
| Testing | Vitest 4.1.9 | Unit and simulation tests |
| Styling | Custom CSS, CSS Modules, Tailwind CSS 4 | Responsive interface and theme styling |
| Tournament logic | `brackets-manager`, `brackets-memory-db` | In-memory bracket management |
| Supporting UI | Lucide React, `qrcode.react` | Icons and session QR codes |
| Deployment | Vercel | Hosted Next.js application |

## Matchmaking and rotation modes

### Default

- **Singles:** king-of-the-court rotation. A winner remains king until defeated or until reaching the three-win rotation limit.
- **Doubles:** an `INIT → WINNERS → LOSERS` state machine seeds the player pool and alternates between winner and loser groups.
- Candidate doubles teams are scored to reduce repeated partners, repeated matchups, immediate replay, and skill imbalance.

### Tournament

Supports single- and double-elimination match structures, winner advancement, and read-only bracket display for spectators.

### Play-All

Tracks previous teammate and opponent relationships. The player waiting longest remains the anchor, while the engine evaluates possible groups and team splits within a bounded look-ahead window. It prefers combinations with fewer repeated relationships.

Play-All is an explainable greedy heuristic; it does not claim to produce a globally optimal or mathematically complete round-robin schedule.

### Skilled

Players can be tagged as Beginner, Intermediate, or Advanced. Court filling follows a priority cascade:

1. four players from one skill group;
2. a majority group plus an adjacent-level player;
3. a split between adjacent skill groups; and
4. a cross-bracket fallback when no closer match can be formed.

Wait-cycle counters provide a starvation override so a smaller skill group is not skipped indefinitely. Rest cycles are calculated from player count and available court capacity.

## Testing and quality assurance

The current Vitest suite reports:

```text
Test Files  5 passed (5)
Tests       146 passed (146)
```

The suite focuses on deterministic domain logic and verifies:

- singles king, challenger, fatigue, and forced-rotation behavior;
- doubles phase transitions, partner selection, pool limits, and serialization;
- skill-priority selection, rest cycles, starvation prevention, and idle-court filling;
- player statistics and matchmaking suggestions; and
- club-night simulations with as many as 50 players over repeated rotation cycles.

The simulations check important invariants, including preventing a player from occupying two courts, keeping every player accounted for, bounding player-pool sizes, and ensuring waiting players eventually receive matches.

The repository does not yet include Firestore Emulator rule tests, React component tests, browser end-to-end tests, or a CI quality gate. ESLint also has unresolved findings; these are tracked as development limitations rather than hidden behind the passing domain suite.

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

Create a Firebase project, enable Cloud Firestore, and register a web application. Create `.env.local` in the repository root using placeholder values like these:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Do not commit `.env.local` or paste real project configuration into issues, screenshots, or documentation.

Deploy the repository's Firestore rules and indexes to your selected Firebase project:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

Review `firestore.rules` and the security limitation below before using a project that contains real or sensitive data.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npx tsc --noEmit --incremental false` | Run a standalone TypeScript check without emitting files |

## Deployment

The live application is hosted on Vercel at [pad-q.vercel.app](https://pad-q.vercel.app). A deployment requires the same six Firebase environment variables listed above to be configured in the hosting environment.

Firestore is managed separately:

- `firebase.json` selects the default Firestore database in `asia-southeast1`.
- `firestore.rules` contains database access rules.
- `firestore.indexes.json` currently defines no composite indexes.

The code updates a `lastActiveAt` server timestamp during host activity and detects when a session document disappears. Automatic expiry is **not currently confirmed as enabled**. Firestore TTL expects a TTL field to represent an expiration time, and deletion is not immediate. A correct expiry design and deployed TTL policy remain planned work.

## Known limitations

- **Prototype authorization:** Firebase Authentication is not currently used. The host token and optional viewer PIN are stored in a session document that is readable under the present Firestore rules. They should not be treated as production-grade access controls.
- **Deletion-rule behavior:** Firestore delete authorization needs dedicated emulator verification and correction before undo, history clearing, and hard deletion can be considered reliable in production.
- **No guaranteed 30-minute expiry:** activity timestamps exist, but an appropriate expiration timestamp and confirmed deployed TTL policy do not.
- **Browser-local data:** saved rosters, skill assignments, court groups, recovery data, and career statistics are device-specific.
- **Online-first behavior:** explicit offline persistence and conflict recovery are not implemented.
- **Multi-court navigation:** switching between independently stored court sessions can require a page reload.
- **Partial test boundary:** the matchmaking engines have substantial automated coverage, but Firestore rules, UI components, and complete user journeys do not.
- **Open quality findings:** the test suite passes, but linting currently reports unresolved errors and warnings.
- **Large controllers:** the main host and spectator pages still contain substantial orchestration logic and would benefit from further decomposition.

## Planned improvements

1. Replace bearer-token authorization with Firebase Authentication or a trusted server-side mutation boundary.
2. Separate public spectator data from private host credentials and add Firestore Emulator security tests.
3. Implement an explicit `expireAt` strategy and enable a verified Firestore TTL policy.
4. Add React component and browser end-to-end tests for host, spectator, scoring, recovery, and multi-court workflows.
5. Add continuous integration for tests, TypeScript, linting, and production builds.
6. Improve offline behavior and visible connection recovery.
7. Complete skilled-mode undo behavior and further separate page orchestration into focused controllers.
8. Add CSV history export, roster import, and configurable singles streak limits.
9. Add a short product demonstration video.

## Usage notice

Copyright © 2026 PAD-Q. All rights reserved.

This repository is publicly available for portfolio review, learning, and evaluation. No license is granted to copy, modify, redistribute, sublicense, or commercially use the source code or product assets without prior written permission from the owner.

This source-visible notice keeps ownership with the creator; it is not an open-source license.

## Contact

- [LinkedIn](https://www.linkedin.com/in/francis-aliser/)
- [Portfolio](https://aliser-portfolio.vercel.app/)
