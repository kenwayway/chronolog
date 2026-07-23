import { useState, useRef, useEffect, KeyboardEvent, MouseEvent } from "react";
import { Image, MapPin, Plus, ChevronDown } from "lucide-react";
import { EntryMetadataInput } from "../input/EntryMetadataInput";
import { BUILTIN_CONTENT_TYPES, ENTRY_TYPES } from "@/utils/constants";
import { useSessionContext } from "@/contexts/SessionContext";
import { prepareContentTypeSubmission } from "@/features/contentTypes";
import styles from "./EditModal.module.css";
import type { Entry, CategoryId, UpdateEntryPayload, EntryType } from "@/types";

interface EditModalProps {
  isOpen: boolean;
  entry: Entry | null;
  onSave: (entryId: string, updates: Omit<UpdateEntryPayload, 'entryId'>) => void;
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
  linkedEntries: string[];
  tags: string[];
  entryType: string;
}

function getInitialEditFormState(entry: Entry): EditFormState {
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
    linkedEntries: entry.linkedEntries || [],
    tags: entry.tags || [],
    entryType: entry.type || ENTRY_TYPES.NOTE,
  };
}

export function EditModal({ isOpen, entry, onSave, onClose }: EditModalProps) {
  if (!isOpen || !entry) return null;

  return <EditModalForm key={entry.id} entry={entry} onSave={onSave} onClose={onClose} />;
}

function EditModalForm({ entry, onSave, onClose }: Omit<EditModalProps, 'isOpen' | 'entry'> & { entry: Entry }) {
  const { state: { contentTypes: ctFromContext, mediaItems }, timelineEntries: allEntries, actions: { addMediaItem: onAddMediaItem, updateMediaItem: onUpdateMediaItem } } = useSessionContext();
  const types = ctFromContext.length > 0 ? ctFromContext : BUILTIN_CONTENT_TYPES;
  const [initialState] = useState(() => getInitialEditFormState(entry));
  // Content state
  const [content, setContent] = useState(initialState.content);
  const [timestamp, setTimestamp] = useState(initialState.timestamp);
  const [entryType, setEntryType] = useState<string>(initialState.entryType);

  // Metadata state (passed to EntryMetadataInput)
  const [category, setCategory] = useState<CategoryId | null>(initialState.category);
  const [contentType, setContentType] = useState<string | null>(initialState.contentType);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(initialState.fieldValues);
  const [linkedEntries, setLinkedEntries] = useState<string[]>(initialState.linkedEntries);
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

    if (contentType) {
      const prepared = prepareContentTypeSubmission(
        contentType,
        fieldValues,
        entryType as EntryType,
        entry.type,
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

    onSave(entry.id, {
      content: newContent !== entry.content ? newContent : undefined,
      timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
      category: category !== (entry.category ?? null) ? category : undefined,
      contentType: contentType !== (entry.contentType ?? null) ? contentType : undefined,
      fieldValues: JSON.stringify(normalizedFieldValues) !== JSON.stringify(entry.fieldValues) ? normalizedFieldValues : undefined,
      linkedEntries: JSON.stringify(linkedEntries) !== JSON.stringify(entry.linkedEntries || []) ? linkedEntries : undefined,
      tags: tagsChanged ? tags : undefined,
      type: entryType !== entry.type ? (entryType as EntryType) : undefined,
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
          linkedEntries={linkedEntries}
          setLinkedEntries={setLinkedEntries}
          allEntries={allEntries}
          currentEntryId={entry.id}
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
          {/* Row 1: Time & Entry Type */}
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

            {/* Entry Type */}
            <div className="flex items-center gap-2">
              <span className={styles.label}>ENTRY</span>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                disabled={entry.type !== ENTRY_TYPES.NOTE}
                title={entry.type !== ENTRY_TYPES.NOTE ? 'Session boundaries are projected from a Session interval' : undefined}
                className={styles.input}
                style={{ width: 'auto', minWidth: 100 }}
              >
                <option value={ENTRY_TYPES.NOTE}>Note</option>
                <option value={ENTRY_TYPES.SESSION_START}>Session Start</option>
                <option value={ENTRY_TYPES.SESSION_END}>Session End</option>
              </select>
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
