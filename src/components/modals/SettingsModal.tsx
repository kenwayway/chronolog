import { useState, useRef, ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { Download, Upload, Check, FolderOpen, Cloud, CloudOff, RefreshCw, Palette, Sparkles, Database, Trash2, LucideIcon } from "lucide-react";
import { useTheme, ACCENT_COLORS } from "../../hooks/useTheme";
import type { Entry, Category } from "../../types";

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

interface CloudSync {
    isLoggedIn: boolean;
    isSyncing: boolean;
    lastSynced?: number;
    error?: string;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    sync: () => void;
    cleanupImages: () => Promise<{ deletedCount: number; totalImages: number; error?: string }>;
}

interface GoogleTasks {
    isLoggedIn: boolean;
    isLoading: boolean;
    error?: string;
    login: () => void;
    logout: () => void;
}

interface AIConfig {
    apiKey: string;
    aiBaseUrl: string;
    aiModel: string;
}

interface ImportData {
    entries: Entry[];
    tasks: unknown[];
    categories?: Category[];
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey?: string | null;
    aiBaseUrl?: string;
    aiModel?: string;
    onSaveAIConfig: (config: AIConfig) => void;
    categories?: Category[];
    entries?: Entry[];
    tasks?: unknown[];
    onImportData: (data: ImportData) => void;
    cloudSync?: any;
    googleTasks?: any;
}

interface CleanupResult {
    deletedCount?: number;
    totalImages?: number;
    error?: string;
}

export function SettingsModal({
    isOpen,
    onClose,
    apiKey,
    aiBaseUrl,
    aiModel,
    onSaveAIConfig,
    categories,
    entries,
    tasks,
    onImportData,
    cloudSync,
    googleTasks,
}: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState("appearance");
    const [key, setKey] = useState(apiKey || "");
    const [baseUrl, setBaseUrl] = useState(aiBaseUrl || "https://api.openai.com/v1");
    const [model, setModel] = useState(aiModel || "gpt-4o-mini");
    const [saved, setSaved] = useState(false);
    const [cloudPassword, setCloudPassword] = useState("");
    const [cloudLoginError, setCloudLoginError] = useState("");
    const [isCleaningUp, setIsCleaningUp] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
    const { theme, setAccent, setStyle, availableStyles } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveAIConfig({ apiKey: key, aiBaseUrl: baseUrl, aiModel: model });
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 800);
    };

    const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleExport = () => {
        const data = {
            entries,
            tasks,
            categories,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chronolog-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.entries) {
                    onImportData({
                        entries: data.entries,
                        tasks: data.tasks || [],
                        categories: data.categories,
                    });
                }
            } catch {
                console.error("Failed to parse import file");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
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
                        <div
                            className="flex-between"
                            style={{ padding: "12px 20px 0" }}
                        >
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

                    {/* Content */}
                    <div style={{ padding: 20, minHeight: 280 }}>
                        {activeTab === "appearance" && (
                            <div className="space-y-5">
                                {/* Theme Style */}
                                <div>
                                    <div className="settings-section-label">THEME STYLE</div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableStyles.map((style) => (
                                            <button
                                                key={style.id}
                                                onClick={() => setStyle(style.id)}
                                                className="settings-theme-btn"
                                                style={{
                                                    backgroundColor: theme.style === style.id ? "var(--accent)" : "var(--bg-secondary)",
                                                    color: theme.style === style.id ? "white" : "var(--text-secondary)",
                                                    border: theme.style === style.id ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                                                }}
                                            >
                                                {style.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Accent Color */}
                                <div>
                                    <div className="settings-section-label">ACCENT COLOR</div>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                                            <button
                                                key={colorKey}
                                                onClick={() => setAccent(colorKey as any)}
                                                title={color.name}
                                                className="settings-color-btn"
                                                style={{
                                                    backgroundColor: color.value,
                                                    border: theme.accent === colorKey ? "2px solid var(--text-primary)" : "2px solid transparent",
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Categories (read-only display) */}
                                <div>
                                    <span className="settings-section-label">CATEGORIES</span>
                                    <div className="space-y-1">
                                        {categories?.map((cat) => (
                                            <div key={cat.id} className="settings-category-item">
                                                <span className="settings-category-dot" style={{ backgroundColor: cat.color }} />
                                                <span className="settings-category-label">{cat.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === "ai" && (
                            <div className="space-y-4">
                                {/* Local AI Config for AI Comment */}
                                <div>
                                    <div className="settings-section-label">AI COMMENT CONFIG</div>
                                    <p className="settings-hint" style={{ marginBottom: 12 }}>
                                        右键 Entry → "💭 AI COMMENT" 使用此配置
                                    </p>
                                    <div className="space-y-2">
                                        <input
                                            type="password"
                                            value={key}
                                            onChange={(e) => setKey(e.target.value)}
                                            placeholder="OpenAI API Key (sk-...)"
                                            className="edit-modal-input"
                                            style={{ width: "100%" }}
                                        />
                                        <input
                                            type="text"
                                            value={baseUrl}
                                            onChange={(e) => setBaseUrl(e.target.value)}
                                            placeholder="API Base URL"
                                            className="edit-modal-input"
                                            style={{ width: "100%" }}
                                        />
                                        <input
                                            type="text"
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            placeholder="Model name"
                                            className="edit-modal-input"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>

                                {/* Auto-categorization info */}
                                <div className="settings-section-label">AUTO-CATEGORIZATION</div>

                                {cloudSync?.isLoggedIn ? (
                                    <div className="space-y-3">
                                        <p className="settings-hint" style={{ color: "var(--success)" }}>
                                            ✓ AI 分类已启用
                                        </p>
                                        <p className="settings-hint">
                                            新 entry 会自动分类。后端 AI 配置在 Cloudflare 后台设置。
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="settings-hint" style={{ color: "var(--text-muted)" }}>
                                            ⚠ 需要先连接 Cloud Sync 才能使用 AI 分类
                                        </p>
                                        <p className="settings-hint">
                                            在 Cloudflare 后台设置以下环境变量：
                                            <br />
                                            • <code style={{ fontSize: 11 }}>AI_API_KEY</code> - OpenAI API Key
                                            <br />
                                            • <code style={{ fontSize: 11 }}>AI_BASE_URL</code> - API Base URL（可选）
                                            <br />
                                            • <code style={{ fontSize: 11 }}>AI_MODEL</code> - 模型名称（可选）
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === "sync" && (
                            <div className="space-y-5">
                                {/* Cloud Sync */}
                                <div>
                                    <div className="settings-section-label">CLOUD SYNC</div>
                                    {cloudSync?.isLoggedIn ? (
                                        <div className="space-y-2">
                                            <div className="settings-sync-status">
                                                <Cloud size={14} style={{ color: "var(--success)" }} />
                                                <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>已连接</span>
                                                {cloudSync.isSyncing && (
                                                    <RefreshCw size={14} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => cloudSync.sync()}
                                                    disabled={cloudSync.isSyncing}
                                                    className="btn-action btn-action-secondary"
                                                    style={{ flex: 1, justifyContent: "center" }}
                                                >
                                                    <RefreshCw size={14} />
                                                    同步
                                                </button>
                                                <button
                                                    onClick={() => cloudSync.logout()}
                                                    className="btn-action btn-action-secondary"
                                                    style={{ flex: 1, justifyContent: "center", color: "var(--error)" }}
                                                >
                                                    <CloudOff size={14} />
                                                    登出
                                                </button>
                                            </div>
                                            {cloudSync.lastSynced && (
                                                <p className="settings-hint">上次同步: {new Date(cloudSync.lastSynced).toLocaleTimeString()}</p>
                                            )}
                                            {cloudSync.error && (
                                                <p className="settings-error">错误: {cloudSync.error}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                value={cloudPassword}
                                                onChange={(e) => setCloudPassword(e.target.value)}
                                                placeholder="输入同步密码..."
                                                className="edit-modal-input"
                                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                                    if (e.key === "Enter" && cloudPassword) {
                                                        cloudSync?.login(cloudPassword).then((result: any) => {
                                                            if (!result.success) {
                                                                setCloudLoginError(result.error || "Login failed");
                                                            } else {
                                                                setCloudPassword("");
                                                                setCloudLoginError("");
                                                            }
                                                        });
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (cloudPassword) {
                                                        const result = await cloudSync?.login(cloudPassword);
                                                        if (!result?.success) {
                                                            setCloudLoginError(result?.error || "Login failed");
                                                        } else {
                                                            setCloudPassword("");
                                                            setCloudLoginError("");
                                                        }
                                                    }
                                                }}
                                                disabled={!cloudPassword || cloudSync?.isSyncing}
                                                className="btn-action btn-action-primary"
                                                style={{ width: "100%", justifyContent: "center" }}
                                            >
                                                <Cloud size={14} />
                                                连接云端
                                            </button>
                                            {cloudLoginError && <p className="settings-error">{cloudLoginError}</p>}
                                            <p className="settings-hint">部署后在 Cloudflare 设置 AUTH_PASSWORD 环境变量</p>
                                        </div>
                                    )}
                                </div>

                                {/* Google Tasks */}
                                <div>
                                    <div className="settings-section-label">GOOGLE TASKS</div>
                                    {googleTasks?.isLoggedIn ? (
                                        <div className="space-y-2">
                                            <div className="settings-sync-status">
                                                <Cloud size={14} style={{ color: "var(--success)" }} />
                                                <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>已连接 Google Tasks</span>
                                            </div>
                                            <button
                                                onClick={() => googleTasks.logout()}
                                                className="btn-action btn-action-secondary"
                                                style={{ width: "100%", justifyContent: "center", color: "var(--error)" }}
                                            >
                                                <CloudOff size={14} />
                                                断开连接
                                            </button>
                                            <p className="settings-hint">右键条目选择"MARK TODO"添加到 Google Tasks</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => googleTasks?.login()}
                                                disabled={googleTasks?.isLoading}
                                                className="btn-action btn-action-primary"
                                                style={{ width: "100%", justifyContent: "center" }}
                                            >
                                                <Cloud size={14} />
                                                {googleTasks?.isLoading ? "连接中..." : "连接 Google Tasks"}
                                            </button>
                                            {googleTasks?.error && <p className="settings-error">{googleTasks.error}</p>}
                                            <p className="settings-hint">连接后任务会同步到 Google Tasks</p>
                                        </div>
                                    )}
                                </div>

                                {/* Import/Export */}
                                <div>
                                    <div className="settings-section-label">DATA</div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExport}
                                            className="btn-action btn-action-secondary btn-data-export"
                                            style={{ flex: 1, justifyContent: "center" }}
                                        >
                                            <span className="icon-swap">
                                                <Download size={14} className="icon-default" />
                                                <Check size={14} className="icon-hover" />
                                            </span>
                                            EXPORT
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="btn-action btn-action-secondary btn-data-import"
                                            style={{ flex: 1, justifyContent: "center" }}
                                        >
                                            <span className="icon-swap">
                                                <Upload size={14} className="icon-default" />
                                                <FolderOpen size={14} className="icon-hover" />
                                            </span>
                                            IMPORT
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".json"
                                            onChange={handleImport}
                                            style={{ display: "none" }}
                                        />
                                    </div>
                                    <p className="settings-hint" style={{ marginTop: 8 }}>
                                        {entries?.length || 0} 条记录 · {tasks?.length || 0} 个任务
                                    </p>
                                </div>

                                {/* Cleanup Images */}
                                {cloudSync?.isLoggedIn && (
                                    <div>
                                        <div className="settings-section-label">STORAGE</div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm('确定要清理未引用的图片吗？此操作不可撤销。')) return;
                                                setIsCleaningUp(true);
                                                setCleanupResult(null);
                                                try {
                                                    const result = await cloudSync.cleanupImages();
                                                    setCleanupResult(result);
                                                } catch (error) {
                                                    setCleanupResult({ error: (error as Error).message });
                                                } finally {
                                                    setIsCleaningUp(false);
                                                }
                                            }}
                                            disabled={isCleaningUp}
                                            className="btn-action btn-action-secondary"
                                            style={{ width: "100%", justifyContent: "center" }}
                                        >
                                            <Trash2 size={14} />
                                            {isCleaningUp ? "清理中..." : "清理未使用的图片"}
                                        </button>
                                        {cleanupResult && (
                                            <p className={cleanupResult.error ? "settings-error" : "settings-hint"} style={{ marginTop: 8 }}>
                                                {cleanupResult.error
                                                    ? `错误: ${cleanupResult.error}`
                                                    : `已清理 ${cleanupResult.deletedCount} 张图片 (共 ${cleanupResult.totalImages} 张)`
                                                }
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
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
