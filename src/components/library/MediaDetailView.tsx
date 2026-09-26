import React, { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, Image } from 'lucide-react';
import { getMediaIcon } from '@/utils/mediaHelpers';
import type { MediaItem } from '@/types';
import { MetadataTable } from './MetadataTable';
import { MediaEditForm } from './MediaEditForm';
import { LinkedEntries } from './LinkedEntries';
import { useLinkedEntries } from '@/hooks/useLinkedEntries';
import type { UseLibraryFormReturn } from '@/hooks/useLibraryForm';
import styles from './MediaDetailView.module.css';

// Helper to reliably format any spotify link (open.spotify.com/...) into the widget embed url
function formatSpotifyEmbedUrl(url: string): string {
  try {
    const rawUrl = new URL(url);
    if (rawUrl.hostname === 'open.spotify.com') {
      const parts = rawUrl.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        // e.g. ['track', '123456']
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}?utm_source=generator&theme=0&autoplay=1`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

type DetailTab = 'notes' | 'logs';

interface MediaDetailViewProps {
  item: MediaItem;
  form: UseLibraryFormReturn;
}

export function MediaDetailView({ item, form }: MediaDetailViewProps) {
  const isEditingThis = form.editingId === item.id;
  const linked = useLinkedEntries(item.id);
  // Open on whichever side has something to read
  const [tab, setTab] = useState<DetailTab>(() =>
    !item.notes && linked.length > 0 ? 'logs' : 'notes'
  );

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'notes', label: 'NOTES' },
    { id: 'logs', label: 'LOGS', count: linked.length },
  ];

  return (
    <div className={styles.overlay}>
      {/* Immersive background */}
      {item.coverUrl && (
        <div className={styles.backgroundBlur} style={{ backgroundImage: `url(${item.coverUrl})` }} />
      )}
      <div className={styles.backgroundGradient} />

      {/* Header */}
      <header className={styles.detailHeader}>
        <button
          onClick={() => {
            if (isEditingThis) form.cancelEdit();
            form.setExpandedId(null);
          }}
          className={styles.detailBackBtn}
          title="Back to library"
        >
          <ArrowLeft size={18} />
        </button>
        <div className={styles.detailHeaderInfo}>
          <div className={styles.detailHeaderType}>
            <span className={styles.detailHeaderIcon}>{getMediaIcon(item.mediaType, 13)}</span>
            <span className={styles.detailHeaderLabel}>
              {item.mediaType.toUpperCase()}
            </span>
          </div>
        </div>
        <div className={styles.detailHeaderActions}>
          <button
            onClick={() => form.startEdit(item)}
            className={`icon-btn ${styles.detailActionBtn}`}
            title="Edit Media"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => { form.setExpandedId(null); form.setDeleteConfirmId(item.id); }}
            className={`icon-btn ${styles.detailActionBtn}`}
            title="Delete Media"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className={`${styles.scrollArea} ${isEditingThis ? '' : styles.scrollAreaPinned}`}>
        {isEditingThis ? (
          <MediaEditForm form={form} />
        ) : (
          <div className={styles.detailLayout}>
            {/* LEFT: Cover & Specs */}
            <div className={styles.coverColumn}>
              <div className={styles.coverImage}>
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt={item.title} className={styles.coverImg} />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    <Image size={32} />
                  </div>
                )}
              </div>
              <MetadataTable item={item} />

              {/* Spotify Embed */}
              {item.spotifyUrl && (
                <div className={styles.spotifyEmbed}>
                  <iframe
                    src={formatSpotifyEmbedUrl(item.spotifyUrl)}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    scrolling="no"
                    style={{ display: 'block', borderRadius: '12px', border: 'none', overflow: 'hidden' }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title="Spotify Player"
                  ></iframe>
                </div>
              )}
            </div>

            {/* RIGHT: Title + tabs stay put; only the active panel scrolls */}
            <div className={styles.infoColumn}>
              <h1 className={styles.title}>{item.title}</h1>

              <div className={styles.tabBar} role="tablist" aria-label="Notes and logs">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`media-tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls="media-tab-panel"
                    onClick={() => setTab(t.id)}
                    className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                  >
                    <span className={styles.tabLabel}>{t.label}</span>
                    {t.count !== undefined && t.count > 0 && (
                      <span className={styles.tabCount}>{t.count}</span>
                    )}
                  </button>
                ))}
                <div className={styles.notesLine} />
              </div>

              <div
                key={tab}
                id="media-tab-panel"
                role="tabpanel"
                aria-labelledby={`media-tab-${tab}`}
                className={styles.tabPanel}
              >
                {tab === 'notes' ? (
                  <div className={styles.notesContent}>
                    {item.notes ? item.notes : (
                      <span className={styles.notesEmpty}>No notes yet.</span>
                    )}
                  </div>
                ) : (
                  <LinkedEntries
                    linked={linked}
                    onNavigateAway={() => form.setExpandedId(null)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
