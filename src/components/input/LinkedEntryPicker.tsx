import { useState } from 'react';
import { X, Link2, Search } from 'lucide-react';
import type { Entry } from '../../types';

interface LinkedEntryPickerProps {
    linkedEntries: string[];
    setLinkedEntries: (entries: string[]) => void;
    allEntries: Entry[];
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
    linkedEntries,
    setLinkedEntries,
    allEntries,
    currentEntryId,
    currentEntryTimestamp,
}: LinkedEntryPickerProps) {
    const [showLinkSearch, setShowLinkSearch] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');

    const handleAddLinkedEntry = (entryId: string) => {
        if (!linkedEntries.includes(entryId)) {
            setLinkedEntries([...linkedEntries, entryId]);
            setLinkSearch('');
            setShowLinkSearch(false);
        }
    };

    const handleRemoveLinkedEntry = (entryId: string) => {
        setLinkedEntries(linkedEntries.filter(id => id !== entryId));
    };

    // Filter searchable entries
    const searchableEntries = allEntries
        .filter(e => e.id !== currentEntryId && !linkedEntries.includes(e.id))
        .filter(e => linkSearch.trim() === "" || e.content?.toLowerCase().includes(linkSearch.toLowerCase()))
        .slice(0, 8);

    return (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Link2 size={12} style={{ color: "var(--text-dim)" }} />
                <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>LINKED ENTRIES</span>
                <button
                    onClick={() => setShowLinkSearch(!showLinkSearch)}
                    className={`btn-action ${showLinkSearch ? 'btn-action-primary' : 'btn-action-secondary'}`}
                >
                    + ADD
                </button>
            </div>

            {/* Current linked entries */}
            {linkedEntries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: showLinkSearch ? 8 : 0 }}>
                    {linkedEntries.map(linkId => {
                        const linkedEntry = allEntries.find(e => e.id === linkId);
                        if (!linkedEntry) return null;
                        const isOlder = linkedEntry.timestamp < currentEntryTimestamp;
                        return (
                            <div
                                key={linkId}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 8px",
                                    backgroundColor: "var(--bg-tertiary)",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                <span style={{ color: isOlder ? "var(--accent)" : "var(--warning)", fontWeight: 600 }}>
                                    {isOlder ? "↑" : "↓"}
                                </span>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                                    {getEntryPreview(linkedEntry.content)}
                                </span>
                                <span style={{ fontSize: 9, color: "var(--text-dim)" }}>
                                    {new Date(linkedEntry.timestamp).toLocaleDateString()}
                                </span>
                                <button
                                    onClick={() => handleRemoveLinkedEntry(linkId)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: 2,
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Search size={12} style={{ color: "var(--text-dim)" }} />
                        <input
                            type="text"
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Search entries..."
                            className="edit-modal-input"
                            style={{ flex: 1, fontSize: 11 }}
                            autoFocus
                        />
                    </div>
                    {searchableEntries.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {searchableEntries.map(e => (
                                <button
                                    key={e.id}
                                    onClick={() => handleAddLinkedEntry(e.id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 8px",
                                        backgroundColor: "var(--bg-primary)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11,
                                        fontFamily: "var(--font-mono)",
                                        textAlign: "left",
                                    }}
                                >
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                                        {getEntryPreview(e.content)}
                                    </span>
                                    <span style={{ fontSize: 9, color: "var(--text-dim)" }}>
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
