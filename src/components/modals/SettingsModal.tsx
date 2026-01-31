import { useState, MouseEvent } from "react";
import { Palette, Database, LucideIcon } from "lucide-react";
import type { Entry, Category, CloudSyncFull, GoogleTasksStatus } from "../../types";
import { AppearanceTab, SyncTab } from "./settings";
import styles from "./SettingsModal.module.css";

interface Tab {
    id: string;
    label: string;
    icon: LucideIcon;
}

const TABS: Tab[] = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "sync", label: "Sync", icon: Database },
];



interface ImportData {
    entries: Entry[];
    tasks: unknown[];
    categories?: Category[];
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories?: Category[];
    entries?: Entry[];
    tasks?: unknown[];
    onImportData: (data: ImportData) => void;
    cloudSync?: CloudSyncFull;
    googleTasks?: GoogleTasksStatus;
}

/**
 * Settings modal - refactored to use extracted tab components
 * AppearanceTab, AITab, and SyncTab handle their own logic
 */
export function SettingsModal({
    isOpen,
    onClose,
    categories,
    entries,
    tasks,
    onImportData,
    cloudSync,
    googleTasks,
}: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState("appearance");

    if (!isOpen) return null;

    const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className={styles.overlay} onMouseDown={handleBackdropClick}>
            <div style={{ maxWidth: 480, width: "100%", pointerEvents: "none" }}>
                <div
                    className={styles.panel}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Header with Tabs */}
                    <div className={styles.header}>
                        {/* Title row */}
                        <div className={`flex-between ${styles.headerTitle}`}>
                            <span className={styles.title}>CONFIG</span>
                            <button onClick={onClose} className={styles.closeBtn}>×</button>
                        </div>

                        {/* Tabs */}
                        <div className={styles.tabs}>
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
                                    >
                                        <Icon size={14} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content - Tab Components */}
                    <div className={styles.content}>
                        {activeTab === "appearance" && (
                            <AppearanceTab categories={categories} />
                        )}
                        {activeTab === "sync" && (
                            <SyncTab
                                cloudSync={cloudSync}
                                googleTasks={googleTasks}
                                entries={entries}
                                tasks={tasks}
                                categories={categories}
                                onImportData={onImportData}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`flex-between ${styles.footer}`}>
                        <span className={styles.footerHint}>Esc to close</span>
                        <button
                            onClick={onClose}
                            className="btn-action btn-action-primary"
                        >
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

