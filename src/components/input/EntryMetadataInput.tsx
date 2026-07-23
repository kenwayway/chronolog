import { Dropdown } from '../common/Dropdown';
import { DynamicFieldForm } from './DynamicFieldForm';
import { TagInput } from './TagInput';
import { LinkedEntryPicker } from './LinkedEntryPicker';
import { CATEGORIES, BUILTIN_CONTENT_TYPES } from '@/utils/constants';
import { getContentTypeDefaultValues } from '@/features/contentTypes';
import type { CategoryId, ContentType, TimelineItem, MediaItem } from '@/types';

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
  linkedItems?: string[];
  setLinkedItems?: (items: string[]) => void;
  allItems?: TimelineItem[];
  currentEntryId?: string;
  currentEntryTimestamp?: number;
  // Content types list (optional - use BUILTIN if not provided)
  contentTypes?: ContentType[];
  // Media library
  mediaItems?: MediaItem[];
  onAddMediaItem?: (mediaItem: MediaItem) => void;
  onUpdateMediaItem?: (id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>) => void;
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
  linkedItems = [],
  setLinkedItems,
  allItems = [],
  currentEntryId,
  currentEntryTimestamp = 0,
  contentTypes,
  mediaItems = [],
  onAddMediaItem,
  onUpdateMediaItem,
  isExpanded,
  showLinkedEntries = false,
  showAutoOption = true,
}: EntryMetadataInputProps) {
  const types = contentTypes || BUILTIN_CONTENT_TYPES;

  // Find content type definition for DynamicFieldForm
  const currentContentType = types.find(t => t.id === contentType) || null;

  return (
    <div
      className="entry-metadata-input"
      style={{
        display: 'grid',
        gridTemplateRows: isExpanded ? '1fr' : '0fr',
        overflow: 'hidden',
        transition: 'grid-template-rows 0.2s ease-out',
        borderTop: isExpanded ? '1px solid var(--border-subtle)' : 'none',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        style={{
          minHeight: 0,
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
                  setFieldValues(getContentTypeDefaultValues(val));
                }
              }}
              placeholder={showAutoOption ? "Auto" : "Note"}
              options={[
                ...(showAutoOption ? [{ value: '', label: 'Auto' }] : []),
                ...types.map(ct => ({ value: ct.id, label: ct.name }))
              ]}
            />
          </div>

          {/* Tags */}
          <TagInput tags={tags} setTags={setTags} />
        </div>

        {/* Row 2: Dynamic Field Form */}
        {contentType && contentType !== 'note' && setFieldValues && (
          <DynamicFieldForm
            contentType={currentContentType}
            fieldValues={fieldValues}
            onChange={setFieldValues}
            mediaItems={mediaItems}
            onAddMediaItem={onAddMediaItem}
            onUpdateMediaItem={onUpdateMediaItem}
          />
        )}

        {/* Row 3: Linked Entries (optional) */}
        {showLinkedEntries && setLinkedItems && (
          <LinkedEntryPicker
            linkedItems={linkedItems}
            setLinkedItems={setLinkedItems}
            allItems={allItems}
            currentEntryId={currentEntryId}
            currentEntryTimestamp={currentEntryTimestamp}
          />
        )}
      </div>
    </div>
  );
}
