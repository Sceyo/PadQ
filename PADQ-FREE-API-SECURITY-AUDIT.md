# PADQ Free/Open API and Library Security Audit

**Audit date:** 2026-08-15
**Release context:** PADQ V1 on Firebase Spark and Vercel Hobby

## Decision

Do not add a third-party network API to the V1 queue, scoring, or live-view path. Those paths must continue working when every optional provider is unavailable. “Listed on GitHub” and “free” are not security or reliability guarantees.

The safest V1 position is:

- Firebase remains the only realtime network dependency.
- QR generation and performance calculations remain in the browser.
- Optional APIs use explicit timeouts, no player names or room codes, no secret keys in `NEXT_PUBLIC_*`, and a UI that disappears cleanly when the provider fails.
- New hosted services require a privacy review, current pricing check, rate-limit check, and kill switch before integration.

## Shortlist

| Candidate | Type | Security/free assessment | PADQ fit | Decision |
|---|---|---|---|---|
| [Zod](https://github.com/colinhacks/zod) | Local TypeScript validation library | MIT; zero external dependencies; no network transmission | Validate imported rosters, restored session payloads, invitation payloads, and future API responses | **Recommended for V1.1**, not required to finish V1 |
| [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) | Existing client SDK | Official SDK already used; Auth, Firestore, App Check, emulator support | Keep as the sole V1 realtime backend; enable App Check only after monitoring | **Keep** |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | Local IndexedDB helper | Very small; no hosted service or API key | Could store a local emergency event snapshot | **Defer**; prefer Firebase's supported persistent cache to avoid two sources of truth |
| [Workbox](https://github.com/GoogleChrome/workbox) | PWA/service-worker toolkit | MIT; local library; service-worker caching needs careful versioning | Cache the application shell for weak court Wi-Fi | **V1.1 candidate**; never cache Firestore responses or authorization state manually |
| [Open-Meteo](https://github.com/open-meteo/open-meteo) | Hosted weather/geocoding API | HTTPS/CORS, no key, no tracking; free non-commercial use; attribution and fair-use limits apply | Optional outdoor-court weather warning using coordinates only | **V1.3 candidate**; not suitable as a launch dependency or unreviewed commercial dependency |
| [Sentry JavaScript SDK](https://github.com/getsentry/sentry-javascript) | Hosted error monitoring SDK | SDK is MIT and maintained, but events leave PADQ; free hosted limits can change; security advisories must be monitored | Production error visibility and release health | **Post-launch candidate** with `sendDefaultPii: false`, no replay, sanitized room/player data |
| [PostHog](https://github.com/PostHog/posthog) | Hosted/self-hosted analytics | Open-source core, but hosted analytics transmits behavior data and adds consent/privacy work | Product analytics and feature flags | **Do not add to V1** |
| [Public APIs list](https://github.com/public-apis/public-apis) | Community directory | Discovery source only; entries have mixed ownership, uptime, licensing, and security | Finding ideas | **Never treat listing as approval** |

## API-specific threat checklist

Before any future integration:

1. Verify the repository owner, release activity, license, security policy, and current advisories.
2. Confirm HTTPS, CORS behavior, rate limits, commercial-use terms, data retention, and outage behavior from the provider's own documentation.
3. Do not expose secret API keys through browser-visible environment variables.
4. Send no player names, room codes, Firebase UIDs, access tokens, or detailed session histories.
5. Validate every response at runtime, cap response size, enforce a short timeout, and handle malformed data.
6. Keep the queue/scoring UI usable when the API is slow, unavailable, rate-limited, or returns unexpected content.
7. Add unit tests for invalid responses and browser tests for timeout/offline behavior.
8. Recheck pricing and terms before commercial use; free tiers are not permanent contracts.

## Recommended release order

1. **V1.0:** no new external API. Finish deployed-device field tests.
2. **V1.1:** consider Zod and supported Firebase persistent cache; evaluate Workbox only for app-shell availability.
3. **After first live events:** add privacy-safe error monitoring if operational evidence justifies it.
4. **V1.3 or later:** consider Open-Meteo only as an optional outdoor-event enhancement.

## Testing evidence

The V1 scenario matrix covers 1-3 courts, minimum-to-30-player rosters, no/one/maximum locked partner configurations, singles and doubles rotations, stale duplicate results, 1-30 viewers in the Spark capacity model, and five isolated 30-player rooms. Browser coverage separately exercises 30 live viewers, reconnects, refreshes, score corrections, duplicate confirmation, and three-court updates.

### Verified on 2026-08-15

- Production dependency audit: **0 known vulnerabilities** after updating Next.js to 16.3.1 and Firebase to 12.17.1.
- Removed `brackets-manager` and `brackets-memory-db` from the production dependency tree because tournament mode is sealed and neither package is imported by the application.
- Full Vitest suite: **171 passed, 19 skipped**; the skipped cases belong to the dedicated emulator suite.
- Firestore rules emulator: **19 passed**.
- Playwright with local Firebase Auth and Firestore: **10 passed**, including 30 simultaneous viewer tabs and deliberate offline/reconnect cases.
- Production build: passed on Next.js 16.3.1.
- ESLint: **0 errors, 27 existing warnings**.

The full development dependency audit still reports five moderate advisories beneath `firebase-tools`. They are confined to local CLI/emulator transitive dependencies and are not shipped in the Vercel production bundle. npm's suggested automatic remedy is a forced Firebase CLI downgrade, so it was not applied. Continue tracking these advisories and update the CLI when an upstream non-breaking fix is released.

## Fairness issue found by the expanded matrix

An odd roster could previously lock every possible pair. For example, five players could form two permanent pairs and leave one single player who could never join any legal four-player match. PADQ now leaves at least three unpaired players in odd-sized rosters, allowing fixed pairs and singles to rotate without splitting a requested partnership. The same limit is enforced both in the partner panel and when saving partner changes.
