import { useEffect, useRef } from "react";
import styles from "./ContextMenu.module.css";
import type { TimelineItem } from "@/types";

interface Position {
    x: number;
    y: number;
}

interface ContextMenuProps {
    isOpen: boolean;
    position: Position;
    entry: TimelineItem | null;
    onClose: () => void;
    onEdit: (entry: TimelineItem) => void;
    onDelete: (entry: TimelineItem) => void;
    onCopy: (entry: TimelineItem) => void;
    onLink?: (entry: TimelineItem) => void;
}

export function ContextMenu({
    isOpen,
    position,
    entry,
    onClose,
    onEdit,
    onDelete,
    onCopy,
    onLink,
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
    const handleLink = () => {
        onLink?.(entry);
        onClose();
    };
    return (
        <div
            ref={menuRef}
            className={`${styles.menu} animate-slide-in`}
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            <button className={styles.item} onClick={handleEdit}>
                EDIT
            </button>

            <button className={styles.item} onClick={handleLink}>
                ↪ FOLLOW UP
            </button>



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
