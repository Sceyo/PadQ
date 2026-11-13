import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertFirebaseConfig } from '@/lib/firebase';

describe('assertFirebaseConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not throw when NODE_ENV is test', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(() => assertFirebaseConfig()).not.toThrow();
  });

  it('does not throw when USE_FIREBASE_EMULATORS is true', () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(() => assertFirebaseConfig()).not.toThrow();
  });

  it('throws in production when API key is missing or placeholder', () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyFakeKeyForTestingPurposesOnly00';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-proj';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:test';

    expect(() => assertFirebaseConfig()).toThrow(/Firebase configuration is missing or incomplete/);
  });

  it('passes in production when valid credentials are provided', () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyRealApiKeyForProductionHere';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'padq-prod-123';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abcdef';

    expect(() => assertFirebaseConfig()).not.toThrow();
  });
});
