export type NoticeSeverity = "info" | "warning" | "critical";
export type NoticeChannel = "email" | "in-app" | "pager";

export interface NoticeInput {
  severity: NoticeSeverity;
  customerOptedOut: boolean;
  hasOnCall: boolean;
  isInternalAccount: boolean;
  requestedChannels: readonly NoticeChannel[];
}

export interface NoticePlan {
  channels: readonly NoticeChannel[];
  requiresReview: boolean;
}

export function planFixtureNotice(input: NoticeInput): NoticePlan {
  if (input.severity === "critical") {
    const channels: NoticeChannel[] = input.hasOnCall ? ["pager", "in-app"] : ["in-app"];
    if (!input.customerOptedOut && !input.isInternalAccount) {
      channels.push("email");
    }
    return { channels, requiresReview: !input.hasOnCall };
  }
  if (input.severity === "warning" && !input.customerOptedOut) {
    const allowed = input.requestedChannels.filter((channel) => channel !== "pager");
    return { channels: allowed.length > 0 ? allowed : ["in-app"], requiresReview: false };
  }
  if (input.severity === "info" && input.isInternalAccount) {
    return { channels: ["in-app"], requiresReview: false };
  }
  return { channels: [], requiresReview: input.severity === "warning" };
}
