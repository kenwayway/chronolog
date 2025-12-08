import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({ selectedDate, onSelect, onClose }) {
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
    const startDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => {
        const next = new Date(year, month + 1, 1);
        if (next <= today) setViewDate(next);
    };

    const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day-empty" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
        const isFuture = date > today;

        days.push(
            <button
                key={day}
                disabled={isFuture}
                onClick={() => {
                    onSelect(date);
                    onClose();
                }}
                className={`calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isFuture ? "future" : ""}`}
            >
                {day}
            </button>
        );
    }

    const canGoNext = new Date(year, month + 1, 1) <= today;

    return (
        <div ref={calendarRef} className="calendar animate-slide-in">
            {/* Header */}
            <div className="calendar-header">
                <button onClick={prevMonth} className="calendar-nav-btn">
                    <ChevronLeft size={16} />
                </button>
                <span className="calendar-title">
                    {monthNames[month]} {year}
                </span>
                <button
                    onClick={nextMonth}
                    disabled={!canGoNext}
                    className={`calendar-nav-btn ${!canGoNext ? "disabled" : ""}`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Day names */}
            <div className="calendar-weekdays">
                {dayNames.map((d) => (
                    <div key={d} className="calendar-weekday">{d}</div>
                ))}
            </div>

            {/* Days grid */}
            <div className="calendar-days">{days}</div>

            {/* Today button */}
            <button
                onClick={() => {
                    onSelect(null);
                    onClose();
                }}
                className="calendar-today-btn"
            >
                TODAY
            </button>
        </div>
    );
}
