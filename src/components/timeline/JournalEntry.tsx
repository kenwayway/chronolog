import { memo, type CSSProperties } from "react";
import { ChevronRight, MessageSquareQuote } from "lucide-react";
import { formatTime, formatDuration, formatDate } from "@/utils/formatters";
import { ContentRenderer } from "./ContentRenderer";
import { CommentEditor } from "./CommentEditor";
import { LinkedEntryPreview } from "./LinkedEntryPreview";
import { ImageLightbox } from "../common/ImageLightbox";
import { useTimelineEntry, type Position } from "./useTimelineEntry";
import styles from "./JournalEntry.module.css";
import type { TimelineItem, Category, MediaItem } from "@/types";
import type { TimelineLinkIndex } from "@/domain/timeline";

interface JournalEntryProps {
    entry: TimelineItem;
    linkIndex: TimelineLinkIndex;
    sessionDuration?: number;
    categories: Category[];
    onContextMenu?: (entry: TimelineItem, position: Position) => void;
    onEdit?: (entry: TimelineItem) => void;
    isLightMode: boolean;
    showDate?: boolean;
    onNavigateToEntry?: (entry: TimelineItem) => void;
    mediaItems?: MediaItem[];
    comments?: TimelineItem[];
    editingCommentId?: string | null;
    onEditComment?: (comment: TimelineItem) => void;
    onSaveComment?: (comment: TimelineItem, content: string) => void;
    onCancelCommentEdit?: () => void;
    annotationMode?: boolean;
    annotationEndContent?: string;
    annotationGroupCount?: number;
    annotationGroupExpanded?: boolean;
    annotationGroupEntryIds?: string[];
    onToggleAnnotationGroup?: () => void;
}

/**
 * An entry as a card.
 *
 * The layout's one claim is on the left edge: a session has length and wears a
 * full spine, a note is an instant and wears a dot, and a session's closing
 * card fades that spine out. It is the only saturated colour on the card, so
 * the shape of a day is readable before a single word is.
 */
export const JournalEntry = memo(function JournalEntry({
    entry,
    linkIndex,
    sessionDuration,
    categories,
    onContextMenu,
    onEdit,
    isLightMode,
    showDate = false,
    onNavigateToEntry,
    mediaItems = [],
    comments,
    editingCommentId,
    onEditComment,
    onSaveComment,
    onCancelCommentEdit,
    annotationMode = false,
    annotationEndContent,
    annotationGroupCount,
    annotationGroupExpanded = false,
    annotationGroupEntryIds,
    onToggleAnnotationGroup,
}: JournalEntryProps) {
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

    const lightbox = lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={closeLightbox} />
    );

    // Zaddy's ambient annotations stay off the card stack entirely — they are
    // about her day rather than part of it.
    if (isAnnotation) {
        return (
            <>
                <div
                    className={styles.annotation}
                    data-entry-id={entry.id}
                    data-zaddy-entry-ids={annotationGroupEntryIds?.join(" ")}
                    {...entryGestures}
                >
                    <span className={styles.annotationRule} aria-hidden="true" />
                    <div className={styles.annotationBody}>
                        {annotationGroupCount !== undefined && (
                            <button
                                type="button"
                                className={styles.annotationToggle}
                                aria-expanded={annotationGroupExpanded}
                                onClick={event => {
                                    event.stopPropagation();
                                    onToggleAnnotationGroup?.();
                                }}
                                onDoubleClick={event => event.stopPropagation()}
                            >
                                <MessageSquareQuote size={12} strokeWidth={2} aria-hidden="true" />
                                <span>Zaddy</span>
                                <span className={styles.annotationCount}>
                                    {annotationGroupCount}
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

                        {!isCollapsedAnnotationGroup && entry.content && (
                            <div className={styles.annotationText}>
                                <ContentRenderer content={entry.content} onImageClick={openLightbox} />
                            </div>
                        )}

                        {!isCollapsedAnnotationGroup && annotationEndContent && (
                            <div className={styles.annotationEnd}>
                                <span aria-hidden="true">↳</span>
                                <ContentRenderer content={annotationEndContent} />
                            </div>
                        )}
                    </div>
                </div>
                {lightbox}
            </>
        );
    }

    // The spine takes the category's own colour; the accent belongs to the
    // controls she picked it for.
    const spineStyle = {
        "--spine-color": category?.color,
        "--category-color": categoryTextColor || undefined,
    } as CSSProperties;

    const spineClass = isSessionStart
        ? styles.spine
        : isSessionEnd
            ? styles.spineEnd
            : styles.spineDot;

    return (
        <>
            <div
                className={styles.card}
                data-entry-id={entry.id}
                style={spineStyle}
                {...entryGestures}
            >
                <span className={spineClass} aria-hidden="true" />

                <div className={styles.body}>
                    {beforeLinks.length > 0 && (
                        <div className={`${styles.links} ${styles.linksBefore}`}>
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

                    <div className={styles.head}>
                        {showDate && (
                            <span className={styles.date}>{formatDate(entry.timestamp)}</span>
                        )}
                        <span className={styles.time}>{formatTime(entry.timestamp)}</span>

                        {symbol.kind === "content-glyph" && (
                            <span className={styles.glyph} aria-hidden="true">{symbol.glyph}</span>
                        )}

                        {category && (
                            <>
                                <span className={styles.dot} aria-hidden="true" />
                                <span className={styles.category} title={`Category: ${category.label}`}>
                                    {category.label}
                                </span>
                            </>
                        )}

                        {isZaddy && <span className={styles.zaddyBadge}>Zaddy</span>}

                        {isSessionStart && sessionDuration !== undefined && (
                            <span className={styles.duration}>
                                {isZaddy ? `Chat ${formatDuration(sessionDuration)}` : formatDuration(sessionDuration)}
                            </span>
                        )}
                    </div>

                    {entry.content && (
                        <div
                            className={`${styles.content} ${isSessionEnd ? styles.contentClosing : ""}`}
                        >
                            <ContentRenderer content={entry.content} onImageClick={openLightbox} />
                        </div>
                    )}

                    {contentTypeDisplay && (
                        <div className={styles.typeDisplay}>{contentTypeDisplay}</div>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                        <div className={styles.tags}>
                            {entry.tags.map(tag => (
                                <span key={tag} className={styles.tag}>#{tag}</span>
                            ))}
                        </div>
                    )}

                    {comments && comments.length > 0 && (
                        <div className={styles.commentList}>
                            {comments.map(comment => (
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
                        </div>
                    )}

                    {afterLinks.length > 0 && (
                        <div className={styles.links}>
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
            {lightbox}
        </>
    );
});
