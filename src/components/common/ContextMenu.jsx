import { useEffect, useRef } from "react";
import { ENTRY_TYPES } from "../../utils/constants";

export function ContextMenu({
  isOpen,
  position,
  entry,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  onMarkAsTask,
  onLink,
  googleTasksEnabled = false,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !entry) return null;

  const handleEdit = () => {
    onEdit(entry);
    onClose();
  };
  const handleDelete = () => {
    onDelete(entry);
    onClose();
  };
  const handleCopy = () => {
    onCopy(entry);
    onClose();
  };
  const handleMarkAsTask = () => {
    onMarkAsTask(entry);
    onClose();
  };
  const handleLink = () => {
    onLink?.(entry);
    onClose();
  };

  // Can mark as task: NOTE or SESSION_START, not already a task
  const isTask = entry.contentType === 'task';
  const isTaskDone = isTask && entry.fieldValues?.done;
  const canMarkAsTask =
    (entry.type === ENTRY_TYPES.NOTE || entry.type === ENTRY_TYPES.SESSION_START) &&
    !isTask;

  return (
    <div
      ref={menuRef}
      className="fixed animate-slide-in context-menu"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 120,
        padding: "4px 0",
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-light)",
        borderRadius: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 500,
        fontFamily: "var(--font-mono)",
      }}
    >
      {canMarkAsTask && (
        <button
          className="context-menu-item"
          onClick={handleMarkAsTask}
          title={googleTasksEnabled ? "Adds to Google Tasks" : "Connect Google Tasks in Settings"}
        >
          MARK TODO
        </button>
      )}

      {isTask && (
        <span
          className="context-menu-item"
          style={{ color: "var(--text-dim)", cursor: "default" }}
        >
          [PENDING TASK]
        </span>
      )}

      <button className="context-menu-item" onClick={handleEdit}>
        EDIT
      </button>

      <button className="context-menu-item" onClick={handleLink}>
        🔗 LINK
      </button>

      <button className="context-menu-item" onClick={handleCopy}>
        COPY
      </button>

      <div
        style={{
          height: 1,
          margin: "4px 8px",
          backgroundColor: "var(--border-subtle)",
        }}
      />

      <button
        className="context-menu-item context-menu-item-danger"
        onClick={handleDelete}
      >
        DELETE
      </button>
    </div>
  );
}
