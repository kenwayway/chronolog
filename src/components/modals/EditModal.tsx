import { useState, useRef, useEffect, KeyboardEvent, MouseEvent } from "react";
import { Image, MapPin, Plus, ChevronDown } from "lucide-react";
import { EntryMetadataInput } from "../input/EntryMetadataInput";
import { BUILTIN_CONTENT_TYPES, ENTRY_TYPES } from "../../utils/constants";
import styles from "./EditModal.module.css";
import type { Entry, Category, ContentType, CategoryId, MediaItem } from "../../types";

interface EntryUpdates {
  content?: string;
  timestamp?: number;
  category?: CategoryId | null;
  contentType?: string | null;
  fieldValues?: Record<string, unknown>;
  linkedEntries?: string[];
  tags?: string[];
  type?: string;
}

interface EditModalProps {
  isOpen: boolean;
  entry: Entry | null;
  onSave: (entryId: string, updates: EntryUpdates) => void;
  onClose: () => void;
  categories: Category[];
  contentTypes?: ContentType[];
  allEntries?: Entry[];
  mediaItems?: MediaItem[];
  onAddMediaItem?: (mediaItem: MediaItem) => void;
}

export function EditModal({ isOpen, entry, onSave, onClose, categories, contentTypes, allEntries = [], mediaItems = [], onAddMediaItem }: EditModalProps) {
  // Content state
  const [content, setContent] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [entryType, setEntryType] = useState<string>(ENTRY_TYPES.NOTE);

  // Metadata state (passed to EntryMetadataInput)
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [linkedEntries, setLinkedEntries] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Attachments state
  const [imageUrl, setImageUrl] = useState("");
  const [location, setLocation] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);

  // UI state
  const [showMetadata, setShowMetadata] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const types = contentTypes || BUILTIN_CONTENT_TYPES;

  useEffect(() => {
    if (isOpen && entry) {
      // Parse content for image and location
      let mainContent = entry.content || "";
      let extractedImage = "";
      let extractedLocation = "";

      const lines = mainContent.split("\n");
      const filteredLines = lines.filter((line) => {
        if (line.startsWith("🖼️ ")) {
          extractedImage = line.replace("🖼️ ", "").trim();
          return false;
        }
        if (line.startsWith("📍 ")) {
          extractedLocation = line.replace("📍 ", "").trim();
          return false;
        }
        return true;
      });

      setContent(filteredLines.join("\n"));
      setImageUrl(extractedImage);
      setLocation(extractedLocation);
      setShowImageInput(!!extractedImage);
      setShowLocationInput(!!extractedLocation);

      const date = new Date(entry.timestamp);
      const localISOTime = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      setTimestamp(localISOTime);
      setCategory(entry.category || null);
      setContentType(entry.contentType || null);
      setFieldValues(entry.fieldValues || {});
      setLinkedEntries(entry.linkedEntries || []);
      setTags(entry.tags || []);
      setEntryType(entry.type || ENTRY_TYPES.NOTE);
      setShowMetadata(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

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

    // Check if tags changed (compare arrays properly)
    const originalTags = entry.tags || [];
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(originalTags);

    onSave(entry.id, {
      content: newContent !== entry.content ? newContent : undefined,
      timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
      category: category !== entry.category ? category : undefined,
      contentType: contentType !== entry.contentType ? contentType : undefined,
      fieldValues: JSON.stringify(fieldValues) !== JSON.stringify(entry.fieldValues) ? fieldValues : undefined,
      linkedEntries: JSON.stringify(linkedEntries) !== JSON.stringify(entry.linkedEntries || []) ? linkedEntries : undefined,
      tags: tagsChanged ? tags : undefined,
      type: entryType !== entry.type ? entryType : undefined,
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
        />

        {/* Footer */}
        <div className={styles.footer}>
          {/* Row 1: Time & Entry Type */}
          <div className={styles.footerRow}>
            {/* Time */}
            <div className="flex items-center gap-2">
              <span className={styles.label}>TIME</span>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className={styles.input}
                style={{ width: 'auto', minWidth: 150 }}
                lang="en-GB"
              />
            </div>

            {/* Entry Type */}
            <div className="flex items-center gap-2">
              <span className={styles.label}>ENTRY</span>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
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

              {/* Task done checkbox */}
              {contentType === 'task' && (
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={(fieldValues.done as boolean) || false}
                    onChange={(e) => setFieldValues(prev => ({ ...prev, done: e.target.checked }))}
                  />
                  <span style={{ fontSize: 10, color: "var(--text-dim)" }}>DONE</span>
                </label>
              )}
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
