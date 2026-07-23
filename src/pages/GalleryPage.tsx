import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useUIStateContext } from '@/hooks/useUIStateContext';
import { extractImages, thumbUrl, TimelineImage } from '@/utils/imageExtractor';
import { formatDate, formatTime } from '@/utils/formatters';
import { ContentRenderer } from '@/components/timeline/ContentRenderer';
import { ImageLightbox } from '@/components/common/ImageLightbox';
import styles from './GalleryPage.module.css';

/**
 * GalleryPage — photo wall of every image across all entries.
 * Clicking a photo opens the entry it belongs to, with a jump link
 * to that day's timeline.
 */
export function GalleryPage() {
    const navigate = useNavigate();
    const ui = useUIStateContext();
    const { timelineItems: entries } = useSessionContext();
    const [selected, setSelected] = useState<TimelineImage | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const images = useMemo(() => extractImages(entries), [entries]);

    const jumpToTimeline = (item: TimelineImage) => {
        setSelected(null);
        navigate('/');
        ui.navigateToEntry(item.item);
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button onClick={() => navigate('/')} className={styles.backBtn} title="Back">
                    <ArrowLeft size={18} />
                </button>
                <span className={styles.title}>GALLERY</span>
                <span className={styles.count}>{images.length} photos</span>
            </div>

            {images.length === 0 ? (
                <div className={styles.empty}>No photos yet — attach images to entries and they show up here.</div>
            ) : (
                <div className={styles.grid}>
                    {images.map((item, i) => (
                        <button
                            key={`${item.item.id}-${i}`}
                            className={styles.cell}
                            onClick={() => setSelected(item)}
                        >
                            <img
                                src={thumbUrl(item.url)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                    // Old uploads have no .thumb object — fall
                                    // back to the original (once, no retry loop)
                                    const img = e.currentTarget;
                                    if (img.src.endsWith('.thumb')) img.src = item.url;
                                }}
                            />
                            <span className={styles.cellDate}>{formatDate(item.item.timestamp)}</span>
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div className={styles.overlay} onClick={() => setSelected(null)}>
                    <div className={styles.detail} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.detailHeader}>
                            <span className={styles.detailDate}>
                                {formatDate(selected.item.timestamp)} · {formatTime(selected.item.timestamp)}
                            </span>
                            <button onClick={() => setSelected(null)} className={styles.detailClose}>×</button>
                        </div>
                        <div className={styles.detailBody}>
                            <ContentRenderer content={selected.item.content} onImageClick={setLightboxImage} />
                        </div>
                        <div className={styles.detailFooter}>
                            <button onClick={() => jumpToTimeline(selected)} className={styles.jumpBtn}>
                                <CalendarDays size={13} />
                                VIEW IN TIMELINE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightboxImage && (
                <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
            )}
        </div>
    );
}
