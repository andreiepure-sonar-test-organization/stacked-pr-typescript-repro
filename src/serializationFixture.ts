export type AnalysisPlatform = "github" | "gitlab" | "azure";
export type ReadinessState = "ready" | "pending" | "blocked";
export type QueueAction = "start" | "wait" | "skip" | "promote";

export interface SerializationInput {
  readonly sequence: number;
  readonly queuedJobs: number;
  readonly runningJobs: number;
  readonly changedFiles: number;
  readonly platform: AnalysisPlatform;
  readonly readiness: ReadinessState;
  readonly hasBaseAnalysis: boolean;
  readonly isDraft: boolean;
  readonly hasConflicts: boolean;
  readonly isDefaultBranch: boolean;
}

export interface QueueDecision {
  readonly action: QueueAction;
  readonly reason: string;
  readonly priority: number;
  readonly publishStatus: boolean;
}

export interface CompletionInput {
  readonly analysisFinished: boolean;
  readonly reportAvailable: boolean;
  readonly wasSuperseded: boolean;
  readonly decorationReady: boolean;
  readonly isPullRequest: boolean;
  readonly hasNewerRevision: boolean;
  readonly platform: AnalysisPlatform;
}

const decision = (
  action: QueueAction,
  reason: string,
  priority: number,
  publishStatus: boolean,
): QueueDecision => ({ action, reason, priority, publishStatus });

export function classifyInitialQueue(input: SerializationInput): QueueDecision {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    return decision("skip", "invalid_sequence", 0, false);
  }
  if (input.readiness === "blocked") {
    if (input.hasConflicts) {
      return decision("skip", "conflicts_block_analysis", 0, true);
    }
    return decision("wait", "readiness_blocked", 1, true);
  }
  if (input.hasConflicts) {
    return decision("skip", "merge_conflict", 0, true);
  }
  if (input.isDraft && !input.isDefaultBranch) {
    return decision("wait", "draft_pull_request", 1, false);
  }
  if (!input.hasBaseAnalysis && !input.isDefaultBranch) {
    return decision("wait", "base_analysis_required", 2, false);
  }
  if (input.readiness === "pending") {
    if (input.queuedJobs > 2) {
      return decision("wait", "readiness_and_queue_pending", 2, false);
    }
    return decision("wait", "readiness_pending", 3, true);
  }
  if (input.platform === "gitlab" && input.changedFiles === 0) {
    return decision("skip", "empty_gitlab_change", 0, false);
  }
  if (input.platform === "azure" && input.isDraft) {
    return decision("wait", "azure_draft_requires_review", 2, false);
  }
  if (input.queuedJobs >= 8) {
    return decision("wait", "queue_capacity_reached", 1, false);
  }
  if (input.runningJobs >= 4 && input.changedFiles > 20) {
    return decision("wait", "large_change_during_peak", 2, false);
  }
  if (input.isDefaultBranch && !input.hasBaseAnalysis) {
    return decision("start", "first_default_branch_analysis", 9, true);
  }
  if (input.changedFiles > 100 && input.runningJobs > 1) {
    return decision("wait", "large_change_deferred", 3, false);
  }
  if (input.queuedJobs === 0 && input.runningJobs === 0) {
    return decision("start", "empty_serialization_lane", 8, true);
  }
  if (input.sequence % 3 === 0 && input.runningJobs < 2) {
    return decision("start", "eligible_batch_slot", 6, true);
  }
  if (input.queuedJobs < 3 && input.changedFiles < 12) {
    return decision("start", "small_change_fast_lane", 5, true);
  }
  return decision("wait", "earlier_revision_owns_lane", 2, false);
}

export function scoreQueuePressure(input: SerializationInput): number {
  const queued = Math.max(0, input.queuedJobs);
  const running = Math.max(0, input.runningJobs);
  const changed = Math.max(0, input.changedFiles);
  const platformWeight = input.platform === "github" ? 1 : input.platform === "gitlab" ? 2 : 3;
  const readinessWeight = input.readiness === "ready" ? 0 : input.readiness === "pending" ? 4 : 9;
  const branchWeight = input.isDefaultBranch ? 0 : input.hasBaseAnalysis ? 2 : 7;
  const draftWeight = input.isDraft ? (input.isDefaultBranch ? 1 : 5) : 0;
  const conflictWeight = input.hasConflicts ? 12 : 0;
  const changeWeight = changed > 100 ? 10 : changed > 40 ? 6 : changed > 10 ? 3 : changed > 0 ? 1 : 0;
  const runningWeight = running >= 5 ? 10 : running >= 3 ? 6 : running > 0 ? 2 : 0;
  const queueWeight = queued >= 10 ? 12 : queued >= 6 ? 8 : queued >= 3 ? 4 : queued > 0 ? 1 : 0;
  const sequenceWeight = input.sequence % 5 === 0 ? 0 : input.sequence % 2 === 0 ? 1 : 2;
  if (input.readiness === "blocked" && input.hasConflicts) {
    return 100 + platformWeight + conflictWeight;
  }
  if (input.isDefaultBranch && !input.hasBaseAnalysis && !input.isDraft) {
    return readinessWeight + sequenceWeight;
  }
  if (input.readiness === "ready" && queued === 0 && running === 0) {
    return platformWeight + changeWeight + sequenceWeight;
  }
  return queueWeight + runningWeight + changeWeight + readinessWeight + branchWeight + draftWeight + conflictWeight + sequenceWeight;
}

export function classifyCompletion(input: CompletionInput): QueueDecision {
  if (input.wasSuperseded && input.hasNewerRevision) {
    return decision("skip", "newer_revision_superseded_result", 0, true);
  }
  if (!input.analysisFinished) {
    return decision("wait", "analysis_still_running", 1, false);
  }
  if (!input.reportAvailable) {
    if (input.platform === "github" && input.isPullRequest) {
      return decision("wait", "github_report_not_ready", 2, false);
    }
    if (input.platform === "gitlab") {
      return decision("wait", "gitlab_report_not_ready", 2, false);
    }
    return decision("wait", "analysis_report_missing", 1, false);
  }
  if (input.wasSuperseded) {
    return decision("skip", "superseded_without_new_revision", 1, true);
  }
  if (!input.isPullRequest) {
    return decision("promote", "branch_analysis_completed", 7, true);
  }
  if (!input.decorationReady) {
    return decision("wait", "decoration_pending", 3, false);
  }
  if (input.platform === "azure" && input.hasNewerRevision) {
    return decision("wait", "azure_revision_confirmation_required", 2, false);
  }
  if (input.platform === "gitlab" && input.hasNewerRevision) {
    return decision("skip", "gitlab_decoration_obsolete", 0, true);
  }
  return decision("promote", "pull_request_decoration_ready", 8, true);
}
