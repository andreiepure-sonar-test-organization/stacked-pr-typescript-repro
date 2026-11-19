import type { FixtureRequest, ReviewOutcome } from "./pr1119-dev5-baseline.js";

export interface RegionFixtureSummary {
  requests: number;
  enabled: number;
  disabled: number;
  priorities: Record<ReviewOutcome, number>;
}

export function summarizeFixtureRegions(
  requests: readonly FixtureRequest[],
): Record<"eu" | "us" | "apac" | "unknown", RegionFixtureSummary> {
  const createSummary = (): RegionFixtureSummary => ({
    requests: 0,
    enabled: 0,
    disabled: 0,
    priorities: { accept: 0, hold: 0, reject: 0 },
  });
  const regions = {
    eu: createSummary(),
    us: createSummary(),
    apac: createSummary(),
    unknown: createSummary(),
  };

  for (const request of requests) {
    const region = request.region ?? "unknown";
    const summary = regions[region];
    summary.requests += 1;
    if (request.enabled) {
      summary.enabled += 1;
    } else {
      summary.disabled += 1;
    }
    if (request.priority >= 75) {
      summary.priorities.accept += 1;
    } else if (request.priority >= 25) {
      summary.priorities.hold += 1;
    } else {
      summary.priorities.reject += 1;
    }
  }
  return regions;
}
