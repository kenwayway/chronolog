import { useMemo, ReactNode } from "react";
import { MapPin } from "lucide-react";
import { parseContent } from "../../utils/contentParser";

interface ContentRendererProps {
    content: string;
    onImageClick?: (src: string) => void;
}

/**
 * Renders parsed content with proper markdown elements
 */
export function ContentRenderer({ content, onImageClick }: ContentRendererProps): ReactNode {
    const parsed = useMemo(() => parseContent(content), [content]);

    return parsed.map((item: any, idx: number) => {
        switch (item.type) {
            case 'codeblock':
                return (
                    <pre key={item.key} className="md-code-block">
                        <code>{item.content as string}</code>
                    </pre>
                );

            case 'image':
                return (
                    <div key={item.key} className="timeline-image-container">
                        <img
                            src={item.content as string}
                            alt="attached"
                            className="timeline-image"
                            style={{ cursor: onImageClick ? 'zoom-in' : 'default' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onImageClick?.(item.content as string);
                            }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = "inline";
                            }}
                        />
                        <a
                            href={item.content as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timeline-image-fallback"
                        >
                            {item.content as string}
                        </a>
                    </div>
                );

            case 'location':
                return (
                    <div
                        key={item.key}
                        style={{
                            marginTop: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <MapPin size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {item.content as string}
                        </span>
                    </div>
                );

            case 'blockquote':
                return (
                    <blockquote key={item.key} className="md-blockquote">
                        {item.content as string}
                    </blockquote>
                );

            case 'heading': {
                const { level, text } = item.content as { level: number; text: string };
                if (level === 1) {
                    return (
                        <div key={item.key} className="md-h1">
                            <span className="md-h1-deco">═══</span>
                            {text}
                            <span className="md-h1-deco">═══</span>
                        </div>
                    );
                }
                if (level === 2) {
                    return (
                        <div key={item.key} className="md-h2">
                            <span className="md-h2-prefix">»</span>
                            {text}
                        </div>
                    );
                }
                return (
                    <div key={item.key} className="md-h3">
                        <span className="md-h3-prefix">›</span>
                        {text}
                    </div>
                );
            }

            case 'text':
            default:
                return (
                    <span key={item.key}>
                        {item.content as string}
                        {idx < parsed.length - 1 && parsed[idx + 1]?.type === 'text' ? "\n" : ""}
                    </span>
                );
        }
    });
}
