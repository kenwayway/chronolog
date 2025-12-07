import { useEffect, useRef } from "react";
import { ENTRY_TYPES } from "../utils/constants";

export function ContextMenu({
  isOpen,
  position,
  entry,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  onToggleTodo,
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
  const handleToggleTodo = () => {
    onToggleTodo(entry.id);
    onClose();
  };

  const isNote = entry.type === ENTRY_TYPES.NOTE;

  return (
    <div
      ref={menuRef}
      className="fixed animate-slide-in"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 120,
        padding: "4px 0",
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 500,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {isNote && (
        <button className="context-menu-item" onClick={handleToggleTodo}>
          {entry.isTodo ? "UNMARK TODO" : "MARK TODO"}
        </button>
      )}

      <button className="context-menu-item" onClick={handleEdit}>
        EDIT
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
