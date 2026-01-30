import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Download, Upload, Check, FolderOpen, Cloud, CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import type { Entry, Category, CloudSyncFull, GoogleTasksStatus } from '../../../types';

interface ImportData {
    entries: Entry[];
    tasks: unknown[];
    categories?: Category[];
}

interface CleanupResult {
    deleted?: string[];
    kept?: string[];
    error?: string;
}

interface SyncTabProps {
    cloudSync?: CloudSyncFull;
    googleTasks?: GoogleTasksStatus;
    entries?: Entry[];
    tasks?: unknown[];
    categories?: Category[];
    onImportData: (data: ImportData) => void;
}

/**
 * Sync settings tab - cloud sync, Google Tasks, data import/export
 */
export function SyncTab({
    cloudSync,
    googleTasks,
    entries,
    tasks,
    categories,
    onImportData,
}: SyncTabProps) {
    const [cloudPassword, setCloudPassword] = useState("");
    const [cloudLoginError, setCloudLoginError] = useState("");
    const [isCleaningUp, setIsCleaningUp] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleCloudLogin = async () => {
        if (cloudPassword) {
            const result = await cloudSync?.login(cloudPassword);
            if (!result?.success) {
                setCloudLoginError(result?.error || "Login failed");
            } else {
                setCloudPassword("");
                setCloudLoginError("");
            }
        }
    };

    const handleCleanup = async () => {
        if (!confirm('确定要清理未引用的图片吗？此操作不可撤销。')) return;
        setIsCleaningUp(true);
        setCleanupResult(null);
        try {
            const result = await cloudSync?.cleanupImages();
            if (result) setCleanupResult(result);
        } catch (error) {
            setCleanupResult({ error: (error as Error).message });
        } finally {
            setIsCleaningUp(false);
        }
    };

    return (
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
                                    handleCloudLogin();
                                }
                            }}
                        />
                        <button
                            onClick={handleCloudLogin}
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
                        onClick={handleCleanup}
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
                                : `已清理 ${cleanupResult.deleted?.length ?? 0} 张图片 (共 ${(cleanupResult.deleted?.length ?? 0) + (cleanupResult.kept?.length ?? 0)} 张)`
                            }
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
