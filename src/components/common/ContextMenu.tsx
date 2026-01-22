import { useEffect, useRef } from "react";
import { ENTRY_TYPES } from "../../utils/constants";
import styles from "./ContextMenu.module.css";
import type { Entry } from "../../types";

interface Position {
    x: number;
    y: number;
}

interface ContextMenuProps {
    isOpen: boolean;
    position: Position;
    entry: Entry | null;
    onClose: () => void;
    onEdit: (entry: Entry) => void;
    onDelete: (entry: Entry) => void;
    onCopy: (entry: Entry) => void;
    onMarkAsTask: (entry: Entry) => void;
    onLink?: (entry: Entry) => void;
    onAIComment?: (entry: Entry) => void;
    onDeleteAIComment?: (entry: Entry) => void;
    googleTasksEnabled?: boolean;
    aiLoading?: boolean;
}

export function ContextMenu({
    isOpen,
    position,
    entry,
    onClose,
    onEdit,
    onDelete,
    onCopy,
    onMarkAsTask,
    onLink,
    onAIComment,
    onDeleteAIComment,
    googleTasksEnabled = false,
    aiLoading = false,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !entry) return null;

    const handleEdit = () => {
        onEdit(entry);
        onClose();
    };
    const handleDelete = () => {
        onDelete(entry);
        onClose();
    };
    const handleCopy = () => {
        onCopy(entry);
        onClose();
    };
    const handleMarkAsTask = () => {
        onMarkAsTask(entry);
        onClose();
    };
    const handleLink = () => {
        onLink?.(entry);
        onClose();
    };
    const handleAIComment = () => {
        onAIComment?.(entry);
        // Don't close immediately - let loading state show
    };
    const handleDeleteAIComment = () => {
        onDeleteAIComment?.(entry);
        onClose();
    };

    // Can mark as task: NOTE or SESSION_START, not already a task
    const isTask = entry.contentType === 'task';
    const canMarkAsTask =
        (entry.type === ENTRY_TYPES.NOTE || entry.type === ENTRY_TYPES.SESSION_START) &&
        !isTask;

    // Can add AI comment: has content and no existing comment
    const canAddAIComment = !!entry.content?.trim() && !entry.aiComment;

    // Can delete AI comment: has existing comment
    const hasAIComment = !!entry.aiComment;

    return (
        <div
            ref={menuRef}
            className={`${styles.menu} animate-slide-in`}
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            {canMarkAsTask && (
                <button
                    className={styles.item}
                    onClick={handleMarkAsTask}
                    title={googleTasksEnabled ? "Adds to Google Tasks" : "Connect Google Tasks in Settings"}
                >
                    MARK TODO
                </button>
            )}

            {isTask && (
                <span className={styles.item} style={{ color: "var(--text-dim)", cursor: "default" }}>
                    [PENDING TASK]
                </span>
            )}

            <button className={styles.item} onClick={handleEdit}>
                EDIT
            </button>

            <button className={styles.item} onClick={handleLink}>
                ↪ FOLLOW UP
            </button>

            {canAddAIComment && (
                <button
                    className={styles.item}
                    onClick={handleAIComment}
                    disabled={aiLoading}
                >
                    {aiLoading ? "GENERATING..." : "AI COMMENT"}
                </button>
            )}

            {hasAIComment && (
                <button
                    className={`${styles.item} ${styles.itemDanger}`}
                    onClick={handleDeleteAIComment}
                >
                    DELETE AI COMMENT
                </button>
            )}

            <button className={styles.item} onClick={handleCopy}>
                COPY
            </button>

            <div className={styles.divider} />

            <button
                className={`${styles.item} ${styles.itemDanger}`}
                onClick={handleDelete}
            >
                DELETE
            </button>
        </div>
    );
}

