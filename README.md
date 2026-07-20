# 🏓 PadQ — Real-Time Match Queue Manager

PadQ is a real-time match queue manager for singles and doubles paddle/racket sports (pickleball, badminton, table tennis, padel). A host creates a session, adds players, and the app handles fair rotation across multiple queue modes. Viewers join via a 4-character room code to watch the session live, with no installation required on their end.

**Live demo**: [pad-q.vercel.app](https://pad-q.vercel.app)

---

## 🎯 Features

- **Singles or Doubles** — king-of-the-court singles, or doubles with an INIT → WINNERS → LOSERS rotation engine
- **Four queue modes**:
  - **Default** — winners stay on, losers rotate to the back
  - **Tournament** — single/double-elimination bracket with auto-advancing winners
  - **Play-All** — guarantees every possible pairing is played before any repeats
  - **Skilled** — groups players into Beginner / Intermediate / Advanced brackets and auto-fills courts with skill-aware matchmaking
- **Live viewer mode** — anyone with the room code (or a direct link) can watch the session update in real time, no account needed
- **Multi-court support** — run several courts as linked sessions, with a read-only coordinator overlay showing all courts at once
- **Club roster** — save regular players locally and bulk-add them to future sessions
- **Match history & undo** — every result is logged with a timestamp; the most recent match can be undone
- **Player sit-out & substitution** — temporarily bench a player or swap in a replacement for someone who's absent, without disrupting the queue
- **Session recovery** — hosts get a one-time "session key" so they can reclaim host control if they lose their device session
- **Dark mode** and a responsive layout for mobile, tablet, and desktop

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2.1 (App Router) + React 19
- **Language**: TypeScript 5 (strict mode)
- **Database**: Firebase Firestore — real-time sync, no backend server to run
- **Styling**: Custom CSS with CSS variables (dark mode support) + Tailwind CSS 4 in a few places
- **Other libraries**: `brackets-manager` (tournament bracket logic), `qrcode.react` (room-code QR codes), `lucide-react` (icons)

There is no separate backend service — Firestore handles persistence and real-time sync directly from the client.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Sceyo/PadQ.git
cd PadQ
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

PadQ uses Firestore only (no Firebase Auth or Storage). You'll need your own Firebase project:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database**
3. Add a web app to the project and copy its config values
4. Create a `.env.local` file in the project root with your Firebase web config (variable names depend on `lib/firebase.ts` — check that file for the exact keys it expects)
5. Deploy the included security rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

> The repo includes `firestore.rules`, `firestore.indexes.json`, and `firebase.json`, pre-configured for the schema this app uses.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |

---

## 📖 Usage

1. **Host**: open the app, choose Singles or Doubles, add players (or pull them from your saved roster), and pick a queue mode
2. **Start the session** — you'll get a 4-character room code and a one-time host recovery key (save this in case you need to reclaim host access later)
3. **Share the room code or link** — viewers can follow along live from the `/watch/{sessionId}` page without needing to do anything else
4. **Run matches** — record winners as games finish; the queue, brackets, or skill-based matchmaking update automatically
5. **Manage live** — use sit-out, substitution, undo, and the coordinator overlay (for multi-court setups) as needed from the host menu

---

## 📁 Project Structure

```
app/
  page.tsx                  # Homepage — game mode selector, room code entry
  queue/
    page.tsx                # Main queue manager (host + viewer)
    lib/                    # Queue engines (doubles, singles, skilled), types, utils
    components/             # UI components (analytics, brackets, court cards, etc.)
    context/                # Multi-court context provider
  watch/[sessionId]/
    page.tsx                # Read-only live viewer page
hooks/
  useSession.ts             # Firebase session lifecycle (create, join, sync)
  useQueue.ts                # Local queue state + suggestions
  useSessionAccess.ts        # Viewer PIN gate
lib/
  firebase.ts                # Firebase app + Firestore init
  sessionService.ts          # All Firestore read/write operations
```

See `CLAUDE.md` in the repo root for a full architecture and data-flow breakdown.

---

## 🔒 Security Notes

- Firestore security rules enforce a `hostToken` server-side for all writes — only the host who created a session can modify it
- Sessions auto-expire after 30 minutes of inactivity (Firestore TTL on `lastActiveAt`)
- An optional 4-character PIN can gate viewer access to a session

---

## 🤝 Contributing

Issues and pull requests are welcome. See `CLAUDE.md` for architecture details before making changes to the queue engines.