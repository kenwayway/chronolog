import { useState, memo, useMemo, ReactNode, MouseEvent, TouchEvent } from "react";
import { ChevronRight, MessageSquareQuote, Play, Square } from "lucide-react";
import { formatTime, formatDuration, formatDate } from "@/utils/formatters";
import { darkenColor } from "@/utils/contentParser";
import { useTheme } from "@/hooks/useTheme";
import { ContentRenderer } from "./ContentRenderer";
import { LinkedEntryPreview } from "./LinkedEntryPreview";
import { ImageLightbox } from "../common/ImageLightbox";
import styles from "./TimelineEntry.module.css";
import type { TimelineItem, Category, MediaItem } from "@/types";
import type { TimelineLinkIndex } from "@/domain/timeline";
import { getContentTypeTimelineSymbol, renderContentTypeDisplay } from "@/features/contentTypes";

interface Position {
  x: number;
  y: number;
}

type LineState = 'start' | 'end' | 'active' | 'default';


interface TimelineEntryProps {
  entry: TimelineItem;
  linkIndex: TimelineLinkIndex;
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
  /** Zaddy comments about this entry, oldest first. */
  comments?: TimelineItem[];
  annotationMode?: boolean;
  annotationEndContent?: string;
  annotationGroupCount?: number;
  annotationGroupExpanded?: boolean;
  annotationGroupEntryIds?: string[];
  onToggleAnnotationGroup?: () => void;
}

/**
 * Individual timeline entry component
 * Displays entry content with symbols, categories, and linked entries
 */
export const TimelineEntry = memo(function TimelineEntry({
  entry,
  linkIndex,
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
  comments,
  annotationMode = false,
  annotationEndContent,
  annotationGroupCount,
  annotationGroupExpanded = false,
  annotationGroupEntryIds,
  onToggleAnnotationGroup,
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
  const isZaddy = entry.origin === 'zaddy';
  const isAnnotation = isZaddy && annotationMode;
  const isCollapsedAnnotationGroup = isAnnotation
    && annotationGroupCount !== undefined
    && !annotationGroupExpanded;
  const contentTypeDisplay = renderContentTypeDisplay(entry, mediaItems);

  // Linked entries
  const linkedEntryData = useMemo(() => {
    const outgoingLinks = entry.linkedItems || [];
    const incomingLinks = linkIndex.incoming.get(entry.entityId) ?? [];
    const allLinkedIds = [...new Set([...outgoingLinks, ...incomingLinks])];
    return allLinkedIds
      .map(id => linkIndex.byEntityId.get(id))
      .filter((e): e is TimelineItem => Boolean(e));
  }, [entry.entityId, entry.linkedItems, linkIndex]);

  const beforeLinks = useMemo(
    () => linkedEntryData.filter(e => e.timestamp < entry.timestamp),
    [linkedEntryData, entry.timestamp]
  );

  const afterLinks = useMemo(
    () => linkedEntryData.filter(e => e.timestamp >= entry.timestamp),
    [linkedEntryData, entry.timestamp]
  );

  const getEntrySymbol = (): ReactNode => {
    const symbolStyles = { fontSize: 14 };
    if (isAnnotation) {
      return (
        <MessageSquareQuote
          size={10}
          strokeWidth={1.75}
          className={`${styles.timelineIcon} ${styles.annotationIcon}`}
          aria-hidden="true"
        />
      );
    }
    if (isZaddy) {
      return (
        <MessageSquareQuote
          size={12}
          strokeWidth={2}
          className={`${styles.timelineIcon} ${styles.zaddyIcon}`}
          aria-hidden="true"
        />
      );
    }
    const contentTypeSymbol = getContentTypeTimelineSymbol(entry.contentType);
    if (contentTypeSymbol) {
      return <span style={{ ...symbolStyles, color: 'var(--accent)' }}>{symbols[contentTypeSymbol]}</span>;
    }

    switch (entry.kind) {
      case 'session-start':
        return (
          <Play
            size={12}
            strokeWidth={2}
            fill="currentColor"
            className={`${styles.timelineIcon} ${styles.sessionStartIcon}`}
            aria-hidden="true"
          />
        );
      case 'session-end':
        return (
          <Square
            size={9}
            strokeWidth={2}
            fill="currentColor"
            className={`${styles.timelineIcon} ${styles.sessionEndIcon}`}
            aria-hidden="true"
          />
        );
      case 'note':
      default:
        return <span style={{ ...symbolStyles, color: "var(--text-dim)" }}>{symbols.note}</span>;
    }
  };

  const isSessionLine = (position: "top" | "bottom"): boolean => {
    if (position === "top") {
      return lineState === "active" || lineState === "end";
    }
    return lineState === "start" || lineState === "active";
  };

  const getContentColor = (): string => {
    if (isAnnotation) return "var(--text-muted)";
    if (isSessionStart) return "var(--text-primary)";
    if (isSessionEnd) return "var(--text-muted)";
    return "var(--text-secondary)";
  };

  return (
    <>
      <div
        className={`${styles.entry} ${isAnnotation ? styles.annotationEntry : ""} ${
          isCollapsedAnnotationGroup ? styles.collapsedAnnotationEntry : ""
        }`}
        data-entry-id={entry.id}
        data-zaddy-entry-ids={annotationGroupEntryIds?.join(" ")}
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
          {isSessionStart && sessionDuration && !isCollapsedAnnotationGroup && (
            <div
              style={{
                marginTop: 4,
                fontSize: 9,
                color: isAnnotation ? "var(--text-dim)" : "var(--accent)",
                fontWeight: 500,
              }}
            >
              {isZaddy ? `CHAT ${formatDuration(sessionDuration)}` : formatDuration(sessionDuration)}
            </div>
          )}
          {category && !isAnnotation && (
            <div
              className={styles.desktopCategoryLabel}
              style={{ color: categoryTextColor || undefined }}
              title={`Category: ${category.label}`}
            >
              {category.label}
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
              className={`${styles.timelineLine} ${styles.lineTop} ${
                isSessionLine("top") ? styles.sessionLine : styles.historyLine
              }`}
              aria-hidden="true"
            />
          )}
          {!isLast && (
            <div
              className={`${styles.timelineLine} ${styles.lineBottom} ${
                isSessionLine("bottom") ? styles.sessionLine : styles.historyLine
              }`}
              aria-hidden="true"
            />
          )}
          <div className={styles.symbolWrapper}>
            {getEntrySymbol()}
          </div>
        </div>

        {/* Content */}
        <div className={styles.contentCol} style={{ flex: 1, minWidth: 0 }}>
          {/* Linked entries before (older) */}
          {!isAnnotation && beforeLinks.length > 0 && (
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
            <span>{formatTime(entry.timestamp)}</span>
            {category && !isAnnotation && (
              <span
                className={styles.mobileCategoryLabel}
                style={{ color: categoryTextColor || undefined }}
                title={`Category: ${category.label}`}
              >
                {category.label}
              </span>
            )}
          </div>

          {isAnnotation && annotationGroupCount !== undefined && (
            <button
              type="button"
              className={styles.annotationToggle}
              aria-expanded={annotationGroupExpanded}
              onClick={(event) => {
                event.stopPropagation();
                onToggleAnnotationGroup?.();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <span className={styles.annotationRule} aria-hidden="true" />
              <span className={styles.annotationLabel}>ZADDY</span>
              <span className={styles.annotationCount}>
                {annotationGroupCount} {annotationGroupCount === 1 ? "ANNOTATION" : "ANNOTATIONS"}
              </span>
              <ChevronRight
                size={13}
                className={`${styles.annotationChevron} ${
                  annotationGroupExpanded ? styles.annotationChevronExpanded : ""
                }`}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Main content row */}
          {!isCollapsedAnnotationGroup && (
            <div className="flex flex-wrap items-baseline" style={{ gap: "4px 12px", marginBottom: 6 }}>
              {isZaddy && !isAnnotation && (
                <span className={styles.originBadge}>ZADDY</span>
              )}
              {entry.content && (
                <span
                  className={`${styles.contentText} ${isAnnotation ? styles.annotationContent : ""}`}
                  style={{
                    fontSize: isAnnotation ? 13 : 15,
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
          )}

          {isAnnotation && !isCollapsedAnnotationGroup && annotationEndContent && (
            <div className={styles.annotationEnd}>
              <span aria-hidden="true">↳</span>
              <ContentRenderer content={annotationEndContent} />
            </div>
          )}

          {/* Built-in display behavior is registered with the content type. */}
          {contentTypeDisplay && !isAnnotation && (
            <div style={{ marginTop: 6 }}>
              {contentTypeDisplay}
            </div>
          )}

          {/* Metadata Footer (tags only; category lives with the timestamp). */}
          {!isAnnotation && entry.tags && entry.tags.length > 0 && (
            <div className={styles.metadataFooter}>
              <div className={styles.tagsList}>
                {entry.tags?.map(tag => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Zaddy comments about this entry — attached, never a row of their
              own, and deliberately wearing the same muted ZADDY voice as an
              ambient annotation. */}
          {comments && comments.length > 0 && !isCollapsedAnnotationGroup && (
            <div className={styles.commentList}>
              {comments.map(comment => (
                <div key={comment.id} className={styles.comment}>
                  <div className={styles.commentMeta}>
                    <MessageSquareQuote size={9} strokeWidth={1.75} aria-hidden="true" />
                    <span>ZADDY</span>
                    <span className={styles.commentDate}>
                      {formatDate(comment.timestamp)}
                    </span>
                  </div>
                  <span className={styles.commentBody}>
                    <ContentRenderer content={comment.content} onImageClick={setLightboxImage} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Linked entries after (newer) */}
          {!isAnnotation && afterLinks.length > 0 && (
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
