/**
 * DynamicFieldForm - Renders form fields based on ContentType schema
 * Minimal version: only handles dropdown and number fields
 */
export function DynamicFieldForm({ contentType, fieldValues, onChange }) {
    if (!contentType || !contentType.fields || contentType.fields.length === 0) {
        return null;
    }

    const handleFieldChange = (fieldId, value) => {
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
            {contentType.fields.map((field) => {
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
                                value={value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
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
                                value={value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value ? Number(e.target.value) : '')}
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
                                value={value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
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
                    </div>
                );
            })}
        </div>
    );
}
