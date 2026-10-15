/**
 * V1.2 launch surface. Deferred features remain in the codebase and on the
 * all-features archive branch, but cannot be selected from the production UI.
 */
export const V1_RELEASE = {
  queueMode: 'default',
  maxCourts: 3,
  maxPlayers: 30,
  showQueueModeSelector: true,
  showAccessPinSetup: false,
  showSkillTagging: true,
  showLegacyCourtCoordinator: false,
} as const;
