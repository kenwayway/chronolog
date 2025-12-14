import { BUILTIN_CONTENT_TYPES } from "../../utils/constants";
import type { ContentType } from "../../types";

interface ContentTypeSelectorProps {
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    contentTypes?: ContentType[];
}

export function ContentTypeSelector({ value, onChange, contentTypes }: ContentTypeSelectorProps) {
    // Use provided contentTypes or fall back to built-in
    const types = contentTypes || BUILTIN_CONTENT_TYPES;

    return (
        <div
            className="content-type-selector"
            style={{
                display: "flex",
                gap: 4,
                padding: "8px 12px",
                borderTop: "1px solid var(--border-subtle)",
            }}
        >
            {types.map((type) => {
                const isSelected = value === type.id;
                return (
                    <button
                        key={type.id}
                        type="button"
                        onClick={() => onChange(isSelected ? undefined : type.id)}
                        title={type.name}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                            backgroundColor: isSelected ? "var(--accent-subtle)" : "transparent",
                            color: isSelected ? "var(--accent)" : "var(--text-muted)",
                            border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                            borderRadius: 4,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                        }}
                    >
                        <span>{type.icon}</span>
                        <span className="content-type-label">{type.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
