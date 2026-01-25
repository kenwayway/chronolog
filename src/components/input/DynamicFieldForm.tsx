import { ChangeEvent, useEffect } from "react";
import type { ContentType, FieldDefinition, MediaItem } from "../../types";
import { MediaSelector } from "./MediaSelector";

interface DynamicFieldFormProps {
    contentType: ContentType | null;
    fieldValues: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    mediaItems?: MediaItem[];
    onAddMediaItem?: (mediaItem: MediaItem) => void;
}

/**
 * DynamicFieldForm - Renders form fields based on ContentType schema
 * Handles dropdown, number, text, and media-select fields
 */
export function DynamicFieldForm({ contentType, fieldValues, onChange, mediaItems = [], onAddMediaItem }: DynamicFieldFormProps) {
    // Auto-populate missing defaults when contentType changes
    useEffect(() => {
        if (!contentType || !contentType.fields) return;

        const missingDefaults: Record<string, unknown> = {};
        let hasMissing = false;

        for (const field of contentType.fields) {
            if (field.default !== undefined && fieldValues[field.id] === undefined) {
                missingDefaults[field.id] = field.default;
                hasMissing = true;
            }
        }

        if (hasMissing) {
            onChange({ ...fieldValues, ...missingDefaults });
        }
    }, [contentType?.id]); // Only run when contentType changes

    if (!contentType || !contentType.fields || contentType.fields.length === 0) {
        return null;
    }

    const handleFieldChange = (fieldId: string, value: unknown) => {
        onChange({
            ...fieldValues,
            [fieldId]: value
        });
    };

    return (
        <div
            className="dynamic-field-form"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: "8px 12px",
                borderTop: "1px solid var(--border-subtle)",
            }}
        >
            {contentType.fields.map((field: FieldDefinition) => {
                // Skip boolean fields (like 'done' for tasks - handled elsewhere)
                if (field.type === 'boolean') return null;

                const value = fieldValues?.[field.id] ?? field.default ?? '';

                return (
                    <div
                        key={field.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <label
                            style={{
                                fontSize: 11,
                                color: "var(--text-dim)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {field.name}:
                        </label>

                        {field.type === 'dropdown' && (
                            <select
                                value={value as string}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => handleFieldChange(field.id, e.target.value)}
                                style={{
                                    padding: "4px 8px",
                                    fontSize: 12,
                                    fontFamily: "var(--font-mono)",
                                    backgroundColor: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                }}
                            >
                                <option value="">--</option>
                                {field.options?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        )}

                        {field.type === 'number' && (
                            <input
                                type="number"
                                value={value as number | string}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.value ? Number(e.target.value) : '')}
                                placeholder="0"
                                style={{
                                    width: 80,
                                    padding: "4px 8px",
                                    fontSize: 12,
                                    fontFamily: "var(--font-mono)",
                                    backgroundColor: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: 4,
                                }}
                            />
                        )}

                        {field.type === 'text' && (
                            <input
                                type="text"
                                value={value as string}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.value)}
                                style={{
                                    width: 120,
                                    padding: "4px 8px",
                                    fontSize: 12,
                                    fontFamily: "var(--font-mono)",
                                    backgroundColor: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: 4,
                                }}
                            />
                        )}

                        {field.type === 'media-select' && onAddMediaItem && (
                            <MediaSelector
                                mediaItems={mediaItems}
                                selectedMediaId={value as string | undefined}
                                onChange={(mediaId) => handleFieldChange(field.id, mediaId)}
                                onAddMediaItem={onAddMediaItem}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
