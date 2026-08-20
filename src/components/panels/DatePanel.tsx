import { X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Calendar } from "@/components/common/Calendar";
import styles from "./DatePanel.module.css";

interface DatePanelProps {
    isOpen: boolean;
    selectedDate: Date | null;
    onSelect: (date: Date | null) => void;
    onClose: () => void;
}

export function DatePanel({
    isOpen,
    selectedDate,
    onSelect,
    onClose,
}: DatePanelProps) {
    const { tokens } = useTheme();

    return (
        <>
            {isOpen && <div className={styles.overlay} onClick={onClose} />}

            <aside
                id="date-panel"
                aria-label="Select date"
                aria-hidden={!isOpen}
                className={`${styles.panel} ${isOpen ? "" : styles.closed}`}
            >
                <div className={styles.header}>
                    <div className={styles.title}>
                        <span className={styles.titlePrefix}>{tokens.panelTitlePrefix}</span>
                        <span>CALENDAR</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.closeBtn}
                        aria-label="Close calendar panel"
                        title="Close calendar panel"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>

                <div className={styles.content}>
                    <Calendar
                        key={selectedDate?.toISOString() ?? "today"}
                        embedded
                        closeOnSelect={false}
                        selectedDate={selectedDate}
                        onSelect={onSelect}
                        onClose={onClose}
                    />
                </div>
            </aside>
        </>
    );
}
