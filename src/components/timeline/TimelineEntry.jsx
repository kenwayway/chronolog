import { useState } from "react";
import { MapPin } from "lucide-react";
import { ENTRY_TYPES } from "../../utils/constants";
import { formatTime, formatDuration, formatDate } from "../../utils/formatters";
import { useTheme } from "../../hooks/useTheme.jsx";

export function TimelineEntry({
  entry,
  isFirst,
  isLast,
  sessionDuration,
  categories,
  onContextMenu,
  lineState,
  isLightMode,
  showDate = false,
}) {
  const { symbols } = useTheme();
  const [pressTimer, setPressTimer] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    onContextMenu?.(entry, { x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e) => {
    e.currentTarget.style.userSelect = 'none';
    e.currentTarget.style.webkitUserSelect = 'none';

    const timer = setTimeout(() => {
      const touch = e.touches[0];
      onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY });
    }, 500);
    setPressTimer(timer);
  };

  const handleTouchEnd = (e) => {
    e.currentTarget.style.userSelect = '';
    e.currentTarget.style.webkitUserSelect = '';

    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const getEntrySymbol = () => {
    const styles = { fontSize: 14 };

    // Special symbol for beans category
    if (entry.category === 'beans') {
      return (
        <span style={{ ...styles, color: '#ff9e64' }}>
          {symbols.beans}
        </span>
      );
    }

    switch (entry.type) {
      case ENTRY_TYPES.SESSION_START:
        return (
          <span
            style={{
              ...styles,
              color: "var(--success)",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {symbols.sessionStart}
          </span>
        );
      case ENTRY_TYPES.SESSION_END:
        return <span style={{ ...styles, color: "var(--text-muted)" }}>{symbols.sessionEnd}</span>;
      case ENTRY_TYPES.NOTE:
        return (
          <span style={{ ...styles, color: "var(--text-dim)" }}>
            {symbols.note}
          </span>
        );
      case ENTRY_TYPES.TASK:
        return (
          <span style={{ ...styles, color: "var(--warning)" }}>
            {symbols.todo}
          </span>
        );
      case ENTRY_TYPES.TASK_DONE:
        return (
          <span style={{ ...styles, color: "var(--success)", fontWeight: 700 }}>
            {symbols.done}
          </span>
        );
      default:
        return <span style={{ ...styles, color: "var(--text-dim)" }}>{symbols.note}</span>;
    }
  };

  // Darken color for light mode visibility
  const darkenColor = (hex, percent) => {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - Math.round((255 * percent) / 100));
    const g = Math.max(
      0,
      ((num >> 8) & 0xff) - Math.round((255 * percent) / 100),
    );
    const b = Math.max(0, (num & 0xff) - Math.round((255 * percent) / 100));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  const category = categories?.find((c) => c.id === entry.category);
  const categoryTextColor = category
    ? isLightMode
      ? darkenColor(category.color, 10)
      : category.color
    : null;
  const isSessionStart = entry.type === ENTRY_TYPES.SESSION_START;
  const isSessionEnd = entry.type === ENTRY_TYPES.SESSION_END;
  const isTaskDone = entry.type === ENTRY_TYPES.TASK_DONE;
  const isTask = entry.type === ENTRY_TYPES.TASK;

  // Parse inline markdown: **bold**, `code`, ==highlight==, URLs
  const parseInlineMarkdown = (text, keyPrefix = '') => {
    if (!text) return null;

    // Combined regex for all inline patterns
    const inlineRegex = /(\*\*[^*]+\*\*|`[^`]+`|==[^=]+=\s*=|https?:\/\/[^\s]+)/g;
    const parts = text.split(inlineRegex);

    return parts.map((part, i) => {
      const key = `${keyPrefix}-${i}`;

      // Bold: **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key} className="md-bold">{part.slice(2, -2)}</strong>;
      }

      // Inline code: `code`
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={key} className="md-inline-code">{part.slice(1, -1)}</code>;
      }

      // Highlight: ==text==
      if (part.startsWith('==') && part.endsWith('==')) {
        return <mark key={key} className="md-highlight">{part.slice(2, -2)}</mark>;
      }

      // URL
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={key}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", wordBreak: "break-all" }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      return part;
    });
  };

  const linkifyContent = (text) => {
    if (!text) return null;

    const lines = text.split("\n");
    const result = [];
    let inCodeBlock = false;
    let codeBlockLines = [];
    let codeBlockLang = '';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      // Code block start/end: ```
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.slice(3).trim();
          codeBlockLines = [];
        } else {
          // End code block
          result.push(
            <pre key={`code-${lineIdx}`} className="md-code-block">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          );
          inCodeBlock = false;
          codeBlockLines = [];
          codeBlockLang = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Image line
      if (line.startsWith("🖼️ ")) {
        const imageUrl = line.replace("🖼️ ", "").trim();
        result.push(
          <div key={lineIdx} className="timeline-image-container">
            <img
              src={imageUrl}
              alt="attached"
              className="timeline-image"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "inline";
              }}
            />
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="timeline-image-fallback"
            >
              {imageUrl}
            </a>
          </div>
        );
        continue;
      }

      // Location line
      if (line.startsWith("📍 ")) {
        result.push(
          <div
            key={lineIdx}
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MapPin
              size={12}
              style={{ color: "var(--accent)", flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {line.replace("📍 ", "")}
            </span>
          </div>
        );
        continue;
      }

      // Blockquote: > text
      if (line.startsWith("> ")) {
        result.push(
          <blockquote key={lineIdx} className="md-blockquote">
            {parseInlineMarkdown(line.slice(2), lineIdx)}
          </blockquote>
        );
        continue;
      }

      // Headings: # ## ### (CLI aesthetic, same font size)
      if (line.startsWith('### ')) {
        result.push(
          <div key={lineIdx} className="md-h3">
            <span className="md-h3-prefix">›</span>
            {parseInlineMarkdown(line.slice(4), lineIdx)}
          </div>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        result.push(
          <div key={lineIdx} className="md-h2">
            <span className="md-h2-prefix">»</span>
            {parseInlineMarkdown(line.slice(3), lineIdx)}
          </div>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        result.push(
          <div key={lineIdx} className="md-h1">
            <span className="md-h1-deco">═══</span>
            {parseInlineMarkdown(line.slice(2), lineIdx)}
            <span className="md-h1-deco">═══</span>
          </div>
        );
        continue;
      }

      // Regular line with inline markdown
      result.push(
        <span key={lineIdx}>
          {parseInlineMarkdown(line, lineIdx)}
          {lineIdx < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    // Handle unclosed code block
    if (inCodeBlock && codeBlockLines.length > 0) {
      result.push(
        <pre key="code-unclosed" className="md-code-block">
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      );
    }

    return result;
  };

  const getLineColor = (position) => {
    if (position === "top") {
      return lineState === "start" || lineState === "default"
        ? "var(--border-light)"
        : "var(--accent)";
    }
    return lineState === "end" || lineState === "default"
      ? "var(--border-light)"
      : "var(--accent)";
  };

  const getContentColor = () => {
    if (isSessionStart) return "var(--text-primary)";
    if (isSessionEnd) return "var(--text-muted)";
    if (isTask) return "var(--warning)";
    if (isTaskDone) return "var(--text-muted)";
    return "var(--text-secondary)";
  };

  return (
    <div
      className={`timeline-entry ${isTaskDone ? 'timeline-entry-done' : ''}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        cursor: "default",
        userSelect: "none",
      }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Time Column */}
      <div
        className="timeline-time-col"
        style={{
          flexShrink: 0,
          width: 50,
          textAlign: "right",
          fontSize: 10,
          color: "var(--text-dim)",
          paddingRight: 8,
          paddingTop: 4,
          fontFamily: "var(--font-mono)",
          opacity: 0.6,
        }}
      >
        {showDate && (
          <div style={{ marginBottom: 2, fontSize: 9, color: "var(--text-muted)" }}>
            {formatDate(new Date(entry.timestamp))}
          </div>
        )}
        {formatTime(entry.timestamp)}
      </div>

      {/* Symbol Column */}
      <div
        className="timeline-symbol-col"
        style={{
          position: "relative",
          flexShrink: 0,
          width: 20,
          textAlign: "center",
          fontSize: 14,
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          alignSelf: "stretch",
        }}
      >
        {!isFirst && (
          <div
            style={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 1,
              height: 24,
              backgroundColor: getLineColor("top"),
            }}
          />
        )}
        {!isLast && (
          <div
            style={{
              position: "absolute",
              top: 12,
              bottom: -12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 1,
              backgroundColor: getLineColor("bottom"),
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            backgroundColor: "var(--bg-primary)",
          }}
        >
          {getEntrySymbol()}
        </div>
      </div>

      {/* Content */}
      <div className="timeline-content-col" style={{ flex: 1, minWidth: 0 }}>
        {/* Mobile timestamp */}
        <div
          className="timeline-mobile-time"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            marginBottom: 4,
            display: "none",
          }}
        >
          {formatTime(entry.timestamp)}
        </div>
        <div
          className="flex flex-wrap items-baseline"
          style={{ gap: "4px 12px", marginBottom: 6 }}
        >
          {entry.content && (
            <span
              className="timeline-content-text"
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                overflowWrap: "break-word",
                fontFamily: "var(--font-primary)",
                whiteSpace: "pre-wrap",
                color: getContentColor(),
                fontStyle: isSessionEnd ? "italic" : "normal",
                textDecoration: isTaskDone ? "line-through" : "none",
              }}
            >
              {linkifyContent(entry.content)}
            </span>
          )}

          {isSessionStart && sessionDuration && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent)",
                backgroundColor: "var(--accent-subtle)",
                padding: "2px 6px",
                borderRadius: 3,
                userSelect: "none",
                fontWeight: 500,
              }}
            >
              {formatDuration(sessionDuration)}
            </span>
          )}

          {isTaskDone && (
            <span
              style={{
                fontSize: 11,
                color: "var(--success)",
                fontWeight: 700,
                userSelect: "none",
              }}
            >
              [DONE]
            </span>
          )}
          {isTask && (
            <span
              style={{
                fontSize: 11,
                color: "var(--warning)",
                fontWeight: 700,
                userSelect: "none",
              }}
            >
              [TODO]
            </span>
          )}
        </div>

        {category && (
          <div style={{ marginTop: 6 }}>
            <span
              className="category-label"
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 3,
                fontWeight: 600,
                textTransform: "uppercase",
                userSelect: "none",
                letterSpacing: "0.05em",
                color: categoryTextColor,
                backgroundColor: `${category.color}20`,
                border: `1px solid ${category.color}40`,
              }}
            >
              #{category.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
