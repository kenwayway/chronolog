import { useState, useEffect, MouseEvent } from "react";
import { Palette, Sparkles, Database, LucideIcon } from "lucide-react";
import type { Entry, Category, CloudSyncFull, GoogleTasksStatus } from "../../types";
import { AppearanceTab, AITab, SyncTab } from "./settings";
import styles from "./SettingsModal.module.css";

interface Tab {
    id: string;
    label: string;
    icon: LucideIcon;
}

const TABS: Tab[] = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "sync", label: "Sync", icon: Database },
];

interface AICommentConfig {
    hasApiKey: boolean;
    baseUrl: string;
    model: string;
    persona: string;
}

interface ImportData {
    entries: Entry[];
    tasks: unknown[];
    categories?: Category[];
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    aiCommentConfig?: AICommentConfig | null;
    onSaveAIConfig: (config: { baseUrl?: string; model?: string; persona?: string }) => Promise<boolean>;
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
    aiCommentConfig,
    onSaveAIConfig,
    categories,
    entries,
    tasks,
    onImportData,
    cloudSync,
    googleTasks,
}: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState("appearance");
    const [baseUrl, setBaseUrl] = useState(aiCommentConfig?.baseUrl || "https://api.openai.com/v1");
    const [model, setModel] = useState(aiCommentConfig?.model || "gpt-4o-mini");
    const [persona, setPersona] = useState(aiCommentConfig?.persona || "");
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    // Update local state when config changes
    useEffect(() => {
        if (aiCommentConfig) {
            setBaseUrl(aiCommentConfig.baseUrl || "https://api.openai.com/v1");
            setModel(aiCommentConfig.model || "gpt-4o-mini");
            setPersona(aiCommentConfig.persona || "");
        }
    }, [aiCommentConfig]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        const success = await onSaveAIConfig({ baseUrl, model, persona });
        setSaving(false);
        if (success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        }
    };

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
                        {activeTab === "ai" && (
                            <AITab
                                cloudSync={cloudSync}
                                aiCommentConfig={aiCommentConfig}
                                baseUrl={baseUrl}
                                setBaseUrl={setBaseUrl}
                                model={model}
                                setModel={setModel}
                                persona={persona}
                                setPersona={setPersona}
                            />
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
                            onClick={handleSave}
                            className="btn-action btn-action-primary"
                            style={{ backgroundColor: saved ? "#22c55e" : undefined }}
                        >
                            {saved ? "SAVED ✓" : "SAVE"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

