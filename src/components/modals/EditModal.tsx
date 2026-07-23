import { useState, useRef, useEffect, KeyboardEvent, MouseEvent } from "react";
import { Image, MapPin, Plus, ChevronDown } from "lucide-react";
import { EntryMetadataInput } from "../input/EntryMetadataInput";
import { BUILTIN_CONTENT_TYPES } from "@/utils/constants";
import { useSessionContext } from "@/contexts/SessionContext";
import { prepareContentTypeSubmission } from "@/features/contentTypes";
import styles from "./EditModal.module.css";
import type { TimelineItem, TimelineItemUpdate, CategoryId } from "@/types";

interface EditModalProps {
  isOpen: boolean;
  entry: TimelineItem | null;
  onSave: (item: TimelineItem, updates: TimelineItemUpdate) => void;
  onClose: () => void;
}

interface EditFormState {
  content: string;
  imageUrl: string;
  location: string;
  timestamp: string;
  category: CategoryId | null;
  contentType: string | null;
  fieldValues: Record<string, unknown>;
  linkedItems: string[];
  tags: string[];
}

function getInitialEditFormState(entry: TimelineItem): EditFormState {
  let imageUrl = "";
  let location = "";
  const content = (entry.content || "").split("\n").filter((line) => {
    if (line.startsWith("🖼️ ")) {
      imageUrl = line.replace("🖼️ ", "").trim();
      return false;
    }
    if (line.startsWith("📍 ")) {
      location = line.replace("📍 ", "").trim();
      return false;
    }
    return true;
  }).join("\n");

  const date = new Date(entry.timestamp);
  const timestamp = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    content,
    imageUrl,
    location,
    timestamp,
    category: entry.category || null,
    contentType: entry.contentType || null,
    fieldValues: (entry.fieldValues || {}) as Record<string, unknown>,
    linkedItems: entry.linkedItems || [],
    tags: entry.tags || [],
  };
}

export function EditModal({ isOpen, entry, onSave, onClose }: EditModalProps) {
  if (!isOpen || !entry) return null;

  return <EditModalForm key={entry.id} entry={entry} onSave={onSave} onClose={onClose} />;
}

function EditModalForm({ entry, onSave, onClose }: Omit<EditModalProps, 'isOpen' | 'entry'> & { entry: TimelineItem }) {
  const { state: { contentTypes: ctFromContext, mediaItems }, timelineItems: allItems, actions: { addMediaItem: onAddMediaItem, updateMediaItem: onUpdateMediaItem } } = useSessionContext();
  const types = ctFromContext.length > 0 ? ctFromContext : BUILTIN_CONTENT_TYPES;
  const [initialState] = useState(() => getInitialEditFormState(entry));
  // Content state
  const [content, setContent] = useState(initialState.content);
  const [timestamp, setTimestamp] = useState(initialState.timestamp);

  // Metadata state (passed to EntryMetadataInput)
  const [category, setCategory] = useState<CategoryId | null>(initialState.category);
  const [contentType, setContentType] = useState<string | null>(initialState.contentType);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(initialState.fieldValues);
  const [linkedItems, setLinkedItems] = useState<string[]>(initialState.linkedItems);
  const [tags, setTags] = useState<string[]>(initialState.tags);

  // Attachments state
  const [imageUrl, setImageUrl] = useState(initialState.imageUrl);
  const [location, setLocation] = useState(initialState.location);
  const [showImageInput, setShowImageInput] = useState(Boolean(initialState.imageUrl));
  const [showLocationInput, setShowLocationInput] = useState(Boolean(initialState.location));

  // UI state
  const [showMetadata, setShowMetadata] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);



  useEffect(() => {
    const focusTimer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(focusTimer);
  }, []);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocation("Location not supported");
      return;
    }
    setIsGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        });
      });
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        );
        const data = await response.json();
        const address =
          data.display_name?.split(",").slice(0, 3).join(",") ||
          `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setLocation(address);
      } catch {
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch {
      setLocation("Unable to get location");
    }
    setIsGettingLocation(false);
  };

  const buildContent = () => {
    let finalContent = content.trim();
    if (location) {
      finalContent += `\n📍 ${location}`;
    }
    if (imageUrl) {
      finalContent += `\n🖼️ ${imageUrl}`;
    }
    return finalContent;
  };

  const handleSave = () => {
    const newTimestamp = new Date(timestamp).getTime();
    const newContent = buildContent();
    let normalizedFieldValues = fieldValues;

    if (contentType && entry.kind !== 'session-end') {
      const prepared = prepareContentTypeSubmission(
        contentType,
        fieldValues,
        entry.kind === 'note' ? 'note' : 'session',
      );
      if (!prepared.ok) {
        alert(prepared.error);
        return;
      }
      normalizedFieldValues = prepared.fieldValues;
    }

    // Check if tags changed (compare arrays properly)
    const originalTags = entry.tags || [];
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(originalTags);

    onSave(entry, {
      content: newContent !== entry.content ? newContent : undefined,
      timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
      category: category !== (entry.category ?? null) ? category : undefined,
      contentType: contentType !== (entry.contentType ?? null) ? contentType : undefined,
      fieldValues: JSON.stringify(normalizedFieldValues) !== JSON.stringify(entry.fieldValues) ? normalizedFieldValues : undefined,
      linkedItems: JSON.stringify(linkedItems) !== JSON.stringify(entry.linkedItems || []) ? linkedItems : undefined,
      tags: tagsChanged ? tags : undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "Enter" && e.ctrlKey) handleSave();
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>EDIT ENTRY</span>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>

        {/* Main Content */}
        <div className={styles.body}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter content..."
            className={styles.contentArea}
          />
        </div>

        {/* Attachments (Image & Location) */}
        {(imageUrl || location || showImageInput || showLocationInput) && (
          <div className={styles.section} style={{ padding: '8px 20px' }}>
            {/* Image URL Input */}
            {showImageInput && (
              <div className="flex items-center gap-2 mb-2">
                <Image size={14} style={{ color: "var(--text-dim)" }} />
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste image URL..."
                  className={styles.input}
                  style={{ flex: 1 }}
                />
              </div>
            )}

            {/* Location Input */}
            {showLocationInput && (
              <div className="flex items-center gap-2">
                <MapPin size={14} style={{ color: "var(--text-dim)" }} />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location or get current..."
                  className={styles.input}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={getCurrentLocation}
                  className="btn-action btn-action-secondary"
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? "..." : "📍"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* EntryMetadataInput - Category, Content Type, Tags, Dynamic Fields, Linked Entries */}
        <EntryMetadataInput
          category={category}
          setCategory={setCategory}
          contentType={contentType}
          setContentType={setContentType}
          fieldValues={fieldValues}
          setFieldValues={setFieldValues}
          tags={tags}
          setTags={setTags}
          linkedItems={linkedItems}
          setLinkedItems={setLinkedItems}
          allItems={allItems}
          currentEntryId={entry.entityId}
          currentEntryTimestamp={entry.timestamp}
          contentTypes={types}
          isExpanded={showMetadata}
          showLinkedEntries={true}
          showAutoOption={false}
          mediaItems={mediaItems}
          onAddMediaItem={onAddMediaItem}
          onUpdateMediaItem={onUpdateMediaItem}
        />

        {/* Footer */}
        <div className={styles.footer}>
          {/* Row 1: Time */}
          <div className={styles.footerRow}>
            {/* Time */}
            <div className="flex items-center gap-2">
              <span className={styles.label}>TIME</span>
              <div lang="en-GB">
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className={styles.input}
                  style={{ width: 'auto', minWidth: 150 }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Icons & Save */}
          <div className={styles.footerRow}>
            <div className="flex items-center gap-2">
              {/* Toggle metadata button */}
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className={`icon-btn ${showMetadata ? "active" : ""}`}
                title={showMetadata ? "Hide options" : "More options"}
              >
                {showMetadata ? <ChevronDown size={16} /> : <Plus size={16} />}
              </button>

              {/* Attachment buttons */}
              <button
                onClick={() => setShowImageInput(!showImageInput)}
                title="Add image URL"
                className={`icon-btn ${showImageInput || imageUrl ? "active" : ""}`}
              >
                <Image size={16} />
              </button>
              <button
                onClick={() => setShowLocationInput(!showLocationInput)}
                title="Add location"
                className={`icon-btn ${showLocationInput || location ? "active" : ""}`}
              >
                <MapPin size={16} />
              </button>

            </div>

            <button onClick={handleSave} className="btn-action btn-action-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
