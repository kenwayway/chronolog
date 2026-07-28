import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/types";
import { buildZaddyAnnotationGroups } from "./annotationGroups";

function item(
  id: string,
  timestamp: number,
  overrides: Partial<TimelineItem> = {},
): TimelineItem {
  return {
    id,
    entityId: id,
    kind: "note",
    content: id,
    timestamp,
    ...overrides,
  };
}

describe("buildZaddyAnnotationGroups", () => {
  it("keeps user entries out of the annotation groups", () => {
    const groups = buildZaddyAnnotationGroups([
      item("user", new Date(2026, 6, 28, 9).getTime()),
      item("zaddy", new Date(2026, 6, 28, 10).getTime(), { origin: "zaddy" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].annotations.map(annotation => annotation.entry.id)).toEqual(["zaddy"]);
  });

  it("combines zaddy session boundaries into one annotation", () => {
    const startAt = new Date(2026, 6, 28, 9).getTime();
    const endAt = new Date(2026, 6, 28, 10).getTime();
    const groups = buildZaddyAnnotationGroups([
      item("session:s1:start", startAt, {
        entityId: "s1",
        kind: "session-start",
        origin: "zaddy",
      }),
      item("session:s1:end", endAt, {
        entityId: "s1",
        kind: "session-end",
        origin: "zaddy",
      }),
    ]);

    expect(groups[0].annotations).toHaveLength(1);
    expect(groups[0].annotations[0].entry.kind).toBe("session-start");
    expect(groups[0].annotations[0].endEntry?.kind).toBe("session-end");
  });

  it("still displays an end boundary when the start falls outside the selected day", () => {
    const end = item("session:s1:end", new Date(2026, 6, 28, 1).getTime(), {
      entityId: "s1",
      kind: "session-end",
      origin: "zaddy",
    });

    const groups = buildZaddyAnnotationGroups([end]);

    expect(groups[0].annotations[0]).toMatchObject({
      entry: end,
      endEntry: end,
    });
  });

  it("groups by local day and can order newest days first", () => {
    const older = item("older", new Date(2026, 6, 27, 22).getTime(), { origin: "zaddy" });
    const newer = item("newer", new Date(2026, 6, 28, 8).getTime(), { origin: "zaddy" });

    const groups = buildZaddyAnnotationGroups([older, newer], true);

    expect(groups.map(group => group.dateKey)).toEqual(["2026-07-28", "2026-07-27"]);
    expect(groups.map(group => group.annotations[0].entry.id)).toEqual(["newer", "older"]);
  });
});
