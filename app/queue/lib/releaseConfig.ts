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
} as const;
