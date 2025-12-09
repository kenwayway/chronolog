import { Image, MapPin } from "lucide-react";

export function AttachmentPreview({
    imageUrl,
    setImageUrl,
    location,
    setLocation,
    showImageInput,
    setShowImageInput,
    showLocationInput,
    setShowLocationInput,
    isUploading,
    isGettingLocation,
    fileInputRef,
    cloudSync,
    onImageUpload,
    onGetLocation,
}) {
    if (!imageUrl && !location && !showImageInput && !showLocationInput) {
        return null;
    }

    return (
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
                        className="input-panel-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || !cloudSync?.isLoggedIn}
                        title={cloudSync?.isLoggedIn ? "Upload image" : "Connect to cloud to upload"}
                        style={{
                            padding: "4px 8px",
                            fontSize: 10,
                            backgroundColor: cloudSync?.isLoggedIn ? "var(--accent-subtle)" : "var(--bg-tertiary)",
                            color: cloudSync?.isLoggedIn ? "var(--accent)" : "var(--text-dim)",
                            border: "none",
                            borderRadius: 4,
                            cursor: cloudSync?.isLoggedIn ? "pointer" : "not-allowed",
                            opacity: isUploading ? 0.5 : 1,
                        }}
                    >
                        {isUploading ? "..." : "UPLOAD"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={onImageUpload}
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
                        onClick={onGetLocation}
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
    );
}
