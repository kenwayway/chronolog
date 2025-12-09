import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export function Dropdown({ value, onChange, options, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = options?.find((opt) => opt.value === value);

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 140),
      });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
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
  }, [isOpen]);

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        className="custom-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: selectedOption?.color || "var(--text-secondary)",
        }}
      >
        <span className="custom-dropdown-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`custom-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </button>

      {/* Portal Dropdown Menu */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="custom-dropdown-menu animate-slide-in"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: menuPosition.width,
          }}
        >
          {options?.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`custom-dropdown-item ${value === option.value ? "selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.color && (
                <span
                  className="custom-dropdown-color"
                  style={{ backgroundColor: option.color }}
                />
              )}
              <span style={{ color: option.color || "inherit" }}>
                {option.label}
              </span>
              {value === option.value && (
                <Check size={14} className="custom-dropdown-check" />
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
