import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Link2, Search } from 'lucide-react';
import { Dropdown } from '../common/Dropdown';
import { DynamicFieldForm } from './DynamicFieldForm';
import { CATEGORIES, BUILTIN_CONTENT_TYPES } from '../../utils/constants';
import type { CategoryId, ContentType, Entry } from '../../types';

interface EntryMetadataInputProps {
  // Category
  category: CategoryId | null;
  setCategory: (category: CategoryId | null) => void;
  // Content Type
  contentType: string | null;
  setContentType: (contentType: string | null) => void;
  // Field Values (for DynamicFieldForm)
  fieldValues?: Record<string, unknown>;
  setFieldValues?: (values: Record<string, unknown>) => void;
  // Tags
  tags: string[];
  setTags: (tags: string[]) => void;
  // Linked Entries (optional - only for EditModal)
  linkedEntries?: string[];
  setLinkedEntries?: (entries: string[]) => void;
  allEntries?: Entry[];
  currentEntryId?: string;
  currentEntryTimestamp?: number;
  // Content types list (optional - use BUILTIN if not provided)
  contentTypes?: ContentType[];
  // UI state
  isExpanded: boolean;
  // Modes
  showLinkedEntries?: boolean; // Whether to show linked entries section
  showAutoOption?: boolean; // Whether to show 'Auto' option in dropdowns (false for EditModal)
}

/**
 * Shared component for entry metadata input
 * Used in FocusMode, EditModal, and other entry editing contexts
 */
export function EntryMetadataInput({
  category,
  setCategory,
  contentType,
  setContentType,
  fieldValues = {},
  setFieldValues,
  tags,
  setTags,
  linkedEntries = [],
  setLinkedEntries,
  allEntries = [],
  currentEntryId,
  currentEntryTimestamp = Date.now(),
  contentTypes,
  isExpanded,
  showLinkedEntries = false,
  showAutoOption = true,
}: EntryMetadataInputProps) {
  const [tagInput, setTagInput] = useState('');
  const [height, setHeight] = useState(0);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const types = contentTypes || BUILTIN_CONTENT_TYPES;

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded, tags.length, linkedEntries.length, showLinkSearch, contentType, fieldValues]);

  // Tag handling
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Linked entries handling
  const handleAddLinkedEntry = (entryId: string) => {
    if (setLinkedEntries && !linkedEntries.includes(entryId)) {
      setLinkedEntries([...linkedEntries, entryId]);
      setLinkSearch('');
      setShowLinkSearch(false);
    }
  };

  const handleRemoveLinkedEntry = (entryId: string) => {
    if (setLinkedEntries) {
      setLinkedEntries(linkedEntries.filter(id => id !== entryId));
    }
  };

  const getEntryPreview = (content: string | undefined) => {
    if (!content) return "(empty)";
    const firstLine = content.split("\n")[0];
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
  };

  // Filter searchable entries
  const searchableEntries = allEntries
    .filter(e => e.id !== currentEntryId && !linkedEntries.includes(e.id))
    .filter(e => linkSearch.trim() === "" || e.content?.toLowerCase().includes(linkSearch.toLowerCase()))
    .slice(0, 8);

  // Find content type definition for DynamicFieldForm
  const currentContentType = types.find(t => t.id === contentType) || null;

  return (
    <div
      className="entry-metadata-input"
      style={{
        overflow: 'hidden',
        height: height,
        transition: 'height 0.2s ease-out',
        borderTop: isExpanded ? '1px solid var(--border-subtle)' : 'none',
      }}
    >
      <div
        ref={contentRef}
        style={{
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Row 1: Category, Type, Tags - all in one row on desktop, wraps on mobile */}
        <div
          className="metadata-row"
          style={{
            padding: '8px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            rowGap: 6,
          }}
        >
          {/* Category */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
              CATEGORY
            </span>
            <Dropdown
              value={category}
              onChange={(val) => setCategory((val || null) as CategoryId | null)}
              placeholder={showAutoOption ? "Auto" : "None"}
              options={[
                ...(showAutoOption ? [{ value: '', label: 'Auto' }] : [{ value: '', label: 'None' }]),
                ...CATEGORIES.map(cat => ({
                  value: cat.id,
                  label: cat.label,
                  color: cat.color,
                })),
              ]}
            />
          </div>

          {/* Content Type */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
              TYPE
            </span>
            <Dropdown
              value={contentType}
              onChange={(val) => {
                setContentType(val || null);
                // Reset fieldValues when changing type
                if (setFieldValues) {
                  if (val === 'task') {
                    setFieldValues({ done: false });
                  } else if (val === 'bookmark') {
                    setFieldValues({ type: 'Article', status: 'Inbox' });
                  } else if (val === 'mood') {
                    setFieldValues({ feeling: 'Calm', energy: 3 });
                  } else if (val === 'workout') {
                    setFieldValues({ workoutType: 'Strength', exercises: '[]' });
                  } else {
                    setFieldValues({});
                  }
                }
              }}
              placeholder={showAutoOption ? "Auto" : "Note"}
              options={[
                ...(showAutoOption ? [{ value: '', label: 'Auto' }] : []),
                ...types.map(ct => ({ value: ct.id, label: ct.name }))
              ]}
            />
          </div>

          {/* Tags - inline with category/type on desktop, wraps to new line on mobile */}
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
              TAGS
            </span>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="add..."
              style={{
                width: 60,
                height: 22,
                padding: '0 6px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 0,
                outline: 'none',
              }}
            />
            {tags.map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                #{tag}
                <X
                  size={10}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRemoveTag(tag)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Row 2: Dynamic Field Form */}
        {contentType && contentType !== 'note' && setFieldValues && (
          <DynamicFieldForm
            contentType={currentContentType}
            fieldValues={fieldValues}
            onChange={setFieldValues}
          />
        )}

        {/* Row 3: Linked Entries (optional) */}
        {showLinkedEntries && setLinkedEntries && (
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
        )}
      </div>
    </div>
  );
}
