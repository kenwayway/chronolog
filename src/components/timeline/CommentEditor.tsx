import { useState, useRef, useEffect, type KeyboardEvent } from "react";

/**
 * In-place editor for a zaddy comment's text.
 *
 * Deliberately narrow: it writes `content` and nothing else, so a comment can
 * never be edited out of being a comment. Enter saves, Shift+Enter breaks the
 * line, Escape abandons the draft; blurring saves, which keeps a click
 * elsewhere from silently discarding what was typed.
 *
 * The skin supplies `className`; everything else here is behaviour both skins
 * want identical.
 */
export function CommentEditor({
    initialContent,
    onSave,
    onCancel,
    className,
}: {
    initialContent: string;
    onSave: (content: string) => void;
    onCancel: () => void;
    className?: string;
}) {
    const [draft, setDraft] = useState(initialContent);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Escape and a completed save both blur the field; neither should be
    // followed by the blur handler committing a second time.
    const settledRef = useRef(false);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, []);

    const commit = () => {
        if (settledRef.current) return;
        settledRef.current = true;
        const trimmed = draft.trim();
        // An emptied comment is a mistake, not a deletion — deleting is its own
        // menu action.
        if (!trimmed || trimmed === initialContent) onCancel();
        else onSave(trimmed);
    };

    const abandon = () => {
        if (settledRef.current) return;
        settledRef.current = true;
        onCancel();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            abandon();
        }
    };

    return (
        <textarea
            ref={textareaRef}
            className={className}
            value={draft}
            rows={Math.min(10, draft.split("\n").length + 1)}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            onContextMenu={event => event.stopPropagation()}
            onDoubleClick={event => event.stopPropagation()}
        />
    );
}
