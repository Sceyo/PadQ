/**
 * V1 launch surface. Deferred features remain in the codebase and on the
 * all-features archive branch, but cannot be selected from the production UI.
 */
export const V1_RELEASE = {
  queueMode: 'default',
  maxCourts: 3,
  maxPlayers: 30,
  showQueueModeSelector: false,
  showAccessPinSetup: false,
  showSkillTagging: false,
  showLegacyCourtCoordinator: false,
  /**
   * Phase 1+ Kill Switch.
   * When false, the legacy shell and screens render unchanged.
   * When true, the new mobile-first presentation layer renders.
   */
  mobileFirstShell: false,
} as const;
