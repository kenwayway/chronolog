import { memo, MouseEvent } from 'react';

interface ExpenseFieldValues {
    amount?: number;
    currency?: string;
    category?: string;
    subcategory?: string;
    expenseType?: string;
}

interface ExpenseDisplayProps {
    fieldValues: ExpenseFieldValues | null | undefined;
}

/**
 * Display component for expense entries
 */
export const ExpenseDisplay = memo(function ExpenseDisplay({ fieldValues }: ExpenseDisplayProps) {
    if (!fieldValues) return null;

    const { amount, currency, category, subcategory, expenseType } = fieldValues;
    const currencySymbols: Record<string, string> = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥' };
    const symbol = currencySymbols[currency || ''] || '$';
    const cat = category || expenseType || '';
    const sub = subcategory ? ` › ${subcategory}` : '';

    return (
        <span
            style={{
                fontSize: 11,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '2px 8px',
                fontWeight: 500,
                userSelect: 'none',
            }}
        >
            {`${symbol}${amount}${cat ? ` · ${cat}${sub}` : ''}`}
        </span>
    );
});

interface BookmarkFieldValues {
    url?: string;
    title?: string;
}

interface BookmarkDisplayProps {
    fieldValues: BookmarkFieldValues | null | undefined;
}

/**
 * Display component for bookmark entries
 */
export const BookmarkDisplay = memo(function BookmarkDisplay({ fieldValues }: BookmarkDisplayProps) {
    if (!fieldValues) return null;

    const getHostname = (url: string) => {
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
            onClick={(e: MouseEvent) => e.stopPropagation()}
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

interface MoodFieldValues {
    feeling?: string;
    energy?: number;
    trigger?: string;
}

interface MoodDisplayProps {
    fieldValues: MoodFieldValues | null | undefined;
}

/**
 * Display component for mood entries
 */
export const MoodDisplay = memo(function MoodDisplay({ fieldValues }: MoodDisplayProps) {
    if (!fieldValues) return null;

    const getMoodEmoji = (feeling: string | undefined) => {
        const emojis: Record<string, string> = {
            'Happy': '😄',
            'Calm': '😌',
            'Tired': '😴',
            'Anxious': '😰',
            'Sad': '😢',
            'Angry': '😠',
        };
        return emojis[feeling || ''] || '😐';
    };

    const getEnergyColor = (energy: number) => {
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
                                        backgroundColor: level <= fieldValues.energy!
                                            ? getEnergyColor(fieldValues.energy!)
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
