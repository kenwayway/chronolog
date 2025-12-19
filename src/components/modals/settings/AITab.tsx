import type { CloudSyncFull } from '../../../types';

interface AICommentConfig {
    hasApiKey: boolean;
    baseUrl: string;
    model: string;
    persona: string;
}

interface AITabProps {
    cloudSync?: CloudSyncFull;
    aiCommentConfig?: AICommentConfig | null;
    baseUrl: string;
    setBaseUrl: (url: string) => void;
    model: string;
    setModel: (model: string) => void;
    persona: string;
    setPersona: (persona: string) => void;
}

/**
 * AI settings tab - AI comment config and auto-categorization info
 */
export function AITab({
    cloudSync,
    aiCommentConfig,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    persona,
    setPersona,
}: AITabProps) {
    return (
        <div className="space-y-4">
            {/* AI Comment Config - requires Cloud Sync */}
            <div>
                <div className="settings-section-label">AI COMMENT CONFIG</div>

                {!cloudSync?.isLoggedIn ? (
                    <p className="settings-hint" style={{ color: "var(--warning)" }}>
                        ⚠ 需要先连接 Cloud Sync 才能使用 AI Comment
                    </p>
                ) : (
                    <>
                        {/* API Key status */}
                        {aiCommentConfig?.hasApiKey ? (
                            <p className="settings-hint" style={{ color: "var(--success)", marginBottom: 12 }}>
                                ✓ API Key 已配置（Cloudflare Secret）
                            </p>
                        ) : (
                            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "var(--bg-secondary)", borderRadius: 4 }}>
                                <p className="settings-hint" style={{ color: "var(--warning)", marginBottom: 8 }}>
                                    ⚠ API Key 未配置
                                </p>
                                <p className="settings-hint" style={{ fontSize: 11 }}>
                                    运行以下命令设置（加密存储）：
                                </p>
                                <code style={{
                                    display: "block",
                                    marginTop: 8,
                                    padding: "8px 10px",
                                    backgroundColor: "var(--bg-primary)",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--accent)"
                                }}>
                                    npx wrangler secret put AI_COMMENT_API_KEY
                                </code>
                            </div>
                        )}

                        {/* Non-sensitive config */}
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="API Base URL (默认: OpenAI)"
                                className="edit-modal-input"
                                style={{ width: "100%" }}
                            />
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="Model name (默认: gpt-4o-mini)"
                                className="edit-modal-input"
                                style={{ width: "100%" }}
                            />
                            <textarea
                                value={persona}
                                onChange={(e) => setPersona(e.target.value)}
                                placeholder="AI Persona (留空使用默认)&#10;&#10;默认：你是一个温暖、有洞察力的日记伙伴..."
                                className="edit-modal-input"
                                style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                            />
                        </div>
                    </>
                )}
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
    );
}
