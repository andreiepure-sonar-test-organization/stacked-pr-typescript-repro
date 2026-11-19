export type ScheduleDecision = "run-now" | "retry-later" | "stop";

export interface ScheduleInput {
  attempt: number;
  maximumAttempts: number;
  retryAfterSeconds?: number;
  isTransient: boolean;
  isCancelled: boolean;
}

export interface SchedulePlan {
  decision: ScheduleDecision;
  delaySeconds: number;
}

export function planFixtureSchedule(input: ScheduleInput): SchedulePlan {
  if (!Number.isInteger(input.attempt) || input.attempt < 0 || !Number.isInteger(input.maximumAttempts)) {
    return { decision: "stop", delaySeconds: 0 };
  }
  if (input.isCancelled || input.attempt >= input.maximumAttempts || !input.isTransient) {
    return { decision: "stop", delaySeconds: 0 };
  }
  if (input.retryAfterSeconds !== undefined) {
    if (!Number.isFinite(input.retryAfterSeconds) || input.retryAfterSeconds < 0) {
      return { decision: "stop", delaySeconds: 0 };
    }
    return { decision: "retry-later", delaySeconds: Math.min(3600, Math.ceil(input.retryAfterSeconds)) };
  }
  const exponentialDelay = 2 ** Math.min(input.attempt, 10);
  const policyDelay = input.attempt < 2 ? 5 : exponentialDelay * 3;
  return { decision: "retry-later", delaySeconds: Math.min(policyDelay, 1800) };
}
