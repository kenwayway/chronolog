import { useState, memo, useMemo, ReactNode, MouseEvent, TouchEvent } from "react";
import { formatTime, formatDuration, formatDate } from "@/utils/formatters";
import { darkenColor } from "@/utils/contentParser";
import { useTheme } from "@/hooks/useTheme";
import { ContentRenderer } from "./ContentRenderer";
import { LinkedEntryPreview } from "./LinkedEntryPreview";
import { ImageLightbox } from "../common/ImageLightbox";
import styles from "./TimelineEntry.module.css";
import type { TimelineItem, Category, MediaItem } from "@/types";
import { getContentTypeTimelineSymbol, renderContentTypeDisplay } from "@/features/contentTypes";

interface Position {
  x: number;
  y: number;
}

type LineState = 'start' | 'end' | 'active' | 'default';


interface TimelineEntryProps {
  entry: TimelineItem;
  allEntries: TimelineItem[];
  isFirst: boolean;
  isLast: boolean;
  sessionDuration?: number;
  categories: Category[];
  onContextMenu?: (entry: TimelineItem, position: Position) => void;
  onEdit?: (entry: TimelineItem) => void;
  lineState: LineState | string;
  isLightMode: boolean;
  showDate?: boolean;
  onNavigateToEntry?: (entry: TimelineItem) => void;
  mediaItems?: MediaItem[];
}

/**
 * Individual timeline entry component
 * Displays entry content with symbols, categories, and linked entries
 */
export const TimelineEntry = memo(function TimelineEntry({
  entry,
  allEntries,
  isFirst,
  isLast,
  sessionDuration,
  categories,
  onContextMenu,
  onEdit,
  lineState,
  isLightMode,
  showDate = false,
  onNavigateToEntry,
  mediaItems = [],
}: TimelineEntryProps) {
  const { symbols } = useTheme();
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Event handlers
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onContextMenu?.(entry, { x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = () => {
    onEdit?.(entry);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    e.currentTarget.style.userSelect = 'none';
    e.currentTarget.style.setProperty('-webkit-user-select', 'none');
    const timer = setTimeout(() => {
      const touch = e.touches[0];
      onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY });
    }, 500);
    setPressTimer(timer);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    e.currentTarget.style.userSelect = '';
    e.currentTarget.style.removeProperty('-webkit-user-select');
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  // Computed values
  const category = useMemo(
    () => categories?.find((c) => c.id === entry.category),
    [categories, entry.category]
  );

  const categoryTextColor = useMemo(
    () => category ? (isLightMode ? darkenColor(category.color, 10) : category.color) : null,
    [category, isLightMode]
  );

  const isSessionStart = entry.kind === 'session-start';
  const isSessionEnd = entry.kind === 'session-end';
  const contentTypeDisplay = renderContentTypeDisplay(entry, mediaItems);

  // Linked entries
  const linkedEntryData = useMemo(() => {
    const outgoingLinks = entry.linkedItems || [];
    const incomingLinks = allEntries
      ?.filter(e => e.entityId !== entry.entityId && e.linkedItems?.includes(entry.entityId))
      .map(e => e.entityId) || [];
    const allLinkedIds = [...new Set([...outgoingLinks, ...incomingLinks])];
    return allLinkedIds
      .map(id => allEntries?.find(e => e.entityId === id && e.kind !== 'session-end'))
      .filter((e): e is TimelineItem => Boolean(e));
  }, [entry.entityId, entry.linkedItems, allEntries]);

  const beforeLinks = useMemo(
    () => linkedEntryData.filter(e => e.timestamp < entry.timestamp),
    [linkedEntryData, entry.timestamp]
  );

  const afterLinks = useMemo(
    () => linkedEntryData.filter(e => e.timestamp >= entry.timestamp),
    [linkedEntryData, entry.timestamp]
  );

  const getEntrySymbol = (): ReactNode => {
    const styles = { fontSize: 14 };
    const contentTypeSymbol = getContentTypeTimelineSymbol(entry.contentType);
    if (contentTypeSymbol) {
      return <span style={{ ...styles, color: 'var(--accent)' }}>{symbols[contentTypeSymbol]}</span>;
    }

    switch (entry.kind) {
      case 'session-start':
        return <span style={{ ...styles, color: "var(--success)", fontWeight: 700, fontSize: 14 }}>{symbols.sessionStart}</span>;
      case 'session-end':
        return <span style={{ ...styles, color: "var(--text-muted)" }}>{symbols.sessionEnd}</span>;
      case 'note':
      default:
        return <span style={{ ...styles, color: "var(--text-dim)" }}>{symbols.note}</span>;
    }
  };

  const getLineColor = (position: "top" | "bottom"): string => {
    if (position === "top") {
      return lineState === "start" || lineState === "default" ? "var(--border-light)" : "var(--accent)";
    }
    return lineState === "end" || lineState === "default" ? "var(--border-light)" : "var(--accent)";
  };

  const getContentColor = (): string => {
    if (isSessionStart) return "var(--text-primary)";
    if (isSessionEnd) return "var(--text-muted)";
    return "var(--text-secondary)";
  };

  return (
    <>
      <div
        className={styles.entry}
        data-entry-id={entry.id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          cursor: "default",
          userSelect: "none",
          transition: "background-color 300ms ease",
        }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Time Column */}
        <div
          className={styles.timeCol}
          style={{
            flexShrink: 0,
            width: 50,
            textAlign: "right",
            fontSize: 10,
            color: "var(--text-dim)",
            paddingRight: 8,
            paddingTop: 4,
            fontFamily: "var(--font-mono)",
            opacity: 0.6,
          }}
        >
          {showDate && (
            <div style={{ marginBottom: 2, fontSize: 9, color: "var(--text-muted)" }}>
              {formatDate(new Date(entry.timestamp).getTime())}
            </div>
          )}
          {formatTime(entry.timestamp)}
          {/* Duration under timestamp for session start */}
          {isSessionStart && sessionDuration && (
            <div
              style={{
                marginTop: 4,
                fontSize: 9,
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              {formatDuration(sessionDuration)}
            </div>
          )}
        </div>

        {/* Symbol Column */}
        <div
          className={styles.symbolCol}
          style={{
            position: "relative",
            flexShrink: 0,
            width: 20,
            textAlign: "center",
            fontSize: 14,
            userSelect: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            alignSelf: "stretch",
          }}
        >
          {!isFirst && (
            <div
              className={styles.lineTop}
              style={{ backgroundColor: getLineColor("top") }}
            />
          )}
          {!isLast && (
            <div
              className={styles.lineBottom}
              style={{ backgroundColor: getLineColor("bottom") }}
            />
          )}
          <div className={styles.symbolWrapper}>
            {getEntrySymbol()}
          </div>
        </div>

        {/* Content */}
        <div className={styles.contentCol} style={{ flex: 1, minWidth: 0 }}>
          {/* Linked entries before (older) */}
          {beforeLinks.length > 0 && (
            <div className="linked-entries-before" style={{ marginBottom: 8 }}>
              {beforeLinks.map(linked => (
                <LinkedEntryPreview
                  key={linked.id}
                  linkedEntry={linked}
                  direction="before"
                  onNavigateToEntry={onNavigateToEntry}
                />
              ))}
            </div>
          )}

          {/* Mobile timestamp */}
          <div
            className={styles.mobileTime}
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              marginBottom: 4,
              display: "none",
            }}
          >
            {formatTime(entry.timestamp)}
          </div>

          {/* Main content row */}
          <div className="flex flex-wrap items-baseline" style={{ gap: "4px 12px", marginBottom: 6 }}>
            {entry.content && (
              <span
                className={styles.contentText}
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  overflowWrap: "break-word",
                  fontFamily: "var(--font-primary)",
                  whiteSpace: "pre-wrap",
                  color: getContentColor(),
                  fontStyle: isSessionEnd ? "italic" : "normal",
                }}
              >
                <ContentRenderer content={entry.content} onImageClick={setLightboxImage} />
              </span>
            )}

          </div>

          {/* Built-in display behavior is registered with the content type. */}
          {contentTypeDisplay && (
            <div style={{ marginTop: 6 }}>
              {contentTypeDisplay}
            </div>
          )}

          {/* Metadata Footer (Tags & Category) */}
          {(category || (entry.tags && entry.tags.length > 0)) && (
            <div className={styles.metadataFooter}>
              {/* Category - Left aligned */}
              {category && (
                <span
                  className={styles.categoryLabel}
                  style={{
                    color: categoryTextColor || undefined,
                    backgroundColor: `${category.color}15`,
                    border: `1px solid ${category.color}30`,
                  }}
                >
                  {category.label}
                </span>
              )}

              {/* Tags - Left aligned next to category */}
              <div className={styles.tagsList}>
                {entry.tags?.map(tag => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Linked entries after (newer) */}
          {afterLinks.length > 0 && (
            <div className="linked-entries-after" style={{ marginTop: 8 }}>
              {afterLinks.map(linked => (
                <LinkedEntryPreview
                  key={linked.id}
                  linkedEntry={linked}
                  direction="after"
                  onNavigateToEntry={onNavigateToEntry}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </>
  );
});
