import type { TimelineItem } from "@/types";

export interface ZaddyAnnotation {
  entry: TimelineItem;
  endEntry?: TimelineItem;
}

export interface ZaddyAnnotationGroup {
  dateKey: string;
  timestamp: number;
  annotations: ZaddyAnnotation[];
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Collapse timeline projections into annotation records.
 *
 * A zaddy Session may project both a start and end marker. The annotation UI
 * presents that persisted Session once, using the start as its canonical row
 * and the end marker as optional supporting text.
 */
export function buildZaddyAnnotationGroups(
  entries: TimelineItem[],
  newestFirst = false,
): ZaddyAnnotationGroup[] {
  const byEntityId = new Map<string, ZaddyAnnotation>();

  for (const entry of entries) {
    if (entry.origin !== "zaddy") continue;

    const existing = byEntityId.get(entry.entityId);
    if (!existing) {
      byEntityId.set(entry.entityId, {
        entry,
        endEntry: entry.kind === "session-end" ? entry : undefined,
      });
      continue;
    }

    if (entry.kind === "session-end") {
      existing.endEntry = entry;
    } else if (existing.entry.kind === "session-end") {
      existing.entry = entry;
    }
  }

  const direction = newestFirst ? -1 : 1;
  const annotations = [...byEntityId.values()].sort(
    (left, right) => direction * (left.entry.timestamp - right.entry.timestamp),
  );
  const groups = new Map<string, ZaddyAnnotationGroup>();

  for (const annotation of annotations) {
    const dateKey = localDateKey(annotation.entry.timestamp);
    let group = groups.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        timestamp: annotation.entry.timestamp,
        annotations: [],
      };
      groups.set(dateKey, group);
    }
    group.annotations.push(annotation);
  }

  return [...groups.values()].sort(
    (left, right) => direction * (left.timestamp - right.timestamp),
  );
}
