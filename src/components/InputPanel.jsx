import { useState, useRef, useEffect } from "react";
import {
    StickyNote,
    Square,
    Play,
    ArrowRightLeft,
    Image,
    MapPin,
    Maximize2,
    Terminal,
} from "lucide-react";
import { SESSION_STATUS } from "../utils/constants";

// Focus Mode (Zen) Component - click outside to close
function FocusMode({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            onMouseDown={handleBackdropClick}
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "var(--bg-primary)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
                cursor: "default",
            }}
        >
            <div
                style={{
                    maxWidth: 900,
                    width: "100%",
                    pointerEvents: "none",
                }}
            >
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ pointerEvents: "auto" }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

export function InputPanel({ status, onLogIn, onSwitch, onNote, onLogOff }) {
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [textareaHeight, setTextareaHeight] = useState(24);
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [location, setLocation] = useState("");
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const inputRef = useRef(null);
    const focusInputRef = useRef(null);
    const isStreaming = status === SESSION_STATUS.STREAMING;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Handle Esc to exit focus mode
    useEffect(() => {
        const handleEsc = (e) => {
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

    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            setLocation("Location not supported");
            return;
        }
        setIsGettingLocation(true);
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                });
            });
            const { latitude, longitude } = position.coords;
            // Try to get address from coordinates using reverse geocoding
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
        } catch (error) {
            setLocation("Unable to get location");
        }
        setIsGettingLocation(false);
    };

    const buildEntryContent = () => {
        let content = input.trim();
        if (location) {
            content += `\n📍 ${location}`;
        }
        if (imageUrl) {
            content += `\n🖼️ ${imageUrl}`;
        }
        return content;
    };

    const handleSubmit = (action) => {
        if (!input.trim() && action !== "logOff") return;
        const content = buildEntryContent();
        switch (action) {
            case "logIn":
                onLogIn(content);
                break;
            case "switch":
                onSwitch(content);
                break;
            case "note":
                onNote(content);
                break;
            case "logOff":
                onLogOff(content);
                break;
        }
        setInput("");
        setImageUrl("");
        setLocation("");
        setShowImageInput(false);
        setShowLocationInput(false);
        setTextareaHeight(24);
        setIsFocused(false);
        setFocusMode(false);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            handleSubmit("note");
        } else if (e.key === "Enter" && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(isStreaming ? "switch" : "logIn");
        } else if (e.key === "Enter" && e.ctrlKey && e.shiftKey && isStreaming) {
            e.preventDefault();
            handleSubmit("logOff");
        }
    };

    useEffect(() => {
        if (inputRef.current) {
            if (!isFocused) {
                // When not focused, force height to collapsed state
                inputRef.current.style.height = "24px";
                setTextareaHeight(24);
            } else {
                // When focused, auto-expand based on content
                inputRef.current.style.height = "24px";
                const scrollHeight = inputRef.current.scrollHeight;
                const newHeight = Math.min(Math.max(scrollHeight, 24), 200);
                setTextareaHeight(newHeight);
                inputRef.current.style.height = newHeight + "px";
            }
        }
    }, [input, isFocused]);

    // Render the input form (used both in normal and focus mode)
    const renderInputForm = (inFocusMode = false) => (
        <div
            data-input-panel
            style={{
                width: "100%",
                maxWidth: inFocusMode ? 900 : 768,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-light)",
                borderRadius: 4,
                boxShadow: inFocusMode
                    ? "0 0 80px rgba(0,0,0,0.3)"
                    : isFocused
                        ? "0 0 30px rgba(0,0,0,0.2)"
                        : "0 25px 50px -12px rgba(0,0,0,0.25)",
                overflow: "hidden",
                transition: "all 350ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
        >
            {/* Input Area */}
            <div
                className="flex items-stretch"
                style={{ backgroundColor: "var(--bg-primary)" }}
            >
                {/* Gutter */}
                <div
                    style={{
                        flexShrink: 0,
                        width: 48,
                        paddingTop: inFocusMode ? 24 : 12,
                        paddingRight: 12,
                        textAlign: "right",
                        borderRight: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-secondary)",
                        userSelect: "none",
                    }}
                >
                    <Terminal
                        size={inFocusMode ? 16 : 14}
                        style={{ color: "var(--accent)" }}
                    />
                </div>

                {/* Editor */}
                <div
                    style={{
                        flex: 1,
                        padding: inFocusMode
                            ? "24px 16px 24px 16px"
                            : "12px 12px 12px 12px",
                    }}
                >
                    <textarea
                        ref={inFocusMode ? focusInputRef : inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => !inFocusMode && setIsFocused(true)}
                        onBlur={(e) => {
                            if (inFocusMode) return;
                            // Check if focus is moving to something inside the panel
                            const panel = e.currentTarget.closest("[data-input-panel]");
                            if (panel && panel.contains(e.relatedTarget)) {
                                return; // Focus is still in panel, don't collapse
                            }
                            setIsFocused(false);
                        }}
                        placeholder={
                            isStreaming
                                ? "Add note or switch session..."
                                : "What are you working on?"
                        }
                        rows={1}
                        style={{
                            display: "block",
                            width: "100%",
                            backgroundColor: "transparent",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-mono)",
                            fontSize: inFocusMode ? 16 : 15,
                            resize: "none",
                            border: "none",
                            outline: "none",
                            lineHeight: 1.6,
                            overflowY: "auto",
                            minHeight: inFocusMode ? 400 : isFocused ? 64 : 24,
                            maxHeight: inFocusMode ? 600 : 200,
                            transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                            verticalAlign: "top",
                        }}
                    />
                </div>
            </div>

            {/* Attachments Preview */}
            {(imageUrl || location || showImageInput || showLocationInput) && (
                <div
                    style={{
                        padding: "8px 16px",
                        borderTop: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-secondary)",
                    }}
                >
                    {/* Image URL Input */}
                    {showImageInput && (
                        <div className="flex items-center gap-2 mb-2">
                            <Image
                                size={14}
                                style={{ color: "var(--text-dim)", flexShrink: 0 }}
                            />
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="Paste image URL..."
                                style={{
                                    flex: 1,
                                    height: 28,
                                    padding: "0 8px",
                                    fontSize: 12,
                                    backgroundColor: "var(--bg-tertiary)",
                                    color: "var(--text-primary)",
                                    border: "none",
                                    borderRadius: 4,
                                    outline: "none",
                                }}
                            />
                            <button
                                onClick={() => {
                                    setShowImageInput(false);
                                    setImageUrl("");
                                }}
                                style={{
                                    color: "var(--text-dim)",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 16,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Image Preview */}
                    {imageUrl && !showImageInput && (
                        <div className="flex items-center gap-2 mb-2">
                            <img
                                src={imageUrl}
                                alt="preview"
                                style={{ height: 40, borderRadius: 4, objectFit: "cover" }}
                                onError={(e) => (e.target.style.display = "none")}
                            />
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-dim)",
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {imageUrl}
                            </span>
                            <button
                                onClick={() => setImageUrl("")}
                                style={{
                                    color: "var(--text-dim)",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 14,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Location Input */}
                    {showLocationInput && (
                        <div className="flex items-center gap-2">
                            <MapPin
                                size={14}
                                style={{ color: "var(--text-dim)", flexShrink: 0 }}
                            />
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Enter location..."
                                style={{
                                    flex: 1,
                                    height: 28,
                                    padding: "0 8px",
                                    fontSize: 12,
                                    backgroundColor: "var(--bg-tertiary)",
                                    color: "var(--text-primary)",
                                    border: "none",
                                    borderRadius: 4,
                                    outline: "none",
                                }}
                            />
                            <button
                                onClick={getCurrentLocation}
                                disabled={isGettingLocation}
                                style={{
                                    padding: "4px 8px",
                                    fontSize: 10,
                                    backgroundColor: "var(--accent-subtle)",
                                    color: "var(--accent)",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                }}
                            >
                                {isGettingLocation ? "..." : "AUTO"}
                            </button>
                            <button
                                onClick={() => {
                                    setShowLocationInput(false);
                                    setLocation("");
                                }}
                                style={{
                                    color: "var(--text-dim)",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 16,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Location Preview */}
                    {location && !showLocationInput && (
                        <div className="flex items-center gap-2">
                            <MapPin size={12} style={{ color: "var(--accent)" }} />
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-secondary)",
                                    flex: 1,
                                }}
                            >
                                {location}
                            </span>
                            <button
                                onClick={() => setLocation("")}
                                style={{
                                    color: "var(--text-dim)",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 14,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Bar */}
            <div
                className="flex-between"
                style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-secondary)",
                }}
            >
                <div className="flex items-center gap-2">
                    {/* Status */}
                    <div
                        className="flex items-center gap-2"
                        style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                            marginRight: 8,
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: isStreaming
                                    ? "var(--success)"
                                    : "var(--text-dim)",
                            }}
                        />
                        <span className="uppercase tracking-wider hide-mobile">
                            {isStreaming ? "SESSION ACTIVE" : "READY"}
                        </span>
                    </div>

                    {/* Attachment buttons */}
                    <button
                        onClick={() => setShowImageInput(!showImageInput)}
                        title="Add image URL"
                        className={`icon-btn ${showImageInput || imageUrl ? "active" : ""}`}
                    >
                        <Image size={14} />
                    </button>
                    <button
                        onClick={() => setShowLocationInput(!showLocationInput)}
                        title="Add location"
                        className={`icon-btn ${showLocationInput || location ? "active" : ""}`}
                    >
                        <MapPin size={14} />
                    </button>
                    {!inFocusMode && (
                        <button
                            onClick={() => setFocusMode(true)}
                            title="Focus mode (Zen)"
                            className="icon-btn"
                        >
                            <Maximize2 size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Note button */}
                    <button
                        className="btn-action btn-action-secondary"
                        onClick={() => handleSubmit("note")}
                        disabled={!input.trim()}
                    >
                        <StickyNote size={12} /> NOTE
                    </button>

                    {/* Log Off button */}
                    {isStreaming && (
                        <button
                            className="btn-action btn-action-danger"
                            onClick={() => handleSubmit("logOff")}
                        >
                            <Square size={12} /> LOG OFF
                        </button>
                    )}

                    {/* Primary action button */}
                    <button
                        className="btn-action btn-action-primary"
                        onClick={() => handleSubmit(isStreaming ? "switch" : "logIn")}
                        disabled={!input.trim()}
                    >
                        {isStreaming ? (
                            <>
                                <ArrowRightLeft size={12} /> SWITCH
                            </>
                        ) : (
                            <>
                                <Play size={12} /> LOG IN
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Normal input panel */}
            <div
                className="fixed z-300"
                style={{
                    bottom: 24,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    padding: "0 16px",
                    pointerEvents: "none",
                }}
            >
                <div style={{ width: "100%", maxWidth: 768, pointerEvents: "auto" }}>
                    {renderInputForm(false)}
                </div>
            </div>

            {/* Focus Mode */}
            <FocusMode isOpen={focusMode} onClose={() => setFocusMode(false)}>
                {renderInputForm(true)}
            </FocusMode>
        </>
    );
}
