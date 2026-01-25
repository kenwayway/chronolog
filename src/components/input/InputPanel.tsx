import { useState, useRef, useEffect, forwardRef, useImperativeHandle, ChangeEvent, KeyboardEvent, ClipboardEvent, FocusEvent } from "react";
import { Terminal, X, Link2 } from "lucide-react";
import { SESSION_STATUS } from "../../utils/constants";
import { FocusMode } from "./FocusMode";
import { AttachmentPreview } from "./AttachmentPreview";
import { InputActions } from "./InputActions";
import { EntryMetadataInput } from "./EntryMetadataInput";
import styles from "./InputPanel.module.css";
import type { Entry, SessionStatus, CategoryId, CloudSyncWithUpload, MediaItem } from "../../types";

interface NoteOptions {
    contentType?: string;
    fieldValues?: Record<string, unknown>;
    category?: CategoryId;
    tags?: string[];
}

interface InputPanelProps {
    status: SessionStatus;
    onLogIn: (content: string) => void;
    onSwitch: (content: string) => void;
    onNote: (content: string, options?: NoteOptions) => void;
    onLogOff: (content: string) => void;
    cloudSync: CloudSyncWithUpload | null;
    followUpEntry: Entry | null;
    onClearFollowUp?: () => void;
    mediaItems?: MediaItem[];
    onAddMediaItem?: (mediaItem: MediaItem) => void;
}

export interface InputPanelRef {
    focus: () => void;
}

export const InputPanel = forwardRef<InputPanelRef, InputPanelProps>(function InputPanel({
    status,
    onLogIn,
    onSwitch,
    onNote,
    onLogOff,
    cloudSync,
    followUpEntry,
    onClearFollowUp,
    mediaItems = [],
    onAddMediaItem
}, ref) {
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const [textareaHeight, setTextareaHeight] = useState(24);
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [location, setLocation] = useState("");
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    // Metadata state (for FocusMode)
    const [showMetadata, setShowMetadata] = useState(false);
    const [category, setCategory] = useState<CategoryId | null>(null);
    const [contentType, setContentType] = useState<string | null>(null);
    const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
    const [tags, setTags] = useState<string[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const focusInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isStreaming = status === SESSION_STATUS.STREAMING;

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
            setIsFocused(true);
            setMobileExpanded(true);
        }
    }));

    // Focus input when followUpEntry is set
    useEffect(() => {
        if (followUpEntry && inputRef.current) {
            inputRef.current.focus();
            setIsFocused(true);
            setMobileExpanded(true);
        }
    }, [followUpEntry]);

    // Handle mobile keyboard visibility
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleViewportResize = () => {
            const vv = window.visualViewport;
            if (vv && mobileExpanded && vv.height < window.innerHeight * 0.9) {
                setViewportHeight(vv.height);
            } else {
                setViewportHeight(null);
            }
        };

        window.visualViewport.addEventListener("resize", handleViewportResize);
        window.visualViewport.addEventListener("scroll", handleViewportResize);

        return () => {
            window.visualViewport?.removeEventListener("resize", handleViewportResize);
            window.visualViewport?.removeEventListener("scroll", handleViewportResize);
        };
    }, [mobileExpanded]);

    // Handle Esc to exit focus mode
    useEffect(() => {
        const handleEsc = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape" && focusMode) {
                setFocusMode(false);
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [focusMode]);

    // Focus on textarea when entering focus mode
    useEffect(() => {
        if (focusMode && focusInputRef.current) {
            focusInputRef.current.focus();
        }
    }, [focusMode]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            if (!isFocused) {
                inputRef.current.style.height = "24px";
                setTextareaHeight(24);
            } else {
                inputRef.current.style.height = "24px";
                const scrollHeight = inputRef.current.scrollHeight;
                const newHeight = Math.min(Math.max(scrollHeight, 24), 200);
                setTextareaHeight(newHeight);
                inputRef.current.style.height = newHeight + "px";
            }
        }
    }, [input, isFocused]);

    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            setLocation("Location not supported");
            return;
        }
        setIsGettingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                const data = await response.json();
                const address = data.display_name?.split(",").slice(0, 3).join(",") ||
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

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!cloudSync?.isLoggedIn) {
            alert("Please connect to cloud sync first to upload images");
            return;
        }

        try {
            setIsUploading(true);
            const url = await cloudSync.uploadImage(file);
            setImageUrl(url);
            setShowImageInput(false);
        } catch (error) {
            alert(`Upload failed: ${(error as Error).message}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const buildEntryContent = () => {
        let content = input.trim();
        if (location) content += `\n📍 ${location}`;
        if (imageUrl) content += `\n🖼️ ${imageUrl}`;
        return content;
    };

    const handleSubmit = (action: "note" | "logOff" | "switch" | "logIn") => {
        if (!input.trim() && action !== "logOff") return;
        const content = buildEntryContent();

        switch (action) {
            case "logIn": onLogIn(content); break;
            case "switch": onSwitch(content); break;
            case "note": {
                // Pass metadata if manually set
                const options: NoteOptions = {};
                if (contentType) {
                    options.contentType = contentType;
                    // Use fieldValues from state (set by DynamicFieldForm)
                    if (Object.keys(fieldValues).length > 0) {
                        options.fieldValues = fieldValues;
                    }
                }
                if (category) options.category = category;
                if (tags.length > 0) options.tags = tags;
                onNote(content, Object.keys(options).length > 0 ? options : undefined);
                break;
            }
            case "logOff": onLogOff(content); break;
        }

        setInput("");
        setImageUrl("");
        setLocation("");
        setShowImageInput(false);
        setShowLocationInput(false);
        setTextareaHeight(24);
        setIsFocused(false);
        setMobileExpanded(false);
        setFocusMode(false);
        // Reset metadata
        setShowMetadata(false);
        setCategory(null);
        setContentType(null);
        setFieldValues({});
        setTags([]);
        inputRef.current?.blur();

        // Note: Follow-up linking and cleanup is handled by App.jsx's useEffect
        // Do NOT call onClearFollowUp here - it clears pendingLink before the new entry is added
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(isStreaming ? "note" : "logIn");
        } else if (e.key === "Enter" && e.ctrlKey && e.shiftKey && isStreaming) {
            e.preventDefault();
            handleSubmit("switch");
        }
    };

    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                if (!cloudSync?.isLoggedIn) {
                    alert('Please connect to cloud sync to upload images.');
                    return;
                }
                const file = item.getAsFile();
                if (!file) return;
                try {
                    setIsUploading(true);
                    const url = await cloudSync.uploadImage(file);
                    setImageUrl(url);
                    setShowImageInput(false);
                } catch (error) {
                    alert(`Upload failed: ${(error as Error).message}`);
                } finally {
                    setIsUploading(false);
                }
                return;
            }
        }
    };

    const getFollowUpPreview = (content: string | undefined) => {
        if (!content) return "(empty)";
        const firstLine = content.split("\n")[0];
        return firstLine.length > 30 ? firstLine.slice(0, 30) + "..." : firstLine;
    };

    const renderInputForm = (inFocusMode = false) => (
        <div
            className={`${styles.panel} ${isFocused ? styles.focused : ""} ${inFocusMode ? styles.panelFocusMode : ""}`}
            data-input-panel
            data-mobile-expanded={mobileExpanded ? "true" : undefined}
            style={{
                maxWidth: inFocusMode ? 900 : 768,
                ...(viewportHeight && mobileExpanded && !inFocusMode
                    ? {
                        height: viewportHeight,
                        top: window.visualViewport?.offsetTop || 0,
                        bottom: "auto",
                    }
                    : {}),
            }}
        >
            {/* Follow-up indicator */}
            {followUpEntry && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        backgroundColor: "var(--accent-subtle)",
                        borderBottom: "1px solid var(--border-subtle)",
                        fontSize: 11,
                        color: "var(--accent)",
                    }}
                >
                    <Link2 size={12} />
                    <span style={{ fontWeight: 600 }}>FOLLOW UP:</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                        {getFollowUpPreview(followUpEntry.content)}
                    </span>
                    <button
                        onClick={() => onClearFollowUp?.()}
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
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div className="input-area" style={{ display: "flex", flex: 1 }}>
                <div
                    className={`${styles.gutter} ${inFocusMode ? styles.gutterFocusMode : ""}`}
                    onClick={() => {
                        if (mobileExpanded && !inFocusMode) {
                            setMobileExpanded(false);
                            setIsFocused(false);
                            inputRef.current?.blur();
                        }
                    }}
                    style={{ cursor: mobileExpanded && !inFocusMode ? "pointer" : "default" }}
                >
                    <Terminal size={inFocusMode ? 16 : 14} className={styles.terminalIcon} />
                </div>

                <div className={`${styles.editor} ${inFocusMode ? styles.editorFocusMode : ""}`}>
                    <textarea
                        ref={inFocusMode ? focusInputRef : inputRef}
                        className={`${styles.textarea} ${isFocused ? styles.textareaFocused : ""} ${inFocusMode ? styles.textareaFocusMode : ""}`}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => {
                            if (!inFocusMode) {
                                setIsFocused(true);
                                setMobileExpanded(true);
                            }
                        }}
                        onBlur={(e: FocusEvent<HTMLTextAreaElement>) => {
                            if (inFocusMode) return;
                            const panel = e.currentTarget.closest("[data-input-panel]");
                            if (panel && panel.contains(e.relatedTarget as Node)) return;
                            setIsFocused(false);
                        }}
                        placeholder={followUpEntry ? "Add follow-up..." : (isStreaming ? "Add note or switch session..." : "What are you working on?")}
                        rows={1}
                    />
                </div>
            </div>

            <AttachmentPreview
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                location={location}
                setLocation={setLocation}
                showImageInput={showImageInput}
                setShowImageInput={setShowImageInput}
                showLocationInput={showLocationInput}
                setShowLocationInput={setShowLocationInput}
                isUploading={isUploading}
                isGettingLocation={isGettingLocation}
                fileInputRef={fileInputRef}
                cloudSync={cloudSync}
                onImageUpload={handleImageUpload}
                onGetLocation={getCurrentLocation}
            />

            {/* Metadata input (category, type, tags) - only in focus mode */}
            {inFocusMode && (
                <EntryMetadataInput
                    category={category}
                    setCategory={setCategory}
                    contentType={contentType}
                    setContentType={setContentType}
                    fieldValues={fieldValues}
                    setFieldValues={setFieldValues}
                    tags={tags}
                    setTags={setTags}
                    isExpanded={showMetadata}
                    mediaItems={mediaItems}
                    onAddMediaItem={onAddMediaItem}
                />
            )}

            <InputActions
                isStreaming={isStreaming}
                input={input}
                imageUrl={imageUrl}
                location={location}
                showImageInput={showImageInput}
                showLocationInput={showLocationInput}
                showMetadata={showMetadata}
                inFocusMode={inFocusMode}
                onSubmit={handleSubmit}
                onToggleImage={() => setShowImageInput(!showImageInput)}
                onToggleLocation={() => setShowLocationInput(!showLocationInput)}
                onToggleMetadata={() => setShowMetadata(!showMetadata)}
                onOpenFocusMode={() => setFocusMode(true)}
            />

            {/* ContentType is now auto-detected by AI after submission */}
        </div>
    );

    return (
        <>
            <div className={styles.container}>
                <div className={styles.wrapper}>
                    {renderInputForm(false)}
                </div>
            </div>

            <FocusMode isOpen={focusMode} onClose={() => setFocusMode(false)}>
                {renderInputForm(true)}
            </FocusMode>
        </>
    );
});
