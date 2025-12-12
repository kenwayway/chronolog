import { memo } from 'react';

/**
 * Display component for expense entries
 */
export const ExpenseDisplay = memo(function ExpenseDisplay({ fieldValues }) {
    if (!fieldValues) return null;

    const { amount, currency, category, subcategory, expenseType } = fieldValues;
    const currencySymbols = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥' };
    const symbol = currencySymbols[currency] || '$';
    const cat = category || expenseType || '';
    const sub = subcategory ? ` › ${subcategory}` : '';

    return (
        <span
            style={{
                fontSize: 11,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '2px 8px',
                borderRadius: 3,
                fontWeight: 500,
                userSelect: 'none',
            }}
        >
            {`${symbol}${amount}${cat ? ` · ${cat}${sub}` : ''}`}
        </span>
    );
});

/**
 * Display component for bookmark entries
 */
export const BookmarkDisplay = memo(function BookmarkDisplay({ fieldValues }) {
    if (!fieldValues) return null;

    const getHostname = (url) => {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    };

    return (
        <a
            href={fieldValues.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                padding: '6px 10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s ease',
                width: 'fit-content',
                maxWidth: '100%',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
        >
            <span style={{
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: 11,
                flexShrink: 0
            }}>
                [MARK]
            </span>

            <span style={{
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {fieldValues.title || fieldValues.url || 'Untitled'}
            </span>

            {fieldValues.url && (
                <span style={{
                    color: 'var(--text-dim)',
                    fontSize: 11,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 150
                }}>
                    · {getHostname(fieldValues.url)}
                </span>
            )}
        </a>
    );
});

/**
 * Display component for mood entries
 */
export const MoodDisplay = memo(function MoodDisplay({ fieldValues }) {
    if (!fieldValues) return null;

    const getMoodEmoji = (feeling) => {
        const emojis = {
            'Happy': '😄',
            'Calm': '😌',
            'Tired': '😴',
            'Anxious': '😰',
            'Sad': '😢',
            'Angry': '😠',
        };
        return emojis[feeling] || '😐';
    };

    const getEnergyColor = (energy) => {
        if (energy >= 4) return 'var(--success)';
        if (energy >= 3) return 'var(--accent)';
        return 'var(--warning)';
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 8,
                padding: '8px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                width: 'fit-content',
            }}
        >
            <span style={{
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: 11,
                flexShrink: 0
            }}>
                [MOOD]
            </span>

            {/* Feeling */}
            <div className="flex items-center gap-2">
                <span style={{ fontSize: 18, lineHeight: 1 }}>
                    {getMoodEmoji(fieldValues.feeling)}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>
                    {fieldValues.feeling}
                </span>
            </div>

            {/* Energy */}
            {fieldValues.energy && (
                <>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
                    <div className="flex items-center gap-2" title={`Energy: ${fieldValues.energy}/5`}>
                        <div style={{ display: 'flex', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map(level => (
                                <div
                                    key={level}
                                    style={{
                                        width: 4,
                                        height: 8,
                                        borderRadius: 1,
                                        backgroundColor: level <= fieldValues.energy
                                            ? getEnergyColor(fieldValues.energy)
                                            : 'var(--text-dim)',
                                        opacity: 0.5,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Trigger */}
            {fieldValues.trigger && (
                <>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                        {fieldValues.trigger}
                    </span>
                </>
            )}
        </div>
    );
});
