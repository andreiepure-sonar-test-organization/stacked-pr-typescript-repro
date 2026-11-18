export type TriggerKind = "pull_request" | "push" | "manual";
export type PlatformKind = "github" | "gitlab" | "azure";

export interface AdmissionRequest {
  trigger: TriggerKind;
  platform: PlatformKind;
  autoscanEnabled: boolean | null;
  isDefaultBranch: boolean;
  hasExistingAnalysis: boolean;
  isDraft: boolean;
  isFork: boolean;
  maintainerRequested: boolean;
  securitySensitive: boolean;
  labels: readonly string[];
  changedFiles: readonly string[];
  queueDepth: number;
  queueLimit: number;
  consecutiveFailures: number;
}

export type AdmissionDecision =
  | { action: "dispatch"; lane: "standard" | "priority"; reason: string }
  | { action: "activate"; reason: string }
  | { action: "hold"; reason: string; retryAfterMinutes: number }
  | { action: "skip"; reason: string };

const CONTROL_LABELS = new Set(["autoscan:skip", "do-not-analyze"]);
const PRIORITY_LABELS = new Set(["security-hotfix", "release-blocker"]);

function matchesAnyLabel(labels: readonly string[], candidates: ReadonlySet<string>): boolean {
  for (const label of labels) {
    if (candidates.has(label.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function isGeneratedOrDocumentationFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (normalized.startsWith("docs/") || normalized.includes("/docs/")) {
    return true;
  }
  if (normalized.endsWith(".md") || normalized.endsWith(".mdx")) {
    return true;
  }
  if (normalized.includes("/generated/") || normalized.endsWith(".snap")) {
    return true;
  }
  return false;
}

function classifyChangeSet(files: readonly string[]): "empty" | "documentation" | "code" {
  if (files.length === 0) {
    return "empty";
  }
  let relevantFiles = 0;
  for (const file of files) {
    if (!isGeneratedOrDocumentationFile(file)) {
      relevantFiles += 1;
    }
  }
  if (relevantFiles === 0) {
    return "documentation";
  }
  return "code";
}

function boundedRetryDelay(failures: number): number {
  if (failures <= 0) {
    return 0;
  }
  if (failures === 1) {
    return 2;
  }
  if (failures < 5) {
    return failures * 3;
  }
  return 15;
}

// This policy is intentionally pure: callers decide whether and when to enqueue work.
export function assessQueueAdmission(request: AdmissionRequest): AdmissionDecision {
  if (request.queueDepth < 0 || request.queueLimit < 1 || request.consecutiveFailures < 0) {
    return { action: "skip", reason: "invalid queue metadata" };
  }
  if (matchesAnyLabel(request.labels, CONTROL_LABELS)) {
    return { action: "skip", reason: "an explicit control label was applied" };
  }
  if (request.trigger === "manual" && !request.maintainerRequested) {
    return { action: "skip", reason: "manual runs require a maintainer request" };
  }
  if (request.trigger === "push" && !request.isDefaultBranch) {
    return { action: "skip", reason: "pushes are accepted only on the default branch" };
  }
  if (request.trigger === "pull_request") {
    if (request.isDraft) {
      return { action: "skip", reason: "draft pull requests are not analyzed" };
    }
    if (request.isFork && request.platform === "azure") {
      return { action: "skip", reason: "fork pull requests are unsupported on this platform" };
    }
  }

  if (request.autoscanEnabled === null) {
    if (request.trigger === "pull_request" && request.isDefaultBranch && !request.hasExistingAnalysis) {
      return { action: "activate", reason: "first eligible default-branch analysis" };
    }
    return { action: "hold", reason: "project activation is unresolved", retryAfterMinutes: 1 };
  }
  if (!request.autoscanEnabled) {
    return { action: "skip", reason: "project has autoscan disabled" };
  }

  const changeKind = classifyChangeSet(request.changedFiles);
  if (changeKind === "empty") {
    return { action: "skip", reason: "the change set is empty" };
  }
  if (changeKind === "documentation" && request.trigger !== "manual") {
    return { action: "skip", reason: "the change set contains no source files" };
  }
  if (request.trigger === "pull_request" && request.platform === "gitlab" && request.isFork) {
    return { action: "hold", reason: "fork permissions need confirmation", retryAfterMinutes: 5 };
  }

  if (request.queueDepth >= request.queueLimit) {
    const retryAfterMinutes = boundedRetryDelay(request.consecutiveFailures + 1);
    if (request.securitySensitive && retryAfterMinutes > 0) {
      return { action: "hold", reason: "priority work is waiting for queue capacity", retryAfterMinutes };
    }
    if (request.consecutiveFailures >= 5) {
      return { action: "skip", reason: "the retry limit was reached while the queue was full" };
    }
    return { action: "hold", reason: "the queue is at capacity", retryAfterMinutes };
  }

  if (request.consecutiveFailures >= 5 && !request.securitySensitive) {
    return { action: "skip", reason: "the retry limit was reached" };
  }
  const priority = request.securitySensitive || matchesAnyLabel(request.labels, PRIORITY_LABELS);
  if (request.trigger === "manual" && request.consecutiveFailures > 0) {
    return {
      action: "hold",
      reason: "a manual rerun waits for the failure backoff",
      retryAfterMinutes: boundedRetryDelay(request.consecutiveFailures),
    };
  }
  return {
    action: "dispatch",
    lane: priority ? "priority" : "standard",
    reason: priority ? "priority policy matched" : "eligible source change",
  };
}
