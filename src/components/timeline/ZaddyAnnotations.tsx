import { useMemo, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { ChevronRight } from "lucide-react";
import { formatDate, formatDuration, formatTime } from "@/utils/formatters";
import { ContentRenderer } from "./ContentRenderer";
import { buildZaddyAnnotationGroups } from "./annotationGroups";
import styles from "./ZaddyAnnotations.module.css";
import type { TimelineItem } from "@/types";

interface Position {
  x: number;
  y: number;
}

interface ZaddyAnnotationsProps {
  entries: TimelineItem[];
  showDates?: boolean;
  newestFirst?: boolean;
  onContextMenu?: (entry: TimelineItem, position: Position) => void;
  onEdit?: (entry: TimelineItem) => void;
}

export function ZaddyAnnotations({
  entries,
  showDates = false,
  newestFirst = false,
  onContextMenu,
  onEdit,
}: ZaddyAnnotationsProps) {
  const groups = useMemo(
    () => buildZaddyAnnotationGroups(entries, newestFirst),
    [entries, newestFirst],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleGroup = (dateKey: string) => {
    setExpandedGroups(current => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  if (groups.length === 0) return null;

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <aside className={styles.annotations} aria-label="Zaddy annotations">
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.dateKey);
        const regionId = `zaddy-annotations-${group.dateKey}`;

        return (
          <section
            className={styles.group}
            key={group.dateKey}
            data-zaddy-entry-ids={group.annotations.map(annotation => annotation.entry.id).join(" ")}
          >
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={isExpanded}
              aria-controls={regionId}
              onClick={() => toggleGroup(group.dateKey)}
            >
              <span className={styles.rule} aria-hidden="true" />
              <span className={styles.label}>ZADDY</span>
              <span className={styles.count}>
                {group.annotations.length} {group.annotations.length === 1 ? "ANNOTATION" : "ANNOTATIONS"}
              </span>
              {showDates && (
                <span className={styles.date}>{formatDate(group.timestamp)}</span>
              )}
              <ChevronRight
                size={13}
                className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}`}
                aria-hidden="true"
              />
            </button>

            {isExpanded && (
              <div className={styles.list} id={regionId}>
                {group.annotations.map(({ entry, endEntry }) => {
                  const isSession = entry.kind !== "note";
                  const duration = isSession && endEntry && endEntry.timestamp > entry.timestamp
                    ? endEntry.timestamp - entry.timestamp
                    : null;
                  const endContent = entry.kind === "session-start" ? endEntry?.content : undefined;

                  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    onContextMenu?.(entry, { x: event.clientX, y: event.clientY });
                  };
                  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
                    const touch = event.touches[0];
                    pressTimerRef.current = setTimeout(() => {
                      onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY });
                      pressTimerRef.current = null;
                    }, 500);
                  };

                  return (
                    <div
                      key={entry.entityId}
                      className={styles.annotation}
                      data-entry-id={entry.id}
                      onContextMenu={handleContextMenu}
                      onDoubleClick={() => onEdit?.(entry)}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={clearPressTimer}
                      onTouchCancel={clearPressTimer}
                      onTouchMove={clearPressTimer}
                    >
                      <div className={styles.annotationMeta}>
                        <time dateTime={new Date(entry.timestamp).toISOString()}>
                          {formatTime(entry.timestamp)}
                        </time>
                        {isSession && (
                          <span>
                            CHAT{duration ? ` · ${formatDuration(duration)}` : ""}
                          </span>
                        )}
                      </div>
                      {entry.content && (
                        <div className={styles.annotationBody}>
                          <ContentRenderer content={entry.content} />
                        </div>
                      )}
                      {endContent && (
                        <div className={styles.annotationEnd}>
                          <span aria-hidden="true">↳</span>
                          <ContentRenderer content={endContent} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
