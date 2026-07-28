import type { Session, TimelineItem } from "@/types";

export type TimelineLineState = "start" | "end" | "active" | "default";

function fallsWithinSession(timestamp: number, session: Session): boolean {
  return timestamp > session.startAt
    && (session.endAt === null || timestamp < session.endAt);
}

export function getTimelineLineState(
  entry: TimelineItem,
  sessions: Session[],
): TimelineLineState {
  const userSessions = sessions.filter(session => session.origin !== "zaddy");

  if (entry.origin === "zaddy") {
    return userSessions.some(session => fallsWithinSession(entry.timestamp, session))
      ? "active"
      : "default";
  }
  if (entry.kind === "session-start") return "start";
  if (entry.kind === "session-end") return "end";

  const belongsToUserSession = Boolean(
    entry.sessionId && userSessions.some(session => session.id === entry.sessionId)
  ) || userSessions.some(session => fallsWithinSession(entry.timestamp, session));

  return belongsToUserSession ? "active" : "default";
}
