import { useState, useRef, useEffect, forwardRef, useImperativeHandle, ChangeEvent, KeyboardEvent, ClipboardEvent, FocusEvent } from "react";
import { Terminal, X, Link2 } from "lucide-react";
import { SESSION_STATUS } from "@/utils/constants";
import { FocusMode } from "./FocusMode";
import { AttachmentPreview } from "./AttachmentPreview";
import { InputActions } from "./InputActions";
import { EntryMetadataInput } from "./EntryMetadataInput";
import styles from "./InputPanel.module.css";
import { useCloudSyncContext } from "@/contexts/CloudSyncContext";
import { useSessionContext } from "@/contexts/SessionContext";
import { prepareContentTypeSubmission } from "@/features/contentTypes";
import { appendAttachmentLines, resolveCurrentLocation } from "@/utils/attachments";
import type { TimelineItem, SessionStatus, CategoryId } from "@/types";

interface NoteOptions {
    timestamp?: number;
    contentType?: string;
    fieldValues?: Record<string, unknown>;
    category?: CategoryId;
    tags?: string[];
}

interface InputPanelProps {
    status: SessionStatus;
    onLogIn: (content: string, options?: NoteOptions) => void;
    onSwitch: (content: string, options?: NoteOptions) => void;
    onNote: (content: string, options?: NoteOptions) => void;
    onLogOff: (content: string, timestamp?: number) => void;
    followUpEntry: TimelineItem | null;
    onClearFollowUp?: () => void;
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
    followUpEntry,
    onClearFollowUp,
}, ref) {
    const cloudSync = useCloudSyncContext();
    const {
        state: { mediaItems, sessions, activeSessionId },
        actions: { addMediaItem: onAddMediaItem, updateMediaItem: onUpdateMediaItem },
    } = useSessionContext();
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [showTimeInput, setShowTimeInput] = useState(false);
    const [customTime, setCustomTime] = useState("");
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
    const activeSession = sessions.find(session => session.id === activeSessionId);

    const toLocalDateTimeValue = (timestamp: number) => {
        const date = new Date(timestamp);
        const offset = date.getTimezoneOffset() * 60_000;
        return new Date(timestamp - offset).toISOString().slice(0, 16);
    };

    const toggleTimeInput = () => {
        if (showTimeInput) {
            setShowTimeInput(false);
            setCustomTime("");
            return;
        }
        setCustomTime(toLocalDateTimeValue(Date.now()));
        setShowTimeInput(true);
    };

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
            } else {
                inputRef.current.style.height = "24px";
                const scrollHeight = inputRef.current.scrollHeight;
                const newHeight = Math.min(Math.max(scrollHeight, 24), 200);
                inputRef.current.style.height = newHeight + "px";
            }
        }
    }, [input, isFocused]);

    const getCurrentLocation = async () => {
        setIsGettingLocation(true);
        setLocation(await resolveCurrentLocation());
        setIsGettingLocation(false);
    };

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!cloudSync.isLoggedIn) {
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

    const buildEntryContent = () => appendAttachmentLines(input, { location, imageUrl });

    const handleSubmit = (action: "note" | "logOff" | "switch" | "logIn") => {
        if (!input.trim() && action !== "logOff") return;
        const content = buildEntryContent();
        const usesCustomTime = showTimeInput && (action === "logIn" || action === "logOff");
        const customTimestamp = usesCustomTime ? new Date(customTime).getTime() : undefined;

        if (
            usesCustomTime
            && (customTimestamp === undefined || !Number.isFinite(customTimestamp) || customTimestamp > Date.now())
        ) {
            alert("Choose a valid time that is not in the future.");
            return;
        }
        if (
            action === "logOff"
            && customTimestamp !== undefined
            && activeSession
            && customTimestamp < activeSession.startAt
        ) {
            alert("Log off time cannot be earlier than the session start.");
            return;
        }

        let normalizedFieldValues = fieldValues
        if (contentType && action !== 'logOff') {
            const target = action === 'note' ? 'note' : 'session'
            const prepared = prepareContentTypeSubmission(contentType, fieldValues, target)
            if (!prepared.ok) {
                alert(prepared.error)
                return
            }
            normalizedFieldValues = prepared.fieldValues
        }

        // Build metadata options for all entry-creating actions
        const options: NoteOptions = {};
        if (contentType) {
            options.contentType = contentType;
            if (Object.keys(normalizedFieldValues).length > 0) {
                options.fieldValues = normalizedFieldValues;
            }
        }
        if (category) options.category = category;
        if (tags.length > 0) options.tags = tags;
        if (action === "logIn" && customTimestamp !== undefined) options.timestamp = customTimestamp;
        const hasOptions = Object.keys(options).length > 0;

        switch (action) {
            case "logIn": onLogIn(content, hasOptions ? options : undefined); break;
            case "switch": onSwitch(content, hasOptions ? options : undefined); break;
            case "note": onNote(content, hasOptions ? options : undefined); break;
            case "logOff": onLogOff(content, customTimestamp); break;
        }

        setInput("");
        setImageUrl("");
        setLocation("");
        setShowImageInput(false);
        setShowLocationInput(false);
        setShowTimeInput(false);
        setCustomTime("");
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
                if (!cloudSync.isLoggedIn) {
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

            {showTimeInput && (
                <div className={styles.timeInputRow}>
                    <label className={styles.timeInputLabel} htmlFor={inFocusMode ? "focus-boundary-time" : "boundary-time"}>
                        {isStreaming ? "LOG OFF AT" : "LOG IN AT"}
                    </label>
                    <input
                        id={inFocusMode ? "focus-boundary-time" : "boundary-time"}
                        className={styles.timeInput}
                        type="datetime-local"
                        value={customTime}
                        min={isStreaming && activeSession ? toLocalDateTimeValue(activeSession.startAt) : undefined}
                        max={toLocalDateTimeValue(Date.now())}
                        onChange={(event) => setCustomTime(event.target.value)}
                    />
                    <button
                        type="button"
                        className={styles.timeNowButton}
                        onClick={() => setCustomTime(toLocalDateTimeValue(Date.now()))}
                    >
                        NOW
                    </button>
                    <button
                        type="button"
                        className="input-panel-close-btn"
                        onClick={toggleTimeInput}
                        aria-label="Use current time"
                        title="Use current time"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Metadata input (category, type, tags) */}
            {(inFocusMode || (mobileExpanded && isFocused)) && (
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
                    onUpdateMediaItem={onUpdateMediaItem}
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
                showTimeInput={showTimeInput}
                inFocusMode={inFocusMode}
                onSubmit={handleSubmit}
                onToggleImage={() => setShowImageInput(!showImageInput)}
                onToggleLocation={() => setShowLocationInput(!showLocationInput)}
                onToggleMetadata={() => setShowMetadata(!showMetadata)}
                onToggleTime={toggleTimeInput}
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
