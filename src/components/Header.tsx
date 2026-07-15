import { useState, useRef, useEffect, MouseEvent, TouchEvent } from "react";
import {
    Settings,
    ChevronLeft,
    ChevronRight,
    Moon,
    Sun,
    Activity,
    Menu,
    X,
    Cloud,
    Search,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { formatDate } from "@/utils/formatters";
import { Calendar } from "./common/Calendar";
import styles from "./Header.module.css";
import { useCloudSyncContext } from "@/contexts/CloudSyncContext";
import { useUIStateContext } from "@/hooks/useUIStateContext";

interface HeaderProps {
    isStreaming: boolean;
    selectedDate: Date | null;
    onDateChange: (date: Date | null) => void;
}

export function Header({
    isStreaming,
    selectedDate,
    onDateChange,
}: HeaderProps) {
    const cloudSync = useCloudSyncContext();
    const { isDark, toggleTheme: onToggleTheme, canToggleMode } = useTheme();
    const ui = useUIStateContext();
    const onOpenLeftSidebar = () => ui.setLeftSidebarOpen(true);
    const onOpenSettings = () => ui.setSettingsOpen(true);
    const onOpenSearch = () => ui.setSearchOpen(true);
    const [showCalendar, setShowCalendar] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Close mobile menu when clicking outside
    useEffect(() => {
        if (!mobileMenuOpen) return;

        const handleClickOutside = (e: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [mobileMenuOpen]);

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
        <header className={styles.header}>
            <div className="flex items-center gap-3">
                {/* Logo + Title */}
                <div className="flex items-center gap-2 select-none">
                    <div className={`relative flex-center ${styles.indicator}`}>
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
                            className={styles.indicatorInner}
                            style={{
                                backgroundColor: isStreaming
                                    ? "var(--success)"
                                    : "var(--text-dim)",
                            }}
                        />
                    </div>
                    <span className={styles.title}>CHRONOLOG</span>
                    {/* Cloud sync indicator */}
                    {cloudSync.isLoggedIn && (
                        <span title={cloudSync.isSyncing ? "同步中..." : "云端已连接"}>
                            <Cloud
                                size={12}
                                style={{
                                    color: cloudSync.isSyncing ? "var(--accent)" : "var(--success)",
                                    opacity: 0.7,
                                    animation: cloudSync.isSyncing ? "spin 1s linear infinite" : "none",
                                }}
                            />
                        </span>
                    )}
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
                            fontSize: 12,
                            fontWeight: 400,
                            fontFamily: "var(--font-mono)",
                            color: isToday ? "var(--accent)" : "var(--text-secondary)",
                        }}
                        onClick={() => setShowCalendar(!showCalendar)}
                        title="Select date"
                    >
                        {formatDate(currentDate.getTime())}
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

            <div className={`${styles.actions} hide-mobile`}>
                <button
                    className="btn btn-ghost relative rounded-lg"
                    style={{ width: 36, height: 36, padding: 0 }}
                    onClick={onOpenSearch}
                    title="Search entries (Ctrl/Command + K)"
                >
                    <Search size={20} strokeWidth={1.5} />
                </button>

                <button
                    className="btn btn-ghost relative rounded-lg"
                    style={{ width: 36, height: 36, padding: 0 }}
                    onClick={onOpenLeftSidebar}
                    title="Activity & Filters"
                >
                    <Activity size={20} strokeWidth={1.5} />
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

            <div className={`${styles.mobileMenu} show-mobile-only`} ref={mobileMenuRef}>
                <button
                    className="btn btn-ghost rounded-lg"
                    style={{ width: 36, height: 36, padding: 0 }}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? (
                        <X size={22} strokeWidth={1.5} />
                    ) : (
                        <Menu size={22} strokeWidth={1.5} />
                    )}
                </button>

                {/* Mobile dropdown menu */}
                {mobileMenuOpen && (
                    <div className={styles.mobileMenuDropdown}>
                        <button
                            className={styles.mobileMenuItem}
                            onClick={() => { onOpenSearch(); setMobileMenuOpen(false); }}
                        >
                            <Search size={18} />
                            <span>Search</span>
                        </button>
                        <button
                            className={styles.mobileMenuItem}
                            onClick={() => { onOpenLeftSidebar(); setMobileMenuOpen(false); }}
                        >
                            <Activity size={18} />
                            <span>Activity</span>
                        </button>
                        <button
                            className={styles.mobileMenuItem}
                            onClick={() => { if (canToggleMode) { onToggleTheme(); setMobileMenuOpen(false); } }}
                            style={{ opacity: canToggleMode ? 1 : 0.4 }}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            <span>{isDark ? "Light mode" : "Dark mode"}</span>
                        </button>
                        <button
                            className={styles.mobileMenuItem}
                            onClick={() => { onOpenSettings(); setMobileMenuOpen(false); }}
                        >
                            <Settings size={18} />
                            <span>Settings</span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
