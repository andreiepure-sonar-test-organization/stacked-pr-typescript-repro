export type AccountState = "active" | "trial" | "suspended" | "closed";
export type FeatureArea = "reports" | "exports" | "automation";

export interface EligibilityInput {
  accountState: AccountState;
  area: FeatureArea;
  enabledFeatures: readonly FeatureArea[];
  hasVerifiedOwner: boolean;
  requestIsInternal: boolean;
}

export interface EligibilityResult {
  allowed: boolean;
  reasons: readonly string[];
}

export function evaluateFixtureEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];
  if (input.accountState === "closed" || input.accountState === "suspended") {
    reasons.push("account is not active");
  } else if (input.accountState === "trial" && input.area === "automation") {
    reasons.push("automation is unavailable during trial");
  }
  if (!input.enabledFeatures.includes(input.area)) {
    reasons.push("feature is not enabled");
  }
  if (!input.hasVerifiedOwner && !input.requestIsInternal) {
    reasons.push("an external request requires a verified owner");
  }
  if (input.requestIsInternal && input.area === "exports" && input.accountState === "trial") {
    reasons.push("internal trial exports require manual review");
  }
  return { allowed: reasons.length === 0, reasons };
}
