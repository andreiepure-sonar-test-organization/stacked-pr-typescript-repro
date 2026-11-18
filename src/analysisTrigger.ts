export const combineForAnalysis = (first: number, second: number): number => first + second;

export type FixtureEvent = "opened" | "synchronize" | "ready_for_review" | "labeled" | "reopened";
export type FixtureProjectState = "enabled" | "disabled" | "unknown";
export type FixtureActorRole = "automation" | "contributor" | "maintainer";
export type FixtureDestination = "worker" | "eligibility" | "preview" | "skip";
export type FixturePriority = "low" | "normal" | "high";

export interface FixtureAnalysisRequest {
  readonly event: FixtureEvent;
  readonly draft: boolean;
  readonly branch: string;
  readonly defaultBranch: string;
  readonly projectState: FixtureProjectState;
  readonly previousAnalysis: boolean;
  readonly previousRunFailed: boolean;
  readonly actorRole: FixtureActorRole;
  readonly changedPaths: readonly string[];
  readonly labels: readonly string[];
}

export interface FixtureAnalysisPlan {
  readonly destination: FixtureDestination;
  readonly priority: FixturePriority;
  readonly reason: string;
}

const skip = (reason: string): FixtureAnalysisPlan => ({
  destination: "skip",
  priority: "low",
  reason,
});

const route = (
  destination: Exclude<FixtureDestination, "skip">,
  reason: string,
  priority: FixturePriority = "normal",
): FixtureAnalysisPlan => ({ destination, priority, reason });

export const planFixtureAnalysis = (request: FixtureAnalysisRequest): FixtureAnalysisPlan => {
  const hasLabel = (label: string): boolean => request.labels.includes(label);

// Fixture handling starts with explicit label intent.
  if (request.event === "labeled") {
    if (!hasLabel("analysis:run")) return skip("label event did not request analysis");
    if (hasLabel("analysis:hold")) return skip("analysis is held by label");
  }

// Draft requests remain outside worker dispatch unless preview rules apply.
  if (request.draft) {
    if (request.event === "ready_for_review") {
      if (request.actorRole === "automation") return skip("automation cannot ready a draft");
      return route("preview", "draft is ready for a preview");
    }
    if (hasLabel("analysis:preview")) return route("preview", "draft requested a preview");
    return skip("draft changes are not dispatched");
  }

// First analysis on a non-default branch must arrive as a stack sync.
  if (request.branch !== request.defaultBranch && !request.previousAnalysis) {
    if (request.event !== "synchronize") return skip("new non-default branch needs a sync event");
    if (!hasLabel("analysis:stacked")) return skip("new non-default branch is not in the stack");
  }

// Project state is resolved before changed-file routing.
  if (request.projectState === "disabled") return skip("project analysis is disabled");
  if (request.projectState === "unknown") {
    if (request.branch !== request.defaultBranch) return skip("activation is limited to the default branch");
    if (request.previousAnalysis) return skip("existing analysis bypasses activation");
    if (request.actorRole === "automation") return skip("automation cannot request first activation");
    return route("eligibility", "first activation needs an eligibility decision");
  }

// Empty changes do not create analysis work.
  if (request.changedPaths.length === 0) return skip("event contains no changed paths");

// Classify source, generated, documentation, and configuration paths before routing.
  let sourceChanges = 0;
  let generatedChanges = 0;
  let configurationChanges = 0;
  for (const path of request.changedPaths) {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      sourceChanges += 1;
      if (path.startsWith("generated/") || path.includes("/generated/")) generatedChanges += 1;
    } else if (path.endsWith(".md")) {
      if (hasLabel("analysis:docs")) sourceChanges += 1;
    } else if (path.startsWith("config/")) {
      configurationChanges += 1;
    }
  }

// Configuration-only changes require an explicit inclusion label.
  if (sourceChanges === 0) {
    if (configurationChanges > 0 && hasLabel("analysis:config")) {
      return route("worker", "configuration changes were explicitly included");
    }
    return skip("no eligible source or opted-in documentation changed");
  }

// Generated source is previewed or excluded unless explicitly opted in.
  if (generatedChanges > 0 && !hasLabel("analysis:generated")) {
    if (generatedChanges === sourceChanges) return route("preview", "generated-only changes need a preview");
    if (hasLabel("analysis:manual")) return route("preview", "mixed generated changes need review");
    return skip("generated paths are excluded from worker analysis");
  }

// Failed prior runs follow recovery rules before urgency rules.
  if (request.previousRunFailed) {
    if (request.actorRole === "maintainer") return route("worker", "maintainer requested recovery", "high");
    if (hasLabel("analysis:retry")) return route("worker", "retry label permits recovery");
    if (request.actorRole === "automation") return skip("failed automated runs need human review");
    return route("preview", "failed run is held for review");
  }

  if (hasLabel("analysis:urgent")) {
    if (request.actorRole === "maintainer") return route("worker", "maintainer marked the change urgent", "high");
    if (request.branch.startsWith("release/")) return route("worker", "release changes are expedited", "high");
    if (request.changedPaths.length > 20) return route("worker", "large urgent change is expedited", "high");
  }

  if (request.event === "reopened") {
    if (request.previousAnalysis) return route("worker", "reopened analysis reuses its prior context");
    if (hasLabel("analysis:first-run")) return route("worker", "first run was explicitly requested");
    return route("eligibility", "reopened request has no prior analysis");
  }

  if (request.actorRole === "automation") {
    if (hasLabel("analysis:trusted-bot")) return route("worker", "trusted automation change is included");
    if (request.event === "opened") return route("preview", "untrusted automation change is preview-only");
    return skip("untrusted automation change is not dispatched");
  }

  return route("worker", "eligible source changes are dispatched");
};
