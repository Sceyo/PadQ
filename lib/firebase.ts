// lib/firebase.ts
// ═══════════════════════════════════════════════════════════
// Firebase initialization — single import across the whole app.
//
// SETUP STEPS:
//  1. Go to https://console.firebase.google.com
//  2. Create a project → "Add app" → Web
//  3. Copy your config values into .env.local (see below)
//  4. Enable Firestore: Build → Firestore Database → Create (production mode)
//  5. Set Firestore rules (see firestore.rules file)
//
// .env.local keys needed:
//   NEXT_PUBLIC_FIREBASE_API_KEY=
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
//   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
//   NEXT_PUBLIC_FIREBASE_APP_ID=
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type User } from 'firebase/auth';
import {
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent re-initializing on hot-reload in Next.js dev mode
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

// Enable only after the production web app is registered in Firebase App Check.
// Monitor verified requests before turning on Firestore enforcement.
const appCheckEnabled = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED === 'true';
const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
if (typeof window !== 'undefined' && !useFirebaseEmulators && appCheckEnabled && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);

// Use experimentalForceLongPolling to suppress "WebChannelConnection
// RPC 'Listen' stream transport errored" in dev and on some networks.
// Long polling is slightly less efficient than WebSockets but is far
// more reliable behind proxies, VPNs, and corporate firewalls.
// In production on Vercel this makes no measurable difference.
export const db = getApps().length > 1
  ? getFirestore(app)
  : initializeFirestore(app, {
      experimentalForceLongPolling: true,
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });

// Local browser tests must never fall through to production Firebase. Set the
// public switch before starting Next.js, then run the Auth + Firestore emulators.
const emulatorGlobal = globalThis as typeof globalThis & {
  __padqFirebaseEmulatorsConnected?: boolean;
};
if (typeof window !== 'undefined' && useFirebaseEmulators && !emulatorGlobal.__padqFirebaseEmulatorsConnected) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  emulatorGlobal.__padqFirebaseEmulatorsConnected = true;
}

let signInPromise: Promise<User> | null = null;

/** Ensure every client has an identity before it accesses Firestore. */
export async function ensureAuthenticated(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!signInPromise) {
    signInPromise = signInAnonymously(auth)
      .then(credential => credential.user)
      .finally(() => { signInPromise = null; });
  }
  return signInPromise;
}

export default app;
