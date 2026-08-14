import { useState, useRef, useMemo, type ReactNode, type MouseEvent, type TouchEvent } from "react";
import { darkenColor } from "@/utils/contentParser";
import { useTheme } from "@/hooks/useTheme";
import { getContentTypeTimelineSymbol, renderContentTypeDisplay } from "@/features/contentTypes";
import type { TimelineItem, Category, MediaItem } from "@/types";
import type { TimelineLinkIndex } from "@/domain/timeline";

export interface Position {
    x: number;
    y: number;
}

/**
 * What symbol an entry earns, resolved but not yet drawn.
 *
 * The choice is the same in every skin — a session start is a session start —
 * while the drawing is not: the timeline hangs a 12px icon on a vertical rule,
 * a card puts the same meaning in a corner badge. So this names the meaning and
 * carries the theme glyph where there is one, and leaves the markup to the skin.
 */
export type EntrySymbol =
    | { kind: "annotation" }
    | { kind: "zaddy" }
    | { kind: "session-start" }
    | { kind: "session-end" }
    /** The glyph a content type registered for the timeline. */
    | { kind: "content-glyph"; glyph: string }
    /** The theme's plain-note glyph, worn by anything with nothing better. */
    | { kind: "note-glyph"; glyph: string };

export interface TimelineEntryModelInput {
    entry: TimelineItem;
    linkIndex: TimelineLinkIndex;
    categories: Category[];
    isLightMode: boolean;
    mediaItems?: MediaItem[];
    annotationMode?: boolean;
    annotationGroupCount?: number;
    annotationGroupExpanded?: boolean;
    onContextMenu?: (entry: TimelineItem, position: Position) => void;
    onEdit?: (entry: TimelineItem) => void;
    onEditComment?: (comment: TimelineItem) => void;
}

/** Gesture props meant to be spread onto whatever element a skin makes the row. */
export interface EntryGestures {
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
    onTouchStart: (event: TouchEvent<HTMLElement>) => void;
    onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
    onTouchCancel: (event: TouchEvent<HTMLElement>) => void;
}

export interface CommentGestures {
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    onDoubleClick: (event: MouseEvent<HTMLElement>) => void;
    onTouchStart: (event: TouchEvent<HTMLElement>) => void;
    onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
    onTouchCancel: (event: TouchEvent<HTMLElement>) => void;
}

export interface TimelineEntryModel {
    category: Category | undefined;
    /** Category colour already adjusted for the current mode, or null. */
    categoryTextColor: string | null;
    isSessionStart: boolean;
    isSessionEnd: boolean;
    isZaddy: boolean;
    isAnnotation: boolean;
    isCollapsedAnnotationGroup: boolean;
    symbol: EntrySymbol;
    /** Linked entries older than this one. */
    beforeLinks: TimelineItem[];
    /** Linked entries at or newer than this one. */
    afterLinks: TimelineItem[];
    contentTypeDisplay: ReactNode;
    entryGestures: EntryGestures;
    commentGestures: (comment: TimelineItem) => CommentGestures;
    lightboxImage: string | null;
    openLightbox: (src: string) => void;
    closeLightbox: () => void;
}

const LONG_PRESS_MS = 500;

/**
 * Everything an entry is, minus how it looks.
 *
 * Both the timeline and any future card layout answer the same questions about
 * an entry — which category, which symbol, what links either side of it,
 * right-click and long-press to the same menu — and only differ in the markup
 * that answers them. Keeping that here means a second skin is drawing, not a
 * second copy of this behaviour drifting out of step with the first.
 */
export function useTimelineEntry({
    entry,
    linkIndex,
    categories,
    isLightMode,
    mediaItems = [],
    annotationMode = false,
    annotationGroupCount,
    annotationGroupExpanded = false,
    onContextMenu,
    onEdit,
    onEditComment,
}: TimelineEntryModelInput): TimelineEntryModel {
    const { symbols } = useTheme();
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const entryGestures: EntryGestures = {
        onContextMenu: (e) => {
            e.preventDefault();
            onContextMenu?.(entry, { x: e.clientX, y: e.clientY });
        },
        onDoubleClick: () => {
            onEdit?.(entry);
        },
        onTouchStart: (e) => {
            e.currentTarget.style.userSelect = "none";
            e.currentTarget.style.setProperty("-webkit-user-select", "none");
            const touch = e.touches[0];
            const timer = setTimeout(() => {
                onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY });
            }, LONG_PRESS_MS);
            setPressTimer(timer);
        },
        onTouchEnd: (e) => {
            e.currentTarget.style.userSelect = "";
            e.currentTarget.style.removeProperty("-webkit-user-select");
            if (pressTimer) {
                clearTimeout(pressTimer);
                setPressTimer(null);
            }
        },
        onTouchCancel: (e) => {
            e.currentTarget.style.userSelect = "";
            e.currentTarget.style.removeProperty("-webkit-user-select");
            if (pressTimer) {
                clearTimeout(pressTimer);
                setPressTimer(null);
            }
        },
    };

    // A comment is rendered inside its target's DOM, so its own gestures must be
    // kept from reaching the entry underneath: a right-click on a comment is
    // about the comment, not about the thing it is attached to.
    const commentPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCommentPress = (e: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
        e.stopPropagation();
        if (commentPressTimer.current) {
            clearTimeout(commentPressTimer.current);
            commentPressTimer.current = null;
        }
    };

    const commentGestures = (comment: TimelineItem): CommentGestures => ({
        onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu?.(comment, { x: e.clientX, y: e.clientY });
        },
        onDoubleClick: (e) => {
            e.stopPropagation();
            onEditComment?.(comment);
        },
        onTouchStart: (e) => {
            e.stopPropagation();
            const touch = e.touches[0];
            commentPressTimer.current = setTimeout(() => {
                onContextMenu?.(comment, { x: touch.clientX, y: touch.clientY });
            }, LONG_PRESS_MS);
        },
        onTouchEnd: clearCommentPress,
        onTouchCancel: clearCommentPress,
    });

    const category = useMemo(
        () => categories?.find((c) => c.id === entry.category),
        [categories, entry.category]
    );

    const categoryTextColor = useMemo(
        () => category ? (isLightMode ? darkenColor(category.color, 10) : category.color) : null,
        [category, isLightMode]
    );

    const isSessionStart = entry.kind === "session-start";
    const isSessionEnd = entry.kind === "session-end";
    const isZaddy = entry.origin === "zaddy";
    const isAnnotation = isZaddy && annotationMode;
    const isCollapsedAnnotationGroup = isAnnotation
        && annotationGroupCount !== undefined
        && !annotationGroupExpanded;

    const symbol = useMemo((): EntrySymbol => {
        if (isAnnotation) return { kind: "annotation" };
        if (isZaddy) return { kind: "zaddy" };

        const contentTypeSymbol = getContentTypeTimelineSymbol(entry.contentType);
        if (contentTypeSymbol) return { kind: "content-glyph", glyph: symbols[contentTypeSymbol] };

        switch (entry.kind) {
            case "session-start":
                return { kind: "session-start" };
            case "session-end":
                return { kind: "session-end" };
            case "note":
            default:
                return { kind: "note-glyph", glyph: symbols.note };
        }
    }, [isAnnotation, isZaddy, entry.contentType, entry.kind, symbols]);

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

    const contentTypeDisplay = renderContentTypeDisplay(entry, mediaItems);

    return {
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
        openLightbox: setLightboxImage,
        closeLightbox: () => setLightboxImage(null),
    };
}
