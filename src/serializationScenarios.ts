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
