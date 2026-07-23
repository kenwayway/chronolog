import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Link2 } from "lucide-react";
import { formatTime, formatDate } from "@/utils/formatters";
import type { TimelineItem } from "@/types";

interface LinkSelectorProps {
    isOpen: boolean;
    sourceEntry: TimelineItem | null;
    entries: TimelineItem[];
    onLink: (sourceId: string, linkedIds: string[]) => void;
    onClose: () => void;
}

export function LinkSelector({
    isOpen,
    sourceEntry,
    entries,
    onLink,
    onClose,
}: LinkSelectorProps) {
    if (!isOpen || !sourceEntry) return null;

    return (
        <LinkSelectorDialog
            key={sourceEntry.id}
            sourceEntry={sourceEntry}
            entries={entries}
            onLink={onLink}
            onClose={onClose}
        />
    );
}

interface LinkSelectorDialogProps {
    sourceEntry: TimelineItem;
    entries: TimelineItem[];
    onLink: (sourceId: string, linkedIds: string[]) => void;
    onClose: () => void;
}

function LinkSelectorDialog({ sourceEntry, entries, onLink, onClose }: LinkSelectorDialogProps) {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>(() => sourceEntry.linkedItems || []);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus the newly mounted dialog without synchronously resetting state in an effect.
    useEffect(() => {
        const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(focusTimer);
    }, []);

    // Filter entries (exclude self, match search)
    const filteredEntries = entries
        .filter((e) => e.entityId !== sourceEntry.entityId && e.kind !== 'session-end')
        .filter((e) => {
            if (!search.trim()) return true;
            return e.content?.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20); // Limit for performance

    const toggleLink = (entryId: string) => {
        setSelectedIds((prev) =>
            prev.includes(entryId)
                ? prev.filter((id) => id !== entryId)
                : [...prev, entryId]
        );
    };

    const handleSave = () => {
        onLink(sourceEntry.entityId, selectedIds);
        onClose();
    };

    const getPreview = (content: string | undefined) => {
        if (!content) return "(empty)";
        const firstLine = content.split("\n")[0];
        return firstLine.length > 50 ? firstLine.slice(0, 50) + "..." : firstLine;
    };

    return createPortal(
        <div
            className="modal-overlay"
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 16,
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="modal-content"
                style={{
                    width: "100%",
                    maxWidth: 480,
                    maxHeight: "70vh",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 8,
                    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link2 size={16} style={{ color: "var(--accent)" }} />
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            LINK TO
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            color: "var(--text-muted)",
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            backgroundColor: "var(--bg-secondary)",
                            borderRadius: 6,
                            border: "1px solid var(--border-subtle)",
                        }}
                    >
                        <Search size={14} style={{ color: "var(--text-muted)" }} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search entries..."
                            style={{
                                flex: 1,
                                background: "none",
                                border: "none",
                                outline: "none",
                                fontSize: 13,
                                color: "var(--text-primary)",
                                fontFamily: "var(--font-primary)",
                            }}
                        />
                    </div>
                </div>

                {/* Entry List */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "8px 0",
                    }}
                >
                    {filteredEntries.length === 0 ? (
                        <div
                            style={{
                                padding: 24,
                                textAlign: "center",
                                color: "var(--text-muted)",
                                fontSize: 13,
                            }}
                        >
                            No entries found
                        </div>
                    ) : (
                        filteredEntries.map((entry) => {
                            const isLinked = selectedIds.includes(entry.entityId);
                            const isOlder = entry.timestamp < sourceEntry.timestamp;

                            return (
                                <button
                                    key={entry.id}
                                    onClick={() => toggleLink(entry.entityId)}
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 12,
                                        width: "100%",
                                        padding: "10px 16px",
                                        background: isLinked ? "var(--accent-subtle)" : "transparent",
                                        border: "none",
                                        borderLeft: isLinked ? "3px solid var(--accent)" : "3px solid transparent",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        transition: "background 100ms ease",
                                    }}
                                >
                                    {/* Direction indicator */}
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: isOlder ? "var(--accent)" : "var(--warning)",
                                            fontWeight: 600,
                                            width: 16,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {isOlder ? "↑" : "↓"}
                                    </span>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                color: isLinked ? "var(--accent)" : "var(--text-secondary)",
                                                lineHeight: 1.4,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {getPreview(entry.content)}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--text-dim)",
                                                marginTop: 2,
                                                fontFamily: "var(--font-mono)",
                                            }}
                                        >
                                            {formatDate(entry.timestamp)} {formatTime(entry.timestamp)}
                                        </div>
                                    </div>

                                    {/* Checkbox */}
                                    <span
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: 4,
                                            border: `2px solid ${isLinked ? "var(--accent)" : "var(--border-light)"}`,
                                            backgroundColor: isLinked ? "var(--accent)" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            color: "white",
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {isLinked && "✓"}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderTop: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-secondary)",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        {selectedIds.length} linked
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: "6px 12px",
                                fontSize: 11,
                                fontFamily: "var(--font-mono)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--border-light)",
                                borderRadius: 4,
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                            }}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSave}
                            style={{
                                padding: "6px 12px",
                                fontSize: 11,
                                fontFamily: "var(--font-mono)",
                                backgroundColor: "var(--accent)",
                                border: "none",
                                borderRadius: 4,
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                        >
                            SAVE
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
