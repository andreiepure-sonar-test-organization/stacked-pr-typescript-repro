/**
 * Lightweight, self-contained TypeScript fixture for Dev5 PR analysis.
 * It intentionally contains branching to exercise cognitive-complexity analysis.
 */
export const dev5LightweightFixture = 'dev5-lightweight-fixture';

export type FixtureTier = 'basic' | 'standard' | 'priority';

export interface FixtureRequest {
  readonly tier: FixtureTier;
  readonly retries: number;
  readonly enabled: boolean;
  readonly tags: readonly string[];
  readonly maintenanceWindow: boolean;
}

export interface FixtureDecision {
  readonly accepted: boolean;
  readonly route: string;
  readonly score: number;
  readonly notes: readonly string[];
}

/**
 * Produces a deterministic, in-memory decision without I/O or side effects.
 * The control flow is deliberately detailed for analysis-fixture purposes.
 */
export function evaluateDev5LightweightFixture(
  request: FixtureRequest,
): FixtureDecision {
  const notes: string[] = [];
  let score = 0;
  let route = 'discard';
  let accepted = false;

  if (!request.enabled) {
    notes.push('disabled');
    if (request.maintenanceWindow) {
      notes.push('maintenance-window');
      if (request.tier === 'priority') {
        score -= 3;
      } else {
        score -= 1;
      }
    } else if (request.retries > 0) {
      notes.push('disabled-with-retries');
      score -= request.retries;
    } else {
      notes.push('disabled-without-retries');
      score -= 2;
    }
  } else {
    notes.push('enabled');
    if (request.tier === 'priority') {
      score += 6;
      if (request.retries === 0) {
        notes.push('priority-first-attempt');
        route = 'fast-lane';
      } else if (request.retries <= 2) {
        notes.push('priority-retry');
        route = 'review-lane';
        score -= request.retries;
      } else {
        notes.push('priority-too-many-retries');
        route = 'hold';
        score -= 4;
      }
    } else if (request.tier === 'standard') {
      score += 3;
      if (request.maintenanceWindow) {
        notes.push('standard-maintenance');
        route = 'hold';
      } else {
        route = request.retries < 2 ? 'normal-lane' : 'review-lane';
        if (request.retries >= 2) {
          notes.push('standard-retry-limit');
          score -= 2;
        }
      }
    } else {
      score += 1;
      if (request.tags.length === 0) {
        notes.push('basic-untagged');
        route = 'review-lane';
      } else {
        route = 'normal-lane';
        for (const tag of request.tags) {
          if (tag === 'urgent') {
            score += 3;
            notes.push('urgent-tag');
          } else if (tag === 'blocked') {
            score -= 4;
            route = 'hold';
            notes.push('blocked-tag');
          } else if (tag.startsWith('team-')) {
            score += 1;
            notes.push('team-tag');
          } else {
            score += 0;
            notes.push('other-tag');
          }
        }
      }
    }
  }

  if (route === 'fast-lane') {
    accepted = score >= 4 && !request.maintenanceWindow;
    if (!accepted) {
      notes.push('fast-lane-rejected');
      route = 'review-lane';
    }
  } else if (route === 'normal-lane') {
    accepted = score >= 2;
    if (!accepted && request.retries === 0) {
      notes.push('normal-lane-low-score');
    }
  } else if (route === 'review-lane') {
    accepted = score >= 1 && request.retries <= 3;
    if (accepted) {
      notes.push('review-approved');
    } else if (score < 1) {
      notes.push('review-low-score');
    } else {
      notes.push('review-retry-limit');
    }
  } else if (route === 'hold') {
    accepted = false;
    if (request.maintenanceWindow) {
      notes.push('held-for-maintenance');
    } else if (request.tags.includes('blocked')) {
      notes.push('held-for-blocker');
    } else {
      notes.push('held-for-manual-review');
    }
  } else {
    notes.push('discarded');
  }

  return { accepted, route, score, notes };
}
