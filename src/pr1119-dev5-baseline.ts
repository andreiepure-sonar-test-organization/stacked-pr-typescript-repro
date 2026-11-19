export type IntakeChannel = "api" | "batch" | "manual" | "replay";
export type ReviewOutcome = "accept" | "hold" | "reject";
export type WorkQueue = "fast" | "standard" | "deferred" | "none";

export interface FixtureRequest {
  id: string;
  channel: IntakeChannel;
  priority: number;
  retries: number;
  enabled: boolean;
  labels: readonly string[];
  score?: number;
  region?: "eu" | "us" | "apac";
}

export interface FixtureDecision {
  id: string;
  outcome: ReviewOutcome;
  queue: WorkQueue;
  reasons: string[];
}

const BLOCKED_LABELS = new Set(["blocked", "malformed", "training-only"]);
const FAST_LABELS = new Set(["expedite", "customer-impact", "security"]);

function hasBlockedLabel(labels: readonly string[]): boolean {
  return labels.some((label) => BLOCKED_LABELS.has(label));
}

function hasFastLabel(labels: readonly string[]): boolean {
  return labels.some((label) => FAST_LABELS.has(label));
}

function isScoreInRange(score: number | undefined): score is number {
  return score !== undefined && Number.isFinite(score) && score >= 0 && score <= 100;
}

function validateRequest(request: FixtureRequest): string | undefined {
  if (request.id.trim().length === 0) {
    return "request id is required";
  }
  if (!Number.isInteger(request.priority) || request.priority < 0 || request.priority > 100) {
    return "priority must be an integer from 0 to 100";
  }
  if (!Number.isInteger(request.retries) || request.retries < 0) {
    return "retries must be a non-negative integer";
  }
  if (request.score !== undefined && !isScoreInRange(request.score)) {
    return "score must be between 0 and 100";
  }
  return undefined;
}

function classifyQueue(request: FixtureRequest, reasons: string[]): WorkQueue {
  if (request.channel === "replay") {
    reasons.push("replay requests are deferred");
    return "deferred";
  }
  if (request.priority >= 90 && hasFastLabel(request.labels)) {
    reasons.push("priority and label qualify for the fast queue");
    return "fast";
  }
  if (request.priority >= 50 || request.channel === "api") {
    reasons.push("priority or API channel qualifies for the standard queue");
    return "standard";
  }
  if (request.channel === "manual" && request.region === "eu") {
    reasons.push("EU manual requests use the standard queue");
    return "standard";
  }
  reasons.push("request has no fast or standard queue signal");
  return "deferred";
}

function rejected(request: FixtureRequest, reason: string): FixtureDecision {
  return { id: request.id, outcome: "reject", queue: "none", reasons: [reason] };
}

function held(request: FixtureRequest, reason: string): FixtureDecision {
  return { id: request.id, outcome: "hold", queue: "deferred", reasons: [reason] };
}

export function decideFixtureRequest(request: FixtureRequest): FixtureDecision {
  const validationError = validateRequest(request);
  if (validationError !== undefined) {
    return rejected(request, validationError);
  }
  if (!request.enabled) {
    return { id: request.id, outcome: "hold", queue: "none", reasons: ["request is disabled"] };
  }
  if (hasBlockedLabel(request.labels)) {
    return rejected(request, "request has a blocked label");
  }
  if (request.retries >= 5) {
    return held(request, "retry limit reached");
  }
  if (request.score !== undefined && request.score < 20 && request.channel !== "manual") {
    return held(request, "low score requires manual review");
  }
  if (request.region === "apac" && request.channel === "batch" && request.priority < 70) {
    return held(request, "low-priority APAC batches require a scheduled window");
  }

  const reasons: string[] = [];
  let queue = classifyQueue(request, reasons);
  if (request.channel === "batch" && queue === "fast") {
    reasons.push("batch requests are capped at the standard queue");
    queue = "standard";
  }
  if (request.labels.length === 0 && queue === "fast") {
    reasons.push("fast queue requires a retained label");
    queue = "standard";
  }
  if (request.channel === "manual" && request.priority < 25) {
    reasons.push("low-priority manual review is accepted with deferred handling");
    queue = "deferred";
  }
  if (request.region === "us" && queue === "deferred" && request.retries === 0) {
    reasons.push("new US requests are routed to the standard queue");
    queue = "standard";
  }
  return { id: request.id, outcome: "accept", queue, reasons };
}

export function summarizeFixtureDecisions(requests: readonly FixtureRequest[]): Record<ReviewOutcome, number> {
  const summary: Record<ReviewOutcome, number> = { accept: 0, hold: 0, reject: 0 };
  for (const request of requests) {
    const decision = decideFixtureRequest(request);
    switch (decision.outcome) {
      case "accept":
        summary.accept += 1;
        break;
      case "hold":
        summary.hold += 1;
        break;
      case "reject":
        summary.reject += 1;
        break;
      default: {
        const exhaustive: never = decision.outcome;
        throw new Error(`Unknown outcome: ${exhaustive}`);
      }
    }
  }
  return summary;
}

export function selectFixtureRequests(
  requests: readonly FixtureRequest[],
  channel: IntakeChannel | "all",
  minimumPriority: number,
): FixtureRequest[] {
  if (!Number.isFinite(minimumPriority)) {
    return [];
  }
  return requests.filter((request) => {
    if (!request.enabled || request.priority < minimumPriority) {
      return false;
    }
    if (channel === "all") {
      return true;
    }
    if (channel === "replay" && request.retries > 3) {
      return false;
    }
    return request.channel === channel;
  });
}

export function renderFixtureDecision(decision: FixtureDecision): string {
  const reasonText = decision.reasons.length === 0 ? "no reasons" : decision.reasons.join("; ");
  const queueText = decision.queue === "none" ? "not queued" : `queue=${decision.queue}`;
  return `${decision.id}: ${decision.outcome}, ${queueText} (${reasonText})`;
}

export function explainFixtureBatch(requests: readonly FixtureRequest[]): string[] {
  const summaries = summarizeFixtureDecisions(requests);
  const lines = [`accepted=${summaries.accept}`, `held=${summaries.hold}`, `rejected=${summaries.reject}`];
  if (summaries.reject > summaries.accept) {
    lines.push("batch needs input cleanup before processing");
  } else if (summaries.hold > 0) {
    lines.push("some requests need later review");
  } else if (summaries.accept === 0) {
    lines.push("batch is empty");
  } else {
    lines.push("batch is ready");
  }
  return lines;
}

export function estimateFixtureWaitMinutes(
  request: FixtureRequest,
  decision: FixtureDecision,
): number {
  if (decision.outcome === "reject" || decision.queue === "none") {
    return 0;
  }
  if (decision.outcome === "hold") {
    return request.retries >= 5 ? 240 : 60;
  }
  if (decision.queue === "fast") {
    if (request.labels.includes("security")) {
      return 2;
    }
    if (request.labels.includes("customer-impact")) {
      return 5;
    }
    return 10;
  }
  if (decision.queue === "standard") {
    if (request.channel === "api" && request.priority >= 80) {
      return 15;
    }
    return request.region === "eu" ? 25 : 35;
  }
  if (request.channel === "replay") {
    return 180;
  }
  return request.channel === "manual" ? 90 : 120;
}
