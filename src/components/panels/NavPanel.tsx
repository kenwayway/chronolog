import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Images, History, X, type LucideIcon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import styles from "./NavPanel.module.css";

interface Destination {
    to: string;
    label: string;
    description: string;
    icon: LucideIcon;
}

/**
 * Every route the app can navigate to. New features are added here rather
 * than as another header icon, so the header stops growing with the app.
 */
const DESTINATIONS: Destination[] = [
    {
        to: "/retro",
        label: "Retrospective",
        description: "Resurface a random entry from the past",
        icon: History,
    },
    {
        to: "/library",
        label: "Media Library",
        description: "Books, movies, games, and shows",
        icon: BookOpen,
    },
    {
        to: "/gallery",
        label: "Gallery",
        description: "Every image attached to an entry",
        icon: Images,
    },
];

interface NavPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * NavPanel — the destination drawer. It holds places you go, as opposed to
 * the header's actions (search, activity, settings) which act on the view
 * you are already in.
 */
export function NavPanel({ isOpen, onClose }: NavPanelProps) {
    const { tokens } = useTheme();
    const { pathname } = useLocation();

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    return (
        <>
            {isOpen && <div className={styles.overlay} onClick={onClose} />}

            <aside className={`${styles.panel} ${isOpen ? "" : styles.closed}`}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <span className={styles.titlePrefix}>{tokens.panelTitlePrefix}</span>
                        <span>GO TO</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.closeBtn}
                        aria-label="Close navigation panel"
                        title="Close navigation panel"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>

                <nav className={styles.list}>
                    {DESTINATIONS.map(({ to, label, description, icon: Icon }) => (
                        <Link
                            key={to}
                            to={to}
                            onClick={onClose}
                            className={`${styles.item} ${pathname === to ? styles.active : ""}`}
                        >
                            <span className={styles.itemIcon}>
                                <Icon size={15} strokeWidth={1.5} />
                            </span>
                            <span className={styles.itemText}>
                                <span className={styles.itemLabel}>{label}</span>
                                <span className={styles.itemDesc}>{description}</span>
                            </span>
                            <span className={styles.itemArrow}>→</span>
                        </Link>
                    ))}
                </nav>
            </aside>
        </>
    );
}
