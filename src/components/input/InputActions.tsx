import {
    StickyNote,
    Square,
    Play,
    ArrowRightLeft,
    Image,
    MapPin,
    Maximize2,
    Plus,
} from "lucide-react";

interface InputActionsProps {
    isStreaming: boolean;
    input: string;
    imageUrl: string;
    location: string;
    showImageInput: boolean;
    showLocationInput: boolean;
    showMetadata: boolean;
    inFocusMode: boolean;
    onSubmit: (action: "note" | "logOff" | "switch" | "logIn") => void;
    onToggleImage: () => void;
    onToggleLocation: () => void;
    onToggleMetadata: () => void;
    onOpenFocusMode: () => void;
}

export function InputActions({
    isStreaming,
    input,
    imageUrl,
    location,
    showImageInput,
    showLocationInput,
    showMetadata,
    inFocusMode,
    onSubmit,
    onToggleImage,
    onToggleLocation,
    onToggleMetadata,
    onOpenFocusMode,
}: InputActionsProps) {
    return (
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
                    onClick={onToggleImage}
                    title="Add image URL"
                    className={`icon-btn ${showImageInput || imageUrl ? "active" : ""}`}
                >
                    <Image size={14} />
                </button>
                <button
                    onClick={onToggleLocation}
                    title="Add location"
                    className={`icon-btn ${showLocationInput || location ? "active" : ""}`}
                >
                    <MapPin size={14} />
                </button>
                {/* Metadata button (only in focus mode) */}
                {inFocusMode && (
                    <button
                        onClick={onToggleMetadata}
                        title="Add category, type, tags"
                        className={`icon-btn ${showMetadata ? "active" : ""}`}
                    >
                        <Plus size={14} />
                    </button>
                )}
                {!inFocusMode && (
                    <button
                        onClick={onOpenFocusMode}
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
                    onClick={() => onSubmit("note")}
                    disabled={!input.trim()}
                >
                    <StickyNote size={12} /> NOTE
                </button>

                {/* Log Off button */}
                {isStreaming && (
                    <button
                        className="btn-action btn-action-danger"
                        onClick={() => onSubmit("logOff")}
                    >
                        <Square size={12} /> LOG OFF
                    </button>
                )}

                {/* Primary action button */}
                <button
                    className="btn-action btn-action-primary"
                    onClick={() => onSubmit(isStreaming ? "switch" : "logIn")}
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
    );
}
