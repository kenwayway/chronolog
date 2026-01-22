import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Calendar.module.css";

interface CalendarProps {
    selectedDate: Date | null;
    onSelect: (date: Date | null) => void;
    onClose: () => void;
}

export function Calendar({ selectedDate, onSelect, onClose }: CalendarProps) {
    const [viewDate, setViewDate] = useState(selectedDate || new Date());
    const calendarRef = useRef<HTMLDivElement>(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
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

    const days: ReactNode[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className={styles.dayEmpty} />);
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
                className={`${styles.day} ${isToday ? styles.today : ""} ${isSelected ? styles.selected : ""} ${isFuture ? styles.future : ""}`}
            >
                {day}
            </button>
        );
    }

    const canGoNext = new Date(year, month + 1, 1) <= today;

    return (
        <div ref={calendarRef} className={`${styles.calendar} animate-slide-in`}>
            {/* Header */}
            <div className={styles.header}>
                <button onClick={prevMonth} className={styles.navBtn}>
                    <ChevronLeft size={16} />
                </button>
                <span className={styles.title}>
                    {monthNames[month]} {year}
                </span>
                <button
                    onClick={nextMonth}
                    disabled={!canGoNext}
                    className={`${styles.navBtn} ${!canGoNext ? styles.disabled : ""}`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Day names */}
            <div className={styles.weekdays}>
                {dayNames.map((d) => (
                    <div key={d} className={styles.weekday}>{d}</div>
                ))}
            </div>

            {/* Days grid */}
            <div className={styles.days}>{days}</div>

            {/* Today button */}
            <button
                onClick={() => {
                    onSelect(null);
                    onClose();
                }}
                className={styles.todayBtn}
            >
                TODAY
            </button>
        </div>
    );
}

