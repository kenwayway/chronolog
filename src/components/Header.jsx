import { useState, useRef, useEffect } from "react";
import {
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Activity,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { formatDate } from "../utils/formatters";

// Simple Calendar Component
function Calendar({ selectedDate, onSelect, onClose }) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const calendarRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= today) setViewDate(next);
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} style={{ width: 32, height: 32 }} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const isSelected =
      selectedDate && date.toDateString() === selectedDate.toDateString();
    const isFuture = date > today;

    days.push(
      <button
        key={day}
        disabled={isFuture}
        onClick={() => {
          onSelect(date);
          onClose();
        }}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "none",
          cursor: isFuture ? "default" : "pointer",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          backgroundColor: isSelected
            ? "var(--accent)"
            : isToday
              ? "var(--accent-subtle)"
              : "transparent",
          color: isFuture
            ? "var(--text-dim)"
            : isSelected
              ? "white"
              : isToday
                ? "var(--accent)"
                : "var(--text-secondary)",
          fontWeight: isToday || isSelected ? 600 : 400,
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) =>
          !isFuture &&
          !isSelected &&
          (e.target.style.backgroundColor = "var(--bg-tertiary)")
        }
        onMouseLeave={(e) =>
          !isSelected &&
          (e.target.style.backgroundColor = isToday
            ? "var(--accent-subtle)"
            : "transparent")
        }
      >
        {day}
      </button>,
    );
  }

  return (
    <div
      ref={calendarRef}
      className="animate-slide-in"
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 8,
        padding: 12,
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border-light)",
        borderRadius: 8,
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        zIndex: 500,
        minWidth: 260,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            width: 28,
            height: 28,
            border: "none",
            borderRadius: 4,
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {monthNames[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={new Date(year, month + 1, 1) > today}
          style={{
            width: 28,
            height: 28,
            border: "none",
            borderRadius: 4,
            backgroundColor: "transparent",
            color:
              new Date(year, month + 1, 1) > today
                ? "var(--text-dim)"
                : "var(--text-secondary)",
            cursor:
              new Date(year, month + 1, 1) > today ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day names */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 32px)",
          gap: 2,
          marginBottom: 4,
        }}
      >
        {dayNames.map((d) => (
          <div
            key={d}
            style={{
              width: 32,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "var(--text-dim)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 32px)",
          gap: 2,
        }}
      >
        {days}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          onSelect(null);
          onClose();
        }}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "6px 0",
          border: "1px solid var(--border-light)",
          borderRadius: 4,
          backgroundColor: "transparent",
          color: "var(--accent)",
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) =>
          (e.target.style.backgroundColor = "var(--accent-subtle)")
        }
        onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
      >
        TODAY
      </button>
    </div>
  );
}

export function Header({
  isStreaming,
  pendingTaskCount,
  selectedDate,
  onDateChange,
  isDark,
  onToggleTheme,
  onOpenSidebar,
  onOpenLeftSidebar,
  onOpenSettings,
}) {
  const { canToggleMode } = useTheme();
  const [showCalendar, setShowCalendar] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDate = selectedDate || today;
  const isToday = currentDate.toDateString() === today.toDateString();

  const goToPrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    onDateChange?.(prev);
  };

  const goToNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    if (next <= today) {
      onDateChange?.(next);
    }
  };

  return (
    <header className="header">
      <div className="flex items-center gap-3">
        {/* Logo + Title */}
        <div className="flex items-center gap-2 select-none">
          {/* Breathing indicator */}
          <div className="relative flex-center header-indicator">
            <div
              className={isStreaming ? "animate-ping" : ""}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                backgroundColor: isStreaming
                  ? "var(--success)"
                  : "var(--text-dim)",
                opacity: isStreaming ? 0.75 : 0.4,
              }}
            />
            <div
              className="header-indicator-inner"
              style={{
                backgroundColor: isStreaming
                  ? "var(--success)"
                  : "var(--text-dim)",
              }}
            />
          </div>
          <span className="header-title">CHRONOLOG</span>
        </div>

        {/* Date Navigation */}
        <div
          className="flex items-center gap-1 relative"
          style={{ marginLeft: 8 }}
        >
          <button
            className="btn btn-ghost"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={goToPrevDay}
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn btn-ghost"
            style={{
              height: 28,
              padding: "0 8px",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: isToday ? "var(--accent)" : "var(--text-secondary)",
            }}
            onClick={() => setShowCalendar(!showCalendar)}
            title="Select date"
          >
            {isToday ? "TODAY" : formatDate(currentDate.getTime())}
          </button>

          <button
            className="btn btn-ghost"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              opacity: isToday ? 0.3 : 1,
            }}
            onClick={goToNextDay}
            disabled={isToday}
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>

          {showCalendar && (
            <Calendar
              selectedDate={selectedDate}
              onSelect={onDateChange}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn btn-ghost relative rounded-lg"
          style={{ width: 36, height: 36, padding: 0 }}
          onClick={onOpenLeftSidebar}
          title="Activity & Filters"
        >
          <Activity size={20} strokeWidth={1.5} />
        </button>

        <button
          className="btn btn-ghost relative rounded-lg"
          style={{ width: 36, height: 36, padding: 0 }}
          onClick={onOpenSidebar}
          title="Tasks"
        >
          <ClipboardList size={20} strokeWidth={1.5} />
          {pendingTaskCount > 0 && (
            <span
              className="absolute rounded-full"
              style={{
                top: 5,
                right: 5,
                width: 5,
                height: 5,
                backgroundColor: "var(--accent)",
              }}
            />
          )}
        </button>

        <button
          className="btn btn-ghost rounded-lg"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            opacity: canToggleMode ? 1 : 0.3,
            cursor: canToggleMode ? 'pointer' : 'not-allowed',
          }}
          onClick={canToggleMode ? onToggleTheme : undefined}
          disabled={!canToggleMode}
          title={canToggleMode ? (isDark ? "Light mode" : "Dark mode") : "Theme locked to light mode"}
        >
          {isDark ? (
            <Sun size={20} strokeWidth={1.5} />
          ) : (
            <Moon size={20} strokeWidth={1.5} />
          )}
        </button>

        <button
          className="btn btn-ghost rounded-lg"
          style={{ width: 36, height: 36, padding: 0 }}
          onClick={onOpenSettings}
          title="Config"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
