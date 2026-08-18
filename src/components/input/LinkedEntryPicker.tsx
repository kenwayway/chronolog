import { useState } from 'react';
import { X, Link2, Search } from 'lucide-react';
import type { TimelineItem } from '@/types';

interface LinkedEntryPickerProps {
    linkedItems: string[];
    setLinkedItems: (items: string[]) => void;
    allItems: TimelineItem[];
    currentEntryId?: string;
    currentEntryTimestamp: number;
}

function getEntryPreview(content: string | undefined) {
    if (!content) return "(empty)";
    const firstLine = content.split("\n")[0];
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
}

/**
 * Linked entries section with search and add/remove
 */
export function LinkedEntryPicker({
    linkedItems,
    setLinkedItems,
    allItems,
    currentEntryId,
    currentEntryTimestamp,
}: LinkedEntryPickerProps) {
    const [showLinkSearch, setShowLinkSearch] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');

    const handleAddLinkedEntry = (entryId: string) => {
        if (!linkedItems.includes(entryId)) {
            setLinkedItems([...linkedItems, entryId]);
            setLinkSearch('');
            setShowLinkSearch(false);
        }
    };

    const handleRemoveLinkedEntry = (entryId: string) => {
        setLinkedItems(linkedItems.filter(id => id !== entryId));
    };

    // Filter searchable entries
    const searchableEntries = allItems
        .filter(e => e.kind !== 'session-end' && e.entityId !== currentEntryId && !linkedItems.includes(e.entityId))
        .filter(e => linkSearch.trim() === "" || e.content?.toLowerCase().includes(linkSearch.toLowerCase()))
        .slice(0, 8);

    return (
        <div style={{ padding: 'var(--space-2) var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <Link2 size={12} style={{ color: "var(--text-dim)" }} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)", fontWeight: 600 }}>LINKED ENTRIES</span>
                <button
                    onClick={() => setShowLinkSearch(!showLinkSearch)}
                    className={`btn-action ${showLinkSearch ? 'btn-action-primary' : 'btn-action-secondary'}`}
                >
                    + ADD
                </button>
            </div>

            {/* Current linked entries */}
            {linkedItems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginBottom: showLinkSearch ? "var(--space-2)" : 0 }}>
                    {linkedItems.map(linkId => {
                        const linkedEntry = allItems.find(e => e.entityId === linkId && e.kind !== 'session-end');
                        if (!linkedEntry) return null;
                        const isOlder = linkedEntry.timestamp < currentEntryTimestamp;
                        return (
                            <div
                                key={linkId}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-2)",
                                    padding: "var(--space-1) var(--space-2)",
                                    backgroundColor: "var(--bg-tertiary)",
                                    borderRadius: 4,
                                    fontSize: "var(--text-xs)",
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                <span style={{ color: isOlder ? "var(--accent)" : "var(--warning)", fontWeight: 600 }}>
                                    {isOlder ? "↑" : "↓"}
                                </span>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                                    {getEntryPreview(linkedEntry.content)}
                                </span>
                                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)" }}>
                                    {new Date(linkedEntry.timestamp).toLocaleDateString()}
                                </span>
                                <button
                                    onClick={() => handleRemoveLinkedEntry(linkId)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "var(--space-05)",
                                        color: "var(--text-muted)",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Search input */}
            {showLinkSearch && (
                <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                        <Search size={12} style={{ color: "var(--text-dim)" }} />
                        <input
                            type="text"
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Search entries..."
                            className="edit-modal-input"
                            style={{ flex: 1, fontSize: "var(--text-xs)" }}
                            autoFocus
                        />
                    </div>
                    {searchableEntries.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-05)" }}>
                            {searchableEntries.map(e => (
                                <button
                                    key={e.id}
                                    onClick={() => handleAddLinkedEntry(e.entityId)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "var(--space-2)",
                                        padding: "var(--space-2) var(--space-2)",
                                        backgroundColor: "var(--bg-primary)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: "var(--text-xs)",
                                        fontFamily: "var(--font-mono)",
                                        textAlign: "left",
                                    }}
                                >
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                                        {getEntryPreview(e.content)}
                                    </span>
                                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-dim)" }}>
                                        {new Date(e.timestamp).toLocaleDateString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
