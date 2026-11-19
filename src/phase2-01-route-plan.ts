export type RouteRegion = "eu" | "us" | "apac" | "unknown";
export type RouteKind = "interactive" | "batch" | "export" | "replay";

export interface RouteInput {
  region: RouteRegion;
  kind: RouteKind;
  priority: number;
  residencyRequired: boolean;
  fallbackAllowed: boolean;
}

export type RoutePlan = {
  destination: "regional-fast" | "regional-standard" | "fallback" | "reject";
  reason: string;
};

export function planFixtureRoute(input: RouteInput): RoutePlan {
  if (!Number.isFinite(input.priority) || input.priority < 0) {
    return { destination: "reject", reason: "invalid priority" };
  }
  if (input.residencyRequired && input.region === "unknown") {
    return input.fallbackAllowed
      ? { destination: "fallback", reason: "residency region is unknown" }
      : { destination: "reject", reason: "residency cannot be guaranteed" };
  }
  if (input.kind === "replay") {
    return { destination: "regional-standard", reason: "replay is never expedited" };
  }
  if (input.kind === "export" && input.region === "apac") {
    return { destination: "regional-standard", reason: "APAC exports use standard capacity" };
  }
  if (input.priority >= 80 && input.kind === "interactive") {
    return { destination: "regional-fast", reason: "high-priority interactive request" };
  }
  if (input.region === "unknown") {
    return input.fallbackAllowed
      ? { destination: "fallback", reason: "no regional route was resolved" }
      : { destination: "reject", reason: "no safe route is available" };
  }
  return { destination: "regional-standard", reason: "default regional route" };
}
