import type { FixtureDecision, FixtureRequest } from "./pr1119-dev5-baseline.js";

export interface FixtureRetryPlan {
  retry: boolean;
  delayMinutes: number;
  reason: string;
}

export function planFixtureRetry(
  request: FixtureRequest,
  decision: FixtureDecision,
  waitMinutes: number,
): FixtureRetryPlan {
  if (decision.outcome === "reject") {
    return { retry: false, delayMinutes: 0, reason: "rejected requests require correction" };
  }
  if (request.retries >= 5) {
    return { retry: false, delayMinutes: 0, reason: "retry limit reached" };
  }
  if (decision.outcome === "hold" && request.channel === "manual") {
    return { retry: true, delayMinutes: Math.max(waitMinutes, 30), reason: "manual review is pending" };
  }
  if (decision.queue === "fast" && request.retries === 0) {
    return { retry: false, delayMinutes: 0, reason: "fast requests proceed without retry" };
  }
  if (decision.queue === "deferred" && request.channel === "replay") {
    return { retry: true, delayMinutes: Math.max(waitMinutes, 120), reason: "replay waits for its next window" };
  }
  if (request.retries >= 3) {
    return { retry: true, delayMinutes: Math.max(waitMinutes, 60), reason: "retry backoff is extended" };
  }
  if (decision.outcome === "hold") {
    return { retry: true, delayMinutes: Math.max(waitMinutes, 15), reason: "held request can be reviewed again" };
  }
  return { retry: true, delayMinutes: Math.max(waitMinutes, 5), reason: "request remains eligible" };
}
