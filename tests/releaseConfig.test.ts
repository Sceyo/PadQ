import { describe, expect, it } from 'vitest';
import { V1_RELEASE } from '../app/queue/lib/releaseConfig';

describe('V1 release surface', () => {
  it('keeps only the production-ready launch modes exposed', () => {
    expect(V1_RELEASE).toMatchObject({
      queueMode: 'default',
      maxCourts: 3,
      showQueueModeSelector: false,
      showAccessPinSetup: false,
      showSkillTagging: false,
      showLegacyCourtCoordinator: false,
    });
  });
});
