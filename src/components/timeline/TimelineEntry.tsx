import { memo, ReactNode } from "react";
import { ChevronRight, MessageSquareQuote, Play, Square } from "lucide-react";
import { formatTime, formatDuration, formatApproxDuration, formatDate } from "@/utils/formatters";
import { ContentRenderer } from "./ContentRenderer";
import { CommentEditor } from "./CommentEditor";
import { LinkedEntryPreview } from "./LinkedEntryPreview";
import { ImageLightbox } from "../common/ImageLightbox";
import { useTimelineEntry, type EntrySymbol, type Position } from "./useTimelineEntry";
import styles from "./TimelineEntry.module.css";
import type { TimelineItem, Category, MediaItem } from "@/types";
import type { TimelineLinkIndex } from "@/domain/timeline";

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
  /** ID of the comment currently being edited in place, if any. */
  editingCommentId?: string | null;
  onEditComment?: (comment: TimelineItem) => void;
  onSaveComment?: (comment: TimelineItem, content: string) => void;
  onCancelCommentEdit?: () => void;
  isCreatingComment?: boolean;
  onSaveNewComment?: (target: TimelineItem, content: string) => void;
  onCancelNewComment?: () => void;
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
 *
 * This is the timeline skin: what an entry *is* comes from `useTimelineEntry`,
 * and everything below is how this layout chooses to draw it.
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
  editingCommentId,
  onEditComment,
  onSaveComment,
  onCancelCommentEdit,
  isCreatingComment = false,
  onSaveNewComment,
  onCancelNewComment,
  annotationMode = false,
  annotationEndContent,
  annotationGroupCount,
  annotationGroupExpanded = false,
  annotationGroupEntryIds,
  onToggleAnnotationGroup,
}: TimelineEntryProps) {
  const {
    category,
    categoryTextColor,
    isSessionStart,
    isSessionEnd,
    isZaddy,
    isAnnotation,
    isCollapsedAnnotationGroup,
    symbol,
    beforeLinks,
    afterLinks,
    contentTypeDisplay,
    entryGestures,
    commentGestures,
    lightboxImage,
    openLightbox,
    closeLightbox,
  } = useTimelineEntry({
    entry,
    linkIndex,
    categories,
    isLightMode,
    mediaItems,
    annotationMode,
    annotationGroupCount,
    annotationGroupExpanded,
    onContextMenu,
    onEdit,
    onEditComment,
  });

  const renderSymbol = (symbol: EntrySymbol): ReactNode => {
    switch (symbol.kind) {
      case 'annotation':
        return (
          <MessageSquareQuote
            size={10}
            strokeWidth={1.75}
            className={`${styles.timelineIcon} ${styles.annotationIcon}`}
            aria-hidden="true"
          />
        );
      case 'zaddy':
        return (
          <MessageSquareQuote
            size={12}
            strokeWidth={2}
            className={`${styles.timelineIcon} ${styles.zaddyIcon}`}
            aria-hidden="true"
          />
        );
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
      case 'content-glyph':
        return <span style={{ fontSize: "var(--text-base)", color: 'var(--accent)' }}>{symbol.glyph}</span>;
      case 'note-glyph':
      default:
        return <span style={{ fontSize: "var(--text-base)", color: "var(--text-dim)" }}>{symbol.glyph}</span>;
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
          gap: "var(--space-4)",
          cursor: "default",
          userSelect: "none",
          transition: "background-color 300ms ease",
        }}
        {...entryGestures}
      >
        {/* Time Column */}
        <div className={styles.timeCol}>
          {showDate && (
            <div style={{ marginBottom: "var(--space-05)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {formatDate(new Date(entry.timestamp).getTime())}
            </div>
          )}
          {formatTime(entry.timestamp)}
          {/* Duration under timestamp for session start */}
          {isSessionStart && sessionDuration && !isCollapsedAnnotationGroup && (
            <div
              style={{
                marginTop: "var(--space-05)",
                fontSize: "var(--text-xs)",
                color: isAnnotation ? "var(--text-dim)" : "var(--accent)",
                fontWeight: 500,
              }}
            >
              {isZaddy ? `CHAT ~${formatApproxDuration(sessionDuration)}` : formatDuration(sessionDuration)}
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
            fontSize: "var(--text-base)",
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
            {renderSymbol(symbol)}
          </div>
        </div>

        {/* Content */}
        <div className={styles.contentCol} style={{ flex: 1, minWidth: 0 }}>
          {/* Linked entries before (older) */}
          {!isAnnotation && beforeLinks.length > 0 && (
            <div className="linked-entries-before" style={{ marginBottom: "var(--space-2)" }}>
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
              fontSize: "var(--text-xs)",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              marginBottom: "var(--space-1)",
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
            <div className="flex flex-wrap items-baseline" style={{ gap: "var(--space-1) var(--space-3)", marginBottom: "var(--space-2)" }}>
              {isZaddy && !isAnnotation && (
                <span className={styles.originBadge}>ZADDY</span>
              )}
              {entry.content && (
                <span
                  className={`${styles.contentText} ${isAnnotation ? styles.annotationContent : ""}`}
                  style={{
                    fontSize: isAnnotation ? "var(--text-sm)" : "var(--text-base)",
                    lineHeight: 1.6,
                    overflowWrap: "break-word",
                    fontFamily: "var(--font-primary)",
                    whiteSpace: "pre-wrap",
                    color: getContentColor(),
                    fontStyle: isSessionEnd ? "italic" : "normal",
                  }}
                >
                  <ContentRenderer content={entry.content} onImageClick={openLightbox} />
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
            <div style={{ marginTop: "var(--space-2)" }}>
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
          {((comments?.length ?? 0) > 0 || isCreatingComment) && !isCollapsedAnnotationGroup && (
            <div className={styles.commentList}>
              {comments?.map(comment => (
                <div
                  key={comment.id}
                  className={styles.comment}
                  data-comment-id={comment.id}
                  {...commentGestures(comment)}
                >
                  <div className={styles.commentMeta}>
                    <MessageSquareQuote size={9} strokeWidth={1.75} aria-hidden="true" />
                    <span>ZADDY</span>
                    <span className={styles.commentDate}>
                      {formatDate(comment.timestamp)}
                    </span>
                  </div>
                  {editingCommentId === comment.id ? (
                    <CommentEditor
                      initialContent={comment.content || ""}
                      onSave={content => onSaveComment?.(comment, content)}
                      onCancel={() => onCancelCommentEdit?.()}
                      className={styles.commentEditor}
                    />
                  ) : (
                    <span className={styles.commentBody}>
                      <ContentRenderer content={comment.content} onImageClick={openLightbox} />
                    </span>
                  )}
                </div>
              ))}
              {isCreatingComment && (
                <div className={styles.comment}>
                  <div className={styles.commentMeta}>
                    <MessageSquareQuote size={9} strokeWidth={1.75} aria-hidden="true" />
                    <span>ZADDY</span>
                    <span className={styles.commentDate}>NOW</span>
                  </div>
                  <CommentEditor
                    initialContent=""
                    onSave={content => onSaveNewComment?.(entry, content)}
                    onCancel={() => onCancelNewComment?.()}
                    className={styles.commentEditor}
                  />
                </div>
              )}
            </div>
          )}

          {/* Linked entries after (newer) */}
          {!isAnnotation && afterLinks.length > 0 && (
            <div className="linked-entries-after" style={{ marginTop: "var(--space-2)" }}>
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
          onClose={closeLightbox}
        />
      )}
    </>
  );
});
