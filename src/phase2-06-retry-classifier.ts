export type FailureKind = "network" | "quota" | "permission" | "invalid-input" | "unknown";
export type RetryClass = "retry" | "wait" | "fail";

export interface FailureInput {
  kind: FailureKind;
  httpStatus?: number;
  attempt: number;
  retryBudgetAvailable: boolean;
}

export function classifyFixtureFailure(input: FailureInput): RetryClass {
  if (!Number.isInteger(input.attempt) || input.attempt < 0) {
    return "fail";
  }
  if (input.kind === "invalid-input" || input.kind === "permission") {
    return "fail";
  }
  if (input.kind === "quota") {
    return input.httpStatus === 429 ? "wait" : "fail";
  }
  if (input.kind === "network") {
    return input.retryBudgetAvailable ? "retry" : "fail";
  }
  if (input.httpStatus === 408 || input.httpStatus === 425) {
    return input.retryBudgetAvailable ? "wait" : "fail";
  }
  return "fail";
}
