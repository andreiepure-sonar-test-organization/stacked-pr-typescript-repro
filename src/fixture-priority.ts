import type { FixtureDecision, FixtureRequest } from "./pr1119-dev5-baseline.js";

export function calculateFixturePriority(request: FixtureRequest, decision: FixtureDecision): number {
  if (decision.outcome === "reject" || decision.queue === "none") {
    return -100;
  }

  let priority = request.priority;
  switch (request.channel) {
    case "api":
      priority += 12;
      break;
    case "batch":
      priority -= 5;
      break;
    case "manual":
      priority -= 8;
      break;
    case "replay":
      priority -= 20;
      break;
  }

  if (request.labels.includes("security")) {
    priority += 25;
  } else if (request.labels.includes("customer-impact")) {
    priority += 15;
  } else if (request.labels.includes("expedite")) {
    priority += 10;
  }
  if (request.score !== undefined && request.score < 20) {
    priority -= 5;
  } else if (request.score !== undefined && request.score >= 80) {
    priority += 5;
  }
  if (request.retries > 0) {
    priority -= request.retries * 3;
  }
  if (decision.outcome === "hold") {
    priority -= 10;
  }
  if (decision.queue === "fast") {
    priority += 30;
  } else if (decision.queue === "standard") {
    priority += 10;
  } else if (decision.queue === "deferred") {
    priority -= 15;
  }
  return Math.max(0, Math.min(200, priority));
}
