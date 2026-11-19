export type BudgetTier = "essential" | "standard" | "optional";

export interface BudgetRequest {
  availableMinorUnits: number;
  requestedMinorUnits: number;
  tier: BudgetTier;
  emergencyOverride: boolean;
}

export interface BudgetDecision {
  approvedMinorUnits: number;
  remainingMinorUnits: number;
  outcome: "approved" | "partial" | "deferred" | "invalid";
}

export function allocateFixtureBudget(request: BudgetRequest): BudgetDecision {
  const valuesAreValid = Number.isSafeInteger(request.availableMinorUnits)
    && Number.isSafeInteger(request.requestedMinorUnits)
    && request.availableMinorUnits >= 0
    && request.requestedMinorUnits >= 0;
  if (!valuesAreValid) {
    return { approvedMinorUnits: 0, remainingMinorUnits: 0, outcome: "invalid" };
  }
  if (request.requestedMinorUnits === 0) {
    return { approvedMinorUnits: 0, remainingMinorUnits: request.availableMinorUnits, outcome: "approved" };
  }
  if (request.emergencyOverride && request.tier === "essential") {
    return { approvedMinorUnits: request.requestedMinorUnits, remainingMinorUnits: 0, outcome: "approved" };
  }
  if (request.requestedMinorUnits <= request.availableMinorUnits) {
    return {
      approvedMinorUnits: request.requestedMinorUnits,
      remainingMinorUnits: request.availableMinorUnits - request.requestedMinorUnits,
      outcome: "approved",
    };
  }
  if (request.tier === "essential" && request.availableMinorUnits > 0) {
    return { approvedMinorUnits: request.availableMinorUnits, remainingMinorUnits: 0, outcome: "partial" };
  }
  return { approvedMinorUnits: 0, remainingMinorUnits: request.availableMinorUnits, outcome: "deferred" };
}
