import { useState, useRef } from "react";
import { Settings, Download, Upload, Check, FolderOpen, Cloud, CloudOff, RefreshCw, Palette, Sparkles, Database } from "lucide-react";
import { useTheme, ACCENT_COLORS } from "../hooks/useTheme.jsx";

const TABS = [
  { id: "appearance", label: "外观", icon: Palette },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "sync", label: "同步", icon: Database },
];

export function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  aiBaseUrl,
  aiModel,
  onSaveAIConfig,
  categories,
  onAddCategory,
  onDeleteCategory,
  onResetCategories,
  entries,
  tasks,
  onImportData,
  cloudSync,
}) {
  const [activeTab, setActiveTab] = useState("appearance");
  const [key, setKey] = useState(apiKey || "");
  const [baseUrl, setBaseUrl] = useState(aiBaseUrl || "https://api.openai.com/v1");
  const [model, setModel] = useState(aiModel || "gpt-4o-mini");
  const [saved, setSaved] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#7aa2f7");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudLoginError, setCloudLoginError] = useState("");
  const { theme, setAccent, setStyle, availableStyles } = useTheme();
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveAIConfig({ apiKey: key, aiBaseUrl: baseUrl, aiModel: model });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAddCategory = () => {
    if (newCatLabel.trim()) {
      onAddCategory(newCatLabel.trim(), newCatColor);
      setNewCatLabel("");
    }
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

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
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

  // Tab content components
  const AppearanceTab = () => (
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
              onClick={() => setAccent(colorKey)}
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

      {/* Categories */}
      <div>
        <div className="flex-between" style={{ marginBottom: 8 }}>
          <span className="settings-section-label" style={{ marginBottom: 0 }}>CATEGORIES</span>
          <button onClick={onResetCategories} className="settings-reset-btn">RESET</button>
        </div>
        <div className="space-y-1 mb-3">
          {categories?.map((cat) => (
            <div key={cat.id} className="settings-category-item">
              <span className="settings-category-dot" style={{ backgroundColor: cat.color }} />
              <span className="settings-category-label">{cat.label}</span>
              <button onClick={() => onDeleteCategory(cat.id)} className="settings-category-delete">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="settings-color-picker"
          />
          <input
            type="text"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            placeholder="New category..."
            className="edit-modal-input"
            style={{ flex: 1, height: 32 }}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          />
          <button onClick={handleAddCategory} className="edit-modal-btn-save" style={{ height: 32, padding: "0 14px" }}>+</button>
        </div>
      </div>
    </div>
  );

  const AITab = () => (
    <div className="space-y-4">
      <div className="settings-section-label">AI SETTINGS (OpenAI Compatible)</div>

      {/* Base URL */}
      <div>
        <label className="settings-input-label">Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="edit-modal-input"
        />
      </div>

      {/* Model */}
      <div>
        <label className="settings-input-label">Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini"
          className="edit-modal-input"
        />
      </div>

      {/* API Key */}
      <div>
        <label className="settings-input-label">API Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-..."
          className="edit-modal-input"
        />
      </div>

      <p className="settings-hint">
        Supports OpenAI, DeepSeek, Claude, or any OpenAI-compatible API.
        <br />
        Used for auto-categorizing your entries.
      </p>
    </div>
  );

  const SyncTab = () => (
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && cloudPassword) {
                  cloudSync?.login(cloudPassword).then(result => {
                    if (!result.success) {
                      setCloudLoginError(result.error);
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
                  if (!result.success) {
                    setCloudLoginError(result.error);
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
    </div>
  );

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
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "ai" && <AITab />}
            {activeTab === "sync" && <SyncTab />}
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
              className="edit-modal-btn-save"
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
