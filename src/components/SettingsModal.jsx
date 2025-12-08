import { useState, useRef } from "react";
import { Settings, Download, Upload, Check, FolderOpen, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useTheme, ACCENT_COLORS } from "../hooks/useTheme.jsx";

export function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  categories,
  onAddCategory,
  onDeleteCategory,
  onResetCategories,
  entries,
  tasks,
  onImportData,
  cloudSync,
}) {
  const [key, setKey] = useState(apiKey || "");
  const [saved, setSaved] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#7aa2f7");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudLoginError, setCloudLoginError] = useState("");
  const { theme, setAccent, setStyle, availableStyles } = useTheme();
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(key);
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
      setNewCatColor("#7aa2f7");
    }
  };

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
      tasks,
      categories,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-backup-${new Date().toISOString().split("T")[0]}.json`;
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
        if (data.entries && Array.isArray(data.entries)) {
          onImportData(data);
          alert("导入成功！");
        } else {
          alert("无效的备份文件格式");
        }
      } catch (err) {
        alert("导入失败：" + err.message);
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
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          pointerEvents: "none",
        }}
      >
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
          {/* Header */}
          <div
            className="flex-between"
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
              userSelect: "none",
            }}
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
            <button
              onClick={onClose}
              className="edit-modal-close"
              style={{ fontSize: 20 }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: 20 }} className="space-y-5">
            {/* Theme Style */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                THEME STYLE
              </div>
              <div className="flex flex-wrap gap-2">
                {availableStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setStyle(style.id)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      borderRadius: 4,
                      cursor: "pointer",
                      backgroundColor:
                        theme.style === style.id
                          ? "var(--accent)"
                          : "var(--bg-secondary)",
                      color:
                        theme.style === style.id
                          ? "white"
                          : "var(--text-secondary)",
                      border:
                        theme.style === style.id
                          ? "1px solid var(--accent)"
                          : "1px solid var(--border-light)",
                      transition: "all 100ms ease",
                    }}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                ACCENT COLOR
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                  <button
                    key={colorKey}
                    onClick={() => setAccent(colorKey)}
                    title={color.name}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      cursor: "pointer",
                      backgroundColor: color.value,
                      border:
                        theme.accent === colorKey
                          ? "2px solid var(--text-primary)"
                          : "2px solid transparent",
                      transition: "all 100ms ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    letterSpacing: "0.05em",
                  }}
                >
                  CATEGORIES
                </span>
                <button
                  onClick={onResetCategories}
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  RESET
                </button>
              </div>
              <div className="space-y-1 mb-3">
                {categories?.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3"
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: "var(--text-primary)",
                      }}
                    >
                      {cat.label}
                    </span>
                    <button
                      onClick={() => onDeleteCategory(cat.id)}
                      className="icon-btn"
                      style={{ width: 20, height: 20, opacity: 0.5 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
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
                <button
                  onClick={handleAddCategory}
                  className="edit-modal-btn-save"
                  style={{ height: 32, padding: "0 14px" }}
                >
                  +
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                API KEY
              </div>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Gemini API key..."
                className="edit-modal-input"
              />
              <p
                style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}
              >
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  Get from Google AI Studio →
                </a>
              </p>
            </div>

            {/* Cloud Sync */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                CLOUD SYNC
              </div>
              {cloudSync?.isLoggedIn ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2" style={{ padding: "8px 12px", backgroundColor: "var(--bg-secondary)", borderRadius: 4 }}>
                    <Cloud size={14} style={{ color: "var(--success)" }} />
                    <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>
                      已连接
                    </span>
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
                    <p style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      上次同步: {new Date(cloudSync.lastSynced).toLocaleTimeString()}
                    </p>
                  )}
                  {cloudSync.error && (
                    <p style={{ fontSize: 10, color: "var(--error)" }}>
                      错误: {cloudSync.error}
                    </p>
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
                  {cloudLoginError && (
                    <p style={{ fontSize: 10, color: "var(--error)" }}>
                      {cloudLoginError}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: "var(--text-dim)" }}>
                    部署后在 Cloudflare 设置 AUTH_PASSWORD 环境变量
                  </p>
                </div>
              )}
            </div>

            {/* Import/Export */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                DATA
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="btn-action btn-action-secondary btn-data-export"
                  style={{ flex: 1, justifyContent: "center", margin: "0 8px" }}
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
                  style={{ flex: 1, justifyContent: "center", margin: "0 8px" }}
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
              <p
                style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}
              >
                {entries?.length || 0} 条记录 · {tasks?.length || 0} 个任务
              </p>
            </div>
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
            <span
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                userSelect: "none",
              }}
            >
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
