import { classifyCompletion, classifyInitialQueue, scoreQueuePressure } from "./serializationFixture.js";
import type { CompletionInput, QueueDecision, SerializationInput } from "./serializationFixture.js";

type QueueScenario = {
  readonly kind: "queue";
  readonly name: string;
  readonly input: SerializationInput;
  readonly expected: QueueDecision;
};

type CompletionScenario = {
  readonly kind: "completion";
  readonly name: string;
  readonly input: CompletionInput;
  readonly expected: QueueDecision;
};

type PressureScenario = {
  readonly kind: "pressure";
  readonly name: string;
  readonly input: SerializationInput;
  readonly expectedScore: number;
};

export type SerializationScenario = QueueScenario | CompletionScenario | PressureScenario;

const readyQueueInput: SerializationInput = {
  sequence: 1, queuedJobs: 0, runningJobs: 0, changedFiles: 5,
  platform: "github", readiness: "ready", hasBaseAnalysis: true,
  isDraft: false, hasConflicts: false, isDefaultBranch: false,
};

const completedPullRequest: CompletionInput = {
  analysisFinished: true, reportAvailable: true, wasSuperseded: false,
  decorationReady: true, isPullRequest: true, hasNewerRevision: false, platform: "github",
};

export const serializationScenarios: readonly SerializationScenario[] = [
  {
    kind: "queue",
    name: "empty-ready-lane-starts-first-job",
    input: readyQueueInput,
    expected: { action: "start", reason: "empty_serialization_lane", priority: 8, publishStatus: true },
  },
  {
    kind: "queue",
    name: "queue-capacity-precedes-small-change-fast-lane",
    input: { ...readyQueueInput, queuedJobs: 8 },
    expected: { action: "wait", reason: "queue_capacity_reached", priority: 1, publishStatus: false },
  },
  {
    kind: "queue",
    name: "large-change-waits-during-peak",
    input: { ...readyQueueInput, queuedJobs: 2, runningJobs: 4, changedFiles: 25 },
    expected: { action: "wait", reason: "large_change_during_peak", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "first-default-branch-analysis-starts",
    input: { ...readyQueueInput, hasBaseAnalysis: false, isDefaultBranch: true },
    expected: { action: "start", reason: "first_default_branch_analysis", priority: 9, publishStatus: true },
  },
  {
    kind: "pressure",
    name: "blocked-conflict-adds-high-queue-pressure",
    input: { ...readyQueueInput, readiness: "blocked", hasConflicts: true },
    expectedScore: 113,
  },
  {
    kind: "queue",
    name: "blocked-conflict-skips-analysis-with-status",
    input: { ...readyQueueInput, readiness: "blocked", hasConflicts: true },
    expected: { action: "skip", reason: "conflicts_block_analysis", priority: 0, publishStatus: true },
  },
  {
    kind: "queue",
    name: "pending-readiness-waits-behind-queued-jobs",
    input: { ...readyQueueInput, readiness: "pending", queuedJobs: 3 },
    expected: { action: "wait", reason: "readiness_and_queue_pending", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "empty-gitlab-change-is-skipped",
    input: { ...readyQueueInput, platform: "gitlab", changedFiles: 0 },
    expected: { action: "skip", reason: "empty_gitlab_change", priority: 0, publishStatus: false },
  },
  {
    kind: "completion",
    name: "newer-revision-supersedes-old-result",
    input: { ...completedPullRequest, wasSuperseded: true, hasNewerRevision: true },
    expected: { action: "skip", reason: "newer_revision_superseded_result", priority: 0, publishStatus: true },
  },
  {
    kind: "completion",
    name: "pull-request-promotes-after-decoration-is-ready",
    input: completedPullRequest,
    expected: { action: "promote", reason: "pull_request_decoration_ready", priority: 8, publishStatus: true },
  },
  {
    kind: "queue",
    name: "invalid-sequence-is-skipped",
    input: { ...readyQueueInput, sequence: 0 },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "queue",
    name: "draft-pull-request-waits-for-review",
    input: { ...readyQueueInput, isDraft: true },
    expected: { action: "wait", reason: "draft_pull_request", priority: 1, publishStatus: false },
  },
  {
    kind: "queue",
    name: "non-default-branch-requires-base-analysis",
    input: { ...readyQueueInput, hasBaseAnalysis: false },
    expected: { action: "wait", reason: "base_analysis_required", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "blocked-readiness-waits-with-status",
    input: { ...readyQueueInput, readiness: "blocked" },
    expected: { action: "wait", reason: "readiness_blocked", priority: 1, publishStatus: true },
  },
  {
    kind: "queue",
    name: "pending-readiness-with-open-capacity",
    input: { ...readyQueueInput, readiness: "pending" },
    expected: { action: "wait", reason: "readiness_pending", priority: 3, publishStatus: true },
  },
  {
    kind: "queue",
    name: "azure-default-draft-requires-review",
    input: { ...readyQueueInput, platform: "azure", isDefaultBranch: true, isDraft: true },
    expected: { action: "wait", reason: "azure_draft_requires_review", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "very-large-change-defers-with-active-work",
    input: { ...readyQueueInput, runningJobs: 2, changedFiles: 101 },
    expected: { action: "wait", reason: "large_change_deferred", priority: 3, publishStatus: false },
  },
  {
    kind: "queue",
    name: "eligible-batch-slot-starts",
    input: { ...readyQueueInput, sequence: 3, queuedJobs: 2, runningJobs: 1, changedFiles: 25 },
    expected: { action: "start", reason: "eligible_batch_slot", priority: 6, publishStatus: true },
  },
  {
    kind: "queue",
    name: "small-change-fast-lane-starts",
    input: { ...readyQueueInput, queuedJobs: 2, runningJobs: 1, changedFiles: 11 },
    expected: { action: "start", reason: "small_change_fast_lane", priority: 5, publishStatus: true },
  },
  {
    kind: "queue",
    name: "earlier-revision-retains-active-lane",
    input: { ...readyQueueInput, sequence: 2, queuedJobs: 3, runningJobs: 2, changedFiles: 30 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "fractional-sequence-is-skipped",
    input: { ...readyQueueInput, sequence: 1.5 },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "queue",
    name: "ready-merge-conflict-skips-analysis",
    input: { ...readyQueueInput, hasConflicts: true },
    expected: { action: "skip", reason: "merge_conflict", priority: 0, publishStatus: true },
  },
  {
    kind: "queue",
    name: "earlier-revision-keeps-lane-below-capacity",
    input: { ...readyQueueInput, queuedJobs: 7 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "first-default-analysis-starts-for-draft-branch",
    input: { ...readyQueueInput, isDefaultBranch: true, isDraft: true, hasBaseAnalysis: false },
    expected: { action: "start", reason: "first_default_branch_analysis", priority: 9, publishStatus: true },
  },
  {
    kind: "pressure",
    name: "blocked-azure-conflict-has-platform-weight",
    input: { ...readyQueueInput, platform: "azure", readiness: "blocked", hasConflicts: true },
    expectedScore: 115,
  },
  {
    kind: "pressure",
    name: "default-first-analysis-uses-even-sequence-pressure",
    input: { ...readyQueueInput, sequence: 2, isDefaultBranch: true, hasBaseAnalysis: false },
    expectedScore: 1,
  },
  {
    kind: "completion",
    name: "unfinished-analysis-waits-for-completion",
    input: { ...completedPullRequest, analysisFinished: false },
    expected: { action: "wait", reason: "analysis_still_running", priority: 1, publishStatus: false },
  },
  {
    kind: "completion",
    name: "github-pull-request-waits-for-missing-report",
    input: { ...completedPullRequest, reportAvailable: false },
    expected: { action: "wait", reason: "github_report_not_ready", priority: 2, publishStatus: false },
  },
  {
    kind: "completion",
    name: "superseded-result-skips-without-newer-revision",
    input: { ...completedPullRequest, wasSuperseded: true },
    expected: { action: "skip", reason: "superseded_without_new_revision", priority: 1, publishStatus: true },
  },
  {
    kind: "completion",
    name: "completed-branch-analysis-promotes-without-pr-decoration",
    input: { ...completedPullRequest, isPullRequest: false },
    expected: { action: "promote", reason: "branch_analysis_completed", priority: 7, publishStatus: true },
  },
  {
    kind: "queue",
    name: "largest-safe-sequence-uses-batch-slot",
    input: { ...readyQueueInput, sequence: Number.MAX_SAFE_INTEGER - 1, queuedJobs: 2, runningJobs: 1, changedFiles: 14 },
    expected: { action: "start", reason: "eligible_batch_slot", priority: 6, publishStatus: true },
  },
  {
    kind: "queue",
    name: "postdeploy-phase1-capacity-minus-one-falls-through-to-lane-owner",
    input: { ...readyQueueInput, queuedJobs: 7, changedFiles: 12 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase1-peak-threshold-excludes-exactly-twenty-files",
    input: { ...readyQueueInput, runningJobs: 4, changedFiles: 20 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase1-unsafe-sequence-above-safe-integer-is-skipped",
    input: { ...readyQueueInput, sequence: Number.MAX_SAFE_INTEGER + 1 },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "pressure",
    name: "postdeploy-phase1-negative-pressure-inputs-clamp-to-zero",
    input: { ...readyQueueInput, sequence: 5, queuedJobs: -1, runningJobs: -2, changedFiles: -4 },
    expectedScore: 1,
  },
  {
    kind: "pressure",
    name: "postdeploy-phase1-change-count-forty-uses-middle-pressure-band",
    input: { ...readyQueueInput, sequence: 5, changedFiles: 40 },
    expectedScore: 4,
  },
  {
    kind: "pressure",
    name: "postdeploy-phase1-change-count-forty-one-uses-next-pressure-band",
    input: { ...readyQueueInput, sequence: 5, changedFiles: 41 },
    expectedScore: 7,
  },
  {
    kind: "pressure",
    name: "postdeploy-phase1-six-queued-jobs-use-middle-queue-pressure-band",
    input: { ...readyQueueInput, sequence: 5, queuedJobs: 6, runningJobs: 1, changedFiles: 0 },
    expectedScore: 12,
  },
  {
    kind: "pressure",
    name: "postdeploy-phase1-ten-queued-jobs-use-high-queue-pressure-band",
    input: { ...readyQueueInput, sequence: 5, queuedJobs: 10, changedFiles: 0 },
    expectedScore: 14,
  },
  {
    kind: "completion",
    name: "postdeploy-phase1-gitlab-missing-report-waits-with-specific-reason",
    input: { ...completedPullRequest, platform: "gitlab", reportAvailable: false },
    expected: { action: "wait", reason: "gitlab_report_not_ready", priority: 2, publishStatus: false },
  },
  {
    kind: "completion",
    name: "postdeploy-phase1-azure-missing-report-uses-generic-wait",
    input: { ...completedPullRequest, platform: "azure", reportAvailable: false },
    expected: { action: "wait", reason: "analysis_report_missing", priority: 1, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase2-gitlab-empty-change-does-not-bypass-pending-readiness",
    input: { ...readyQueueInput, platform: "gitlab", readiness: "pending", changedFiles: 0 },
    expected: { action: "wait", reason: "readiness_pending", priority: 3, publishStatus: true },
  },
  {
    kind: "queue",
    name: "postdeploy-phase2-azure-default-draft-waits-even-with-base-analysis",
    input: { ...readyQueueInput, platform: "azure", isDefaultBranch: true, isDraft: true, hasBaseAnalysis: true },
    expected: { action: "wait", reason: "azure_draft_requires_review", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase2-peak-deferral-starts-above-four-running-and-twenty-files",
    input: { ...readyQueueInput, runningJobs: 4, changedFiles: 21 },
    expected: { action: "wait", reason: "large_change_during_peak", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase2-large-change-deferral-requires-more-than-one-running-job",
    input: { ...readyQueueInput, queuedJobs: 1, runningJobs: 1, changedFiles: 101 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "postdeploy-phase2-large-change-defers-with-two-running-jobs",
    input: { ...readyQueueInput, runningJobs: 2, changedFiles: 101 },
    expected: { action: "wait", reason: "large_change_deferred", priority: 3, publishStatus: false },
  },
  {
    kind: "pressure",
    name: "postdeploy-phase2-three-running-jobs-use-middle-running-pressure-band",
    input: { ...readyQueueInput, sequence: 5, runningJobs: 3, changedFiles: 0 },
    expectedScore: 8,
  },
  {
    kind: "pressure",
    name: "postdeploy-phase2-five-running-jobs-use-high-running-pressure-band",
    input: { ...readyQueueInput, sequence: 5, runningJobs: 5, changedFiles: 0 },
    expectedScore: 12,
  },
  {
    kind: "completion",
    name: "postdeploy-phase2-azure-newer-revision-waits-for-confirmation",
    input: { ...completedPullRequest, platform: "azure", hasNewerRevision: true },
    expected: { action: "wait", reason: "azure_revision_confirmation_required", priority: 2, publishStatus: false },
  },
  {
    kind: "completion",
    name: "postdeploy-phase2-gitlab-newer-revision-skips-obsolete-decoration",
    input: { ...completedPullRequest, platform: "gitlab", hasNewerRevision: true },
    expected: { action: "skip", reason: "gitlab_decoration_obsolete", priority: 0, publishStatus: true },
  },
  {
    kind: "completion",
    name: "postdeploy-phase2-branch-completion-does-not-require-pr-decoration",
    input: { ...completedPullRequest, isPullRequest: false, decorationReady: false, hasNewerRevision: true },
    expected: { action: "promote", reason: "branch_analysis_completed", priority: 7, publishStatus: true },
  },
  {
    kind: "queue",
    name: "corrected-phase1-valid-maximum-sequence-starts-empty-lane",
    input: { ...readyQueueInput, sequence: Number.MAX_SAFE_INTEGER },
    expected: { action: "start", reason: "empty_serialization_lane", priority: 8, publishStatus: true },
  },
  {
    kind: "queue",
    name: "corrected-phase1-minimum-sequence-is-rejected",
    input: { ...readyQueueInput, sequence: Number.MIN_SAFE_INTEGER },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "queue",
    name: "corrected-phase1-conflict-precedes-pending-readiness",
    input: { ...readyQueueInput, readiness: "pending", hasConflicts: true },
    expected: { action: "skip", reason: "merge_conflict", priority: 0, publishStatus: true },
  },
  {
    kind: "queue",
    name: "corrected-phase1-queue-capacity-precedes-default-branch-analysis",
    input: { ...readyQueueInput, isDefaultBranch: true, hasBaseAnalysis: false, queuedJobs: 8 },
    expected: { action: "wait", reason: "queue_capacity_reached", priority: 1, publishStatus: false },
  },
  {
    kind: "queue",
    name: "corrected-phase1-azure-empty-change-starts",
    input: { ...readyQueueInput, platform: "azure", changedFiles: 0 },
    expected: { action: "start", reason: "empty_serialization_lane", priority: 8, publishStatus: true },
  },
  {
    kind: "pressure",
    name: "corrected-phase1-nine-queued-jobs-score-high-queue-pressure",
    input: { ...readyQueueInput, sequence: 5, queuedJobs: 9, changedFiles: 0 },
    expectedScore: 10,
  },
  {
    kind: "pressure",
    name: "corrected-phase1-four-running-jobs-use-middle-pressure-band",
    input: { ...readyQueueInput, sequence: 5, runningJobs: 4, changedFiles: 0 },
    expectedScore: 8,
  },
  {
    kind: "pressure",
    name: "corrected-phase1-ten-changed-files-stay-in-low-change-band",
    input: { ...readyQueueInput, sequence: 5, changedFiles: 10 },
    expectedScore: 2,
  },
  {
    kind: "completion",
    name: "corrected-phase1-azure-decoration-ready-promotes-without-newer-revision",
    input: { ...completedPullRequest, platform: "azure" },
    expected: { action: "promote", reason: "pull_request_decoration_ready", priority: 8, publishStatus: true },
  },
  {
    kind: "completion",
    name: "corrected-phase1-gitlab-decoration-ready-promotes-without-newer-revision",
    input: { ...completedPullRequest, platform: "gitlab" },
    expected: { action: "promote", reason: "pull_request_decoration_ready", priority: 8, publishStatus: true },
  },
  {
    kind: "queue",
    name: "followup-phase1-infinite-sequence-is-skipped",
    input: { ...readyQueueInput, sequence: Infinity },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "queue",
    name: "followup-phase1-pending-readiness-at-two-queued-jobs-keeps-pending-reason",
    input: { ...readyQueueInput, readiness: "pending", queuedJobs: 2 },
    expected: { action: "wait", reason: "readiness_pending", priority: 3, publishStatus: true },
  },
  {
    kind: "queue",
    name: "followup-phase1-ready-azure-conflict-skips-with-status",
    input: { ...readyQueueInput, platform: "azure", hasConflicts: true },
    expected: { action: "skip", reason: "merge_conflict", priority: 0, publishStatus: true },
  },
  {
    kind: "queue",
    name: "followup-phase1-nondefault-draft-waits-before-base-analysis",
    input: { ...readyQueueInput, isDraft: true, hasBaseAnalysis: false },
    expected: { action: "wait", reason: "draft_pull_request", priority: 1, publishStatus: false },
  },
  {
    kind: "queue",
    name: "followup-phase1-default-first-analysis-precedes-large-change-deferral",
    input: { ...readyQueueInput, isDefaultBranch: true, hasBaseAnalysis: false, runningJobs: 1, changedFiles: 101 },
    expected: { action: "start", reason: "first_default_branch_analysis", priority: 9, publishStatus: true },
  },
  {
    kind: "queue",
    name: "followup-phase1-exactly-one-hundred-files-do-not-defer",
    input: { ...readyQueueInput, runningJobs: 2, changedFiles: 100 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
  {
    kind: "queue",
    name: "followup-phase1-default-first-analysis-still-waits-for-pending-readiness",
    input: { ...readyQueueInput, readiness: "pending", isDefaultBranch: true, hasBaseAnalysis: false },
    expected: { action: "wait", reason: "readiness_pending", priority: 3, publishStatus: true },
  },
  {
    kind: "pressure",
    name: "followup-phase1-azure-empty-lane-pressure-includes-platform-weight",
    input: { ...readyQueueInput, platform: "azure", sequence: 5, changedFiles: 0 },
    expectedScore: 3,
  },
  {
    kind: "pressure",
    name: "followup-phase1-three-queued-jobs-use-middle-queue-pressure-band",
    input: { ...readyQueueInput, sequence: 5, queuedJobs: 3, changedFiles: 0 },
    expectedScore: 6,
  },
  {
    kind: "completion",
    name: "followup-phase1-completed-pull-request-waits-for-decoration",
    input: { ...completedPullRequest, decorationReady: false },
    expected: { action: "wait", reason: "decoration_pending", priority: 3, publishStatus: false },
  },
  {
    kind: "queue",
    name: "followup-phase2-nan-sequence-is-skipped",
    input: { ...readyQueueInput, sequence: Number.NaN },
    expected: { action: "skip", reason: "invalid_sequence", priority: 0, publishStatus: false },
  },
  {
    kind: "queue",
    name: "followup-phase2-blocked-readiness-precedes-full-queue",
    input: { ...readyQueueInput, readiness: "blocked", queuedJobs: 8 },
    expected: { action: "wait", reason: "readiness_blocked", priority: 1, publishStatus: true },
  },
  {
    kind: "queue",
    name: "followup-phase2-twelve-files-do-not-enter-small-change-fast-lane",
    input: { ...readyQueueInput, queuedJobs: 2, runningJobs: 1, changedFiles: 12 },
    expected: { action: "wait", reason: "earlier_revision_owns_lane", priority: 2, publishStatus: false },
  },
];

function matchesDecision(actual: QueueDecision, expected: QueueDecision): boolean {
  return actual.action === expected.action
    && actual.reason === expected.reason
    && actual.priority === expected.priority
    && actual.publishStatus === expected.publishStatus;
}

export function evaluateSerializationScenario(scenario: SerializationScenario): boolean {
  switch (scenario.kind) {
    case "queue":
      return matchesDecision(classifyInitialQueue(scenario.input), scenario.expected);
    case "completion":
      return matchesDecision(classifyCompletion(scenario.input), scenario.expected);
    case "pressure":
      return scoreQueuePressure(scenario.input) === scenario.expectedScore;
  }
}

export function evaluateSerializationScenarios(): readonly { readonly name: string; readonly passed: boolean }[] {
  return serializationScenarios.map((scenario) => ({
    name: scenario.name,
    passed: evaluateSerializationScenario(scenario),
