import { useState, useEffect, MouseEvent } from "react";
import { Palette, Sparkles, Database, LucideIcon } from "lucide-react";
import type { Entry, Category, CloudSyncFull, GoogleTasksStatus } from "../../types";
import { AppearanceTab, AITab, SyncTab } from "./settings";

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
        <div
            onMouseDown={handleBackdropClick}
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "var(--bg-primary)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
                cursor: "default",
            }}
        >
            <div style={{ maxWidth: 480, width: "100%", pointerEvents: "none" }}>
                <div
                    className="modal-panel"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        pointerEvents: "auto",
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-light)",
                        borderRadius: 4,
                        boxShadow: "0 0 80px rgba(0,0,0,0.3)",
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    {/* Header with Tabs */}
                    <div
                        style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-secondary)",
                            userSelect: "none",
                        }}
                    >
                        {/* Title row */}
                        <div className="flex-between" style={{ padding: "12px 20px 0" }}>
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                CONFIG
                            </span>
                            <button onClick={onClose} className="edit-modal-close" style={{ fontSize: 20 }}>×</button>
                        </div>

                        {/* Tabs */}
                        <div className="settings-tabs">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                                    >
                                        <Icon size={14} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content - Tab Components */}
                    <div style={{ padding: 20, minHeight: 280 }}>
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
                    <div
                        className="flex-between"
                        style={{
                            padding: "12px 20px",
                            borderTop: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-secondary)",
                        }}
                    >
                        <span style={{ fontSize: 10, color: "var(--text-dim)", userSelect: "none" }}>
                            Esc to close
                        </span>
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
