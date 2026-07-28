import { describe, expect, it } from "vitest";
import type { Session, TimelineItem } from "@/types";
import { getTimelineLineState } from "./timelineLineState";

const session: Session = {
  id: "s1",
  content: "work",
  startAt: 100,
  endAt: 300,
};

function note(timestamp: number, overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: `n-${timestamp}`,
    entityId: `n-${timestamp}`,
    kind: "note",
    content: "note",
    timestamp,
    ...overrides,
  };
}

describe("getTimelineLineState", () => {
  it("keeps an unlinked note inside a user session on the active line", () => {
    expect(getTimelineLineState(note(200), [session])).toBe("active");
  });

  it("keeps a note outside user sessions on the history line", () => {
    expect(getTimelineLineState(note(400), [session])).toBe("default");
  });

  it("uses start and end line transitions for session boundaries", () => {
    const start: TimelineItem = {
      ...note(100),
      id: "session:s1:start",
      entityId: "s1",
      kind: "session-start",
    };
    const end: TimelineItem = {
      ...note(300),
      id: "session:s1:end",
      entityId: "s1",
      kind: "session-end",
    };

    expect(getTimelineLineState(start, [session])).toBe("start");
    expect(getTimelineLineState(end, [session])).toBe("end");
  });

  it("lets an expanded zaddy annotation share an overlapping user session line", () => {
    expect(
      getTimelineLineState(note(200, { origin: "zaddy" }), [session]),
    ).toBe("active");
    expect(
      getTimelineLineState(note(400, { origin: "zaddy" }), [session]),
    ).toBe("default");
  });
});
