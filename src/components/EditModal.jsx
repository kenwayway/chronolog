import { useState, useRef, useEffect } from "react";
import { Image, MapPin } from "lucide-react";

export function EditModal({ isOpen, entry, onSave, onClose, categories }) {
  const [content, setContent] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [category, setCategory] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [location, setLocation] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const textareaRef = useRef(null);

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
      const position = await new Promise((resolve, reject) => {
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
    } catch (error) {
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
    onSave(entry.id, {
      content: newContent !== entry.content ? newContent : undefined,
      timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
      category: category !== entry.category ? category : undefined,
    });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "Enter" && e.ctrlKey) handleSave();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const selectedCategory = categories?.find((c) => c.id === category);

  return (
    <div
      onMouseDown={handleBackdropClick}
      onKeyDown={handleKeyDown}
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
          style={{
            pointerEvents: "auto",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-light)",
            borderRadius: 4,
            boxShadow: "0 0 80px rgba(0,0,0,0.3)",
            overflow: "hidden",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {/* Header */}
          <div
            className="flex-between"
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
              userSelect: "none",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              EDIT ENTRY
            </span>
            <button
              onClick={onClose}
              className="edit-modal-close"
              style={{ fontSize: 20 }}
            >
              ×
            </button>
          </div>

          {/* Main Content */}
          <div style={{ padding: 20 }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content..."
              style={{
                width: "100%",
                minHeight: 300,
                padding: 16,
                fontSize: 15,
                fontFamily: "monospace",
                lineHeight: 1.6,
                color: "var(--text-primary)",
                backgroundColor: "transparent",
                border: "none",
                resize: "none",
                outline: "none",
              }}
            />
          </div>

          {/* Attachments */}
          {(imageUrl || location || showImageInput || showLocationInput) && (
            <div
              style={{
                padding: "8px 20px",
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
                    className="edit-modal-input"
                    style={{ flex: 1, height: 28, fontSize: 12 }}
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
                    className="edit-modal-input"
                    style={{ flex: 1, height: 28, fontSize: 12 }}
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
            </div>
          )}

          {/* Footer */}
          <div
            className="flex-between"
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="flex items-center gap-4">
              {/* Time */}
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    userSelect: "none",
                  }}
                >
                  TIME
                </span>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="edit-modal-input"
                  style={{ width: 180 }}
                />
              </div>

              {/* Category */}
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    userSelect: "none",
                  }}
                >
                  CATEGORY
                </span>
                <select
                  value={category || ""}
                  onChange={(e) => setCategory(e.target.value || null)}
                  className="edit-modal-select"
                  style={{
                    width: 120,
                    color: selectedCategory
                      ? selectedCategory.color
                      : "var(--text-secondary)",
                  }}
                >
                  <option value="">None</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
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
            </div>

            <div className="flex items-center gap-3">
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  userSelect: "none",
                }}
              >
                Ctrl+Enter to save
              </span>
              <button onClick={handleSave} className="edit-modal-btn-save">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
