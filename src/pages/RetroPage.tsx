import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MessageSquareQuote, Shuffle } from 'lucide-react'
import { useSessionContext } from '@/contexts/SessionContext'
import { useUIStateContext } from '@/hooks/useUIStateContext'
import { ContentRenderer } from '@/components/timeline/ContentRenderer'
import { ImageLightbox } from '@/components/common/ImageLightbox'
import { formatTime } from '@/utils/formatters'
import { STORAGE_KEYS, getStorage, setStorage } from '@/utils/storageService'
import {
    MIN_AGE_DAYS,
    buildRetroPool,
    drawRetroCandidate,
    formatRetroAge,
    formatRetroAnniversary,
    type RetroCandidate,
} from '@/domain/retrospective'
import styles from './RetroPage.module.css'

/** How many recent draws to remember before an entry may repeat. */
const HISTORY_SIZE = 20

const KIND_LABEL: Record<string, string> = {
    'session-start': 'SESSION START',
    'session-end': 'SESSION END',
}

function formatFullDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

/**
 * RetroPage — draws one past entry at a time out of a weighted pool, so old
 * writing resurfaces instead of being buried by the timeline's recency order.
 */
export function RetroPage() {
    const navigate = useNavigate()
    const ui = useUIStateContext()
    const { timelineItems: entries, state: { contentTypes }, categories, commentIndex } = useSessionContext()
    const [current, setCurrent] = useState<RetroCandidate | null>(null)
    const [lightboxImage, setLightboxImage] = useState<string | null>(null)

    // Recent draws live in a ref so `draw` stays stable and never reads a
    // stale history through its closure.
    const historyRef = useRef<string[]>(getStorage<string[]>(STORAGE_KEYS.RETRO_HISTORY) ?? [])

    // Pinned at mount: the displayed count must not shift under a re-render.
    // Each draw reads a fresh clock of its own.
    const [mountedAt] = useState(() => Date.now())
    const poolSize = useMemo(
        () => buildRetroPool(entries, { now: mountedAt }).length,
        [entries, mountedAt],
    )

    const draw = useCallback(() => {
        const pool = buildRetroPool(entries, { now: Date.now(), excludeIds: historyRef.current })
        const next = drawRetroCandidate(pool)
        if (next) {
            historyRef.current = [
                next.item.id,
                ...historyRef.current.filter(id => id !== next.item.id),
            ].slice(0, HISTORY_SIZE)
            setStorage(STORAGE_KEYS.RETRO_HISTORY, historyRef.current)
        }
        setCurrent(next)
    }, [entries])

    // Draw once on mount. Deliberately not re-drawn when `entries` changes —
    // a background sync pull must not swap the card the user is reading.
    const hasDrawn = useRef(false)
    useEffect(() => {
        if (hasDrawn.current) return
        hasDrawn.current = true
        draw()
    }, [draw])

    // Space / → draws the next entry, so a session of reading needs no mouse.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== ' ' && e.key !== 'ArrowRight') return
            const target = e.target as HTMLElement | null
            if (target?.closest('input, textarea, [contenteditable="true"]')) return
            e.preventDefault()
            draw()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [draw])

    const jumpToTimeline = () => {
        if (!current) return
        navigate('/')
        ui.navigateToEntry(current.item)
    }

    const category = categories?.find(c => c.id === current?.item.category)
    const contentType = contentTypes?.find(ct => ct.id === current?.item.contentType)
    const anniversary = formatRetroAnniversary(current?.anniversary ?? null)
    const kindLabel = current ? KIND_LABEL[current.item.kind] : undefined
    // Resurfacing an old entry and reading what zaddy said about it are the
    // same act, so the card carries its comments rather than making the reader
    // jump to the timeline to find them.
    const comments = current ? commentIndex.get(current.item.entityId) : undefined

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button onClick={() => navigate('/')} className={styles.backBtn} title="Back">
                    <ArrowLeft size={18} />
                </button>
                <span className={styles.title}>RETROSPECTIVE</span>
                <span className={styles.count}>{poolSize} entries in pool</span>
            </div>

            <div className={styles.body}>
                {current ? (
                    <>
                        <article className={styles.card}>
                            <div className={styles.cardTop}>
                                <span className={styles.age}>{formatRetroAge(current.ageDays)}</span>
                                {anniversary && <span className={styles.anniversary}>{anniversary}</span>}
                                <span className={styles.date}>
                                    {formatFullDate(current.item.timestamp)} · {formatTime(current.item.timestamp)}
                                </span>
                            </div>

                            {(category || contentType || kindLabel || current.item.tags?.length) && (
                                <div className={styles.meta}>
                                    {kindLabel && <span className={`${styles.chip} ${styles.kind}`}>{kindLabel}</span>}
                                    {category && (
                                        <span className={styles.chip}>
                                            <span className={styles.chipDot} style={{ backgroundColor: category.color }} />
                                            {category.label}
                                        </span>
                                    )}
                                    {contentType && contentType.id !== 'note' && (
                                        <span className={styles.chip}>
                                            {contentType.icon && <span>{contentType.icon}</span>}
                                            {contentType.name}
                                        </span>
                                    )}
                                    {current.item.tags?.map(tag => (
                                        <span key={tag} className={styles.chip}>#{tag}</span>
                                    ))}
                                </div>
                            )}

                            <div className={styles.content}>
                                <ContentRenderer content={current.item.content} onImageClick={setLightboxImage} />
                            </div>

                            {comments && comments.length > 0 && (
                                <div className={styles.comments}>
                                    {comments.map(comment => (
                                        <div key={comment.id} className={styles.comment}>
                                            <div className={styles.commentMeta}>
                                                <MessageSquareQuote size={10} strokeWidth={1.75} aria-hidden="true" />
                                                <span>ZADDY</span>
                                                <span className={styles.commentDate}>
                                                    {formatFullDate(comment.timestamp)}
                                                </span>
                                            </div>
                                            <div className={styles.commentBody}>
                                                <ContentRenderer
                                                    content={comment.content}
                                                    onImageClick={setLightboxImage}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={styles.cardActions}>
                                <button onClick={draw} className={`${styles.action} ${styles.actionPrimary}`}>
                                    <Shuffle size={13} />
                                    DRAW ANOTHER
                                </button>
                                <button onClick={jumpToTimeline} className={styles.action}>
                                    <CalendarDays size={13} />
                                    VIEW IN TIMELINE
                                </button>
                            </div>
                        </article>

                        <div className={styles.hint}>
                            PRESS <span className={styles.kbd}>SPACE</span> OR <span className={styles.kbd}>→</span> TO DRAW AGAIN
                        </div>
                    </>
                ) : (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>NOTHING TO LOOK BACK ON YET</div>
                        <p className={styles.emptyHint}>
                            Entries join the pool once they are at least {MIN_AGE_DAYS} days old and
                            carry more than a passing marker. Keep writing — this fills itself in.
                        </p>
                    </div>
                )}
            </div>

            {lightboxImage && (
                <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
            )}
        </div>
    )
}
