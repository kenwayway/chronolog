import type { Session, TimelineItem } from "@/types";

export type TimelineLineState = "start" | "end" | "active" | "default";

function fallsWithinSession(timestamp: number, session: Session): boolean {
  return timestamp > session.startAt
    && (session.endAt === null || timestamp < session.endAt);
}

/**
 * The user session whose rail runs through this row, if any. A row sits on a
 * rail for the same reasons it gets a session line state, so the rail can take
 * its colour from that session without the row knowing anything about it.
 */
export function getTimelineRailSession(
  entry: TimelineItem,
  sessions: Session[],
): Session | undefined {
  const userSessions = sessions.filter(session => session.origin !== "zaddy");
  const containing = () =>
    userSessions.find(session => fallsWithinSession(entry.timestamp, session));

  if (entry.origin === "zaddy") return containing();
  if (entry.kind === "session-start" || entry.kind === "session-end") {
    return userSessions.find(session => session.id === entry.entityId);
  }
  return userSessions.find(session => session.id === entry.sessionId) ?? containing();
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
