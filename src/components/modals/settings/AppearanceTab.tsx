import type { Category } from '../../../types';
import { useTheme, ACCENT_COLORS, type AccentColorKey } from '../../../hooks/useTheme';

interface AppearanceTabProps {
    categories?: Category[];
}

/**
 * Appearance settings tab - theme style, accent color, and categories display
 */
export function AppearanceTab({ categories }: AppearanceTabProps) {
    const { theme, setAccent, setStyle, availableStyles } = useTheme();

    return (
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
                            onClick={() => setAccent(colorKey as AccentColorKey)}
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
    );
}
