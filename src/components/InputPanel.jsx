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
  X,
} from "lucide-react";
import { SESSION_STATUS } from "../utils/constants";

// Focus Mode (Zen) Component
function FocusMode({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="focus-mode-overlay" onMouseDown={handleBackdropClick}>
      <div className="focus-mode-content">
        <div className="focus-mode-inner" onMouseDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function InputPanel({ status, onLogIn, onSwitch, onNote, onLogOff }) {
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
      className={`input-panel ${isFocused ? "focused" : ""} ${inFocusMode ? "focus-mode" : ""}`}
      data-input-panel
      data-mobile-expanded={mobileExpanded ? "true" : undefined}
      style={{ maxWidth: inFocusMode ? 900 : 768 }}
    >
      {/* Input Area */}
      <div className="input-area" style={{ display: "flex", flex: 1 }}>
        {/* Gutter */}
        <div className={`input-panel-gutter ${inFocusMode ? "focus-mode" : ""}`}>
          {/* Mobile close button */}
          <button
            className="mobile-close-btn"
            onClick={() => {
              setMobileExpanded(false);
              setIsFocused(false);
              inputRef.current?.blur();
            }}
          >
            <X size={20} />
          </button>
          <Terminal
            size={inFocusMode ? 16 : 14}
            className="terminal-icon"
          />
        </div>

        {/* Editor */}
        <div className={`input-panel-editor ${inFocusMode ? "focus-mode" : ""}`}>
          <textarea
            ref={inFocusMode ? focusInputRef : inputRef}
            className={`input-panel-textarea ${isFocused ? "focused" : ""} ${inFocusMode ? "focus-mode" : ""}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (!inFocusMode) {
                setIsFocused(true);
                setMobileExpanded(true);
              }
            }}
            onBlur={(e) => {
              if (inFocusMode) return;
              const panel = e.currentTarget.closest("[data-input-panel]");
              if (panel && panel.contains(e.relatedTarget)) {
                return;
              }
              setIsFocused(false);
            }}
            placeholder={
              isStreaming
                ? "Add note or switch session..."
                : "What are you working on?"
            }
            rows={1}
          />
        </div>
      </div>

      {/* Attachments Preview */}
      {(imageUrl || location || showImageInput || showLocationInput) && (
        <div className="input-panel-attachments">
          {/* Image URL Input */}
          {showImageInput && (
            <div className="input-panel-attachment-row">
              <Image size={14} style={{ color: "var(--text-dim)" }} />
              <input
                type="text"
                className="input-panel-attachment-input"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
              />
              <button
                className="input-panel-close-btn"
                onClick={() => {
                  setShowImageInput(false);
                  setImageUrl("");
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
            <div className="input-panel-attachment-row">
              <MapPin size={14} style={{ color: "var(--text-dim)" }} />
              <input
                type="text"
                className="input-panel-attachment-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location..."
              />
              <button
                className="btn-action btn-action-secondary"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                style={{ padding: "4px 8px", fontSize: 10 }}
              >
                {isGettingLocation ? "..." : "AUTO"}
              </button>
              <button
                className="input-panel-close-btn"
                onClick={() => {
                  setShowLocationInput(false);
                  setLocation("");
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Location Preview */}
          {location && !showLocationInput && (
            <div className="input-panel-attachment-row">
              <MapPin size={12} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>
                {location}
              </span>
              <button
                className="input-panel-close-btn"
                onClick={() => setLocation("")}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Bar */}
      <div className="input-panel-bottom">
        <div className="flex items-center gap-2">
          {/* Status */}
          <div className="input-panel-status">
            <span className={`input-panel-status-dot ${isStreaming ? "active" : ""}`} />
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
              className="icon-btn hide-mobile"
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
      <div className="input-panel-container">
        <div className="input-panel-wrapper">
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
