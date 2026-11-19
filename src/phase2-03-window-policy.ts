export type WindowMode = "normal" | "maintenance" | "emergency";
export type WindowOutcome = "allow" | "hold" | "reject";

export interface WindowRequest {
  hourUtc: number;
  weekdayUtc: number;
  mode: WindowMode;
  operation: "read" | "write" | "migration";
  approvedOverride: boolean;
}

export function evaluateFixtureWindow(request: WindowRequest): WindowOutcome {
  if (!Number.isInteger(request.hourUtc) || request.hourUtc < 0 || request.hourUtc > 23) {
    return "reject";
  }
  if (!Number.isInteger(request.weekdayUtc) || request.weekdayUtc < 0 || request.weekdayUtc > 6) {
    return "reject";
  }
  if (request.mode === "emergency") {
    return request.operation === "migration" && !request.approvedOverride ? "hold" : "allow";
  }
  if (request.mode === "maintenance") {
    if (request.approvedOverride && request.operation !== "migration") {
      return "allow";
    }
    return request.operation === "read" ? "allow" : "hold";
  }
  const isWeekend = request.weekdayUtc === 0 || request.weekdayUtc === 6;
  const isQuietHours = request.hourUtc < 6 || request.hourUtc >= 22;
  if (request.operation === "migration" && (isWeekend || isQuietHours)) {
    return request.approvedOverride ? "allow" : "hold";
  }
  if (request.operation === "write" && isQuietHours && !request.approvedOverride) {
    return "hold";
  }
  return "allow";
}
