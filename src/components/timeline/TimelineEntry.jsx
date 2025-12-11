import { useState } from "react";
import { MapPin, Link2 } from "lucide-react";
import { ENTRY_TYPES } from "../../utils/constants";
import { formatTime, formatDuration, formatDate } from "../../utils/formatters";
import { useTheme } from "../../hooks/useTheme";

export function TimelineEntry({
  entry,
  allEntries,
  isFirst,
  isLast,
  sessionDuration,
  categories,
  onContextMenu,
  lineState,
  isLightMode,
  showDate = false,
  onNavigateToEntry,
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

    // ContentType-based symbols (task)
    if (entry.contentType === 'task') {
      const isDone = entry.fieldValues?.done;
      if (isDone) {
        return (
          <span style={{ ...styles, color: "var(--success)", fontWeight: 700 }}>
            {symbols.done}
          </span>
        );
      }
      return (
        <span style={{ ...styles, color: "var(--warning)" }}>
          {symbols.todo}
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
      default:
        return (
          <span style={{ ...styles, color: "var(--text-dim)" }}>
            {symbols.note}
          </span>
        );
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
  const isTask = entry.contentType === 'task';
  const isTaskDone = isTask && entry.fieldValues?.done;

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
    if (isTaskDone) return "var(--text-muted)";
    if (isTask) return "var(--warning)";
    return "var(--text-secondary)";
  };

  // Resolve linked entries (outgoing) and entries that link to this one (incoming)
  const outgoingLinks = (entry.linkedEntries || []);
  const incomingLinks = allEntries
    ?.filter(e => e.id !== entry.id && e.linkedEntries?.includes(entry.id))
    .map(e => e.id) || [];

  // Combine and dedupe
  const allLinkedIds = [...new Set([...outgoingLinks, ...incomingLinks])];
  const linkedEntryData = allLinkedIds
    .map(id => allEntries?.find(e => e.id === id))
    .filter(Boolean);

  const beforeLinks = linkedEntryData.filter(e => e.timestamp < entry.timestamp);
  const afterLinks = linkedEntryData.filter(e => e.timestamp >= entry.timestamp);

  const getPreview = (content) => {
    if (!content) return "(empty)";
    const firstLine = content.split("\n")[0];
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
  };

  const LinkedEntryPreview = ({ linkedEntry, direction }) => {
    const handleClick = () => {
      // Try to find the element on current page first
      const entryElement = document.querySelector(`[data-entry-id="${linkedEntry.id}"]`);
      if (entryElement) {
        entryElement.scrollIntoView({ behavior: "smooth", block: "center" });
        entryElement.style.backgroundColor = "var(--accent-subtle)";
        setTimeout(() => {
          entryElement.style.backgroundColor = "";
        }, 1500);
      } else {
        // Entry not on current page, navigate to its date
        onNavigateToEntry?.(linkedEntry);
      }
    };

    return (
      <button
        className="linked-entry-preview"
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          marginLeft: 86,
          marginBottom: direction === "before" ? 4 : 0,
          marginTop: direction === "after" ? 4 : 0,
          fontSize: 11,
          color: "var(--text-secondary)",
          backgroundColor: "transparent", // Keep transparent
          border: "1px solid var(--border-subtle)",
          borderRadius: 4,
          cursor: "pointer",
          width: "calc(100% - 86px)",
          textAlign: "left",
          transition: "all 0.2s ease",
          fontFamily: "var(--font-mono)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        <span style={{
          color: "var(--accent)",
          fontWeight: 600,
          fontSize: 12,
          lineHeight: 1,
          width: 14, // Fixed width for alignment
          display: "inline-block",
          textAlign: "center"
        }}>
          {direction === 'before' ? '↱' : '↳'}
        </span>

        <span style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {getPreview(linkedEntry.content)}
        </span>
      </button>
    );
  };

  return (


    <div
      className={`timeline-entry ${isTaskDone ? 'timeline-entry-done' : ''}`}
      data-entry-id={entry.id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        cursor: "default",
        userSelect: "none",
        transition: "background-color 300ms ease",
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
        {/* Linked entries before (older) */}
        {beforeLinks.length > 0 && (
          <div className="linked-entries-before" style={{ marginBottom: 8 }}>
            {beforeLinks.map(linked => (
              <LinkedEntryPreview key={linked.id} linkedEntry={linked} direction="before" />
            ))}
          </div>
        )}
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
          {isTask && !isTaskDone && (
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
          {entry.contentType === 'expense' && entry.fieldValues && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent)",
                backgroundColor: "var(--accent-subtle)",
                padding: "2px 8px",
                borderRadius: 3,
                fontWeight: 500,
                userSelect: "none",
              }}
            >
              {(() => {
                const { amount, currency, category, subcategory, expenseType } = entry.fieldValues;
                const currencySymbols = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥' };
                const symbol = currencySymbols[currency] || '$';
                const cat = category || expenseType || '';
                const sub = subcategory ? ` › ${subcategory}` : '';
                return `${symbol}${amount}${cat ? ` · ${cat}${sub}` : ''}`;
              })()}
            </span>
          )}
        </div>

        {entry.contentType === 'bookmark' && entry.fieldValues && (
          <a
            href={entry.fieldValues.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              padding: "6px 10px",
              backgroundColor: "var(--bg-secondary",
              border: "1px solid var(--border-subtle)",
              textDecoration: "none",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              transition: "all 0.2s ease",
              width: "fit-content",
              maxWidth: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            <span style={{
              color: "var(--accent)",
              fontWeight: 600,
              fontSize: 11,
              flexShrink: 0
            }}>
              [MARK]
            </span>

            <span style={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {entry.fieldValues.title || entry.fieldValues.url || "Untitled"}
            </span>

            {entry.fieldValues.url && (
              <span style={{
                color: "var(--text-dim)",
                fontSize: 11,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 150
              }}>
                · {(() => {
                  try {
                    return new URL(entry.fieldValues.url).hostname.replace(/^www\./, '');
                  } catch {
                    return '';
                  }
                })()}
              </span>
            )}
          </a>
        )}

        {entry.contentType === 'mood' && entry.fieldValues && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              padding: "6px 10px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              width: "fit-content",
            }}
          >
            <span style={{ fontSize: 16 }}>
              {entry.fieldValues.feeling === 'Happy' ? '😄' :
                entry.fieldValues.feeling === 'Calm' ? '😌' :
                  entry.fieldValues.feeling === 'Tired' ? '😴' :
                    entry.fieldValues.feeling === 'Anxious' ? '😰' :
                      entry.fieldValues.feeling === 'Sad' ? '😢' : '😠'}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {entry.fieldValues.feeling}
            </span>
            {entry.fieldValues.energy && (
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                · ⚡{entry.fieldValues.energy}
              </span>
            )}
            {entry.fieldValues.trigger && (
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                · {entry.fieldValues.trigger}
              </span>
            )}
          </div>
        )}

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

        {/* Linked entries after (newer) */}
        {afterLinks.length > 0 && (
          <div className="linked-entries-after" style={{ marginTop: 8 }}>
            {afterLinks.map(linked => (
              <LinkedEntryPreview key={linked.id} linkedEntry={linked} direction="after" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
