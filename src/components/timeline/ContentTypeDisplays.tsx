import { memo, MouseEvent, ReactNode } from 'react';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic, Dumbbell, HeartPulse, StretchHorizontal, Shuffle, Home, Building2, Warehouse } from 'lucide-react';
import type { BookmarkFields, MoodFields, WorkoutFields } from '../../types';

interface BookmarkDisplayProps {
  fieldValues: BookmarkFields | null | undefined;
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

  // Extract YouTube video ID from various URL formats
  const getYouTubeVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');

      if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
        // Regular youtube.com/watch?v=ID format
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;

        // youtube.com/embed/ID or youtube.com/v/ID format
        const pathMatch = urlObj.pathname.match(/^\/(embed|v)\/([^/?]+)/);
        if (pathMatch) return pathMatch[2];
      } else if (hostname === 'youtu.be') {
        // Short youtu.be/ID format
        const pathMatch = urlObj.pathname.match(/^\/([^/?]+)/);
        if (pathMatch) return pathMatch[1];
      }
    } catch {
      // Invalid URL
    }
    return null;
  };

  const youtubeVideoId = fieldValues.url ? getYouTubeVideoId(fieldValues.url) : null;
  const thumbnailUrl = youtubeVideoId
    ? `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`
    : null;

  return (
    <a
      href={fieldValues.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        marginTop: 6,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        width: 'fit-content',
        maxWidth: '100%',
      }}
    >
      {/* YouTube Thumbnail on top */}
      {thumbnailUrl && (
        <div style={{
          position: 'relative',
          width: 200,
          aspectRatio: '16/9',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          borderBottom: 'none',
        }}>
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* Play icon */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 0,
              height: 0,
              borderLeft: '10px solid white',
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              marginLeft: 2,
            }} />
          </div>
        </div>
      )}

      {/* Bookmark card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.2s ease',
          width: thumbnailUrl ? 200 : 'fit-content',
          boxSizing: 'border-box',
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

        {!thumbnailUrl && fieldValues.url && (
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
      </div>
    </a>
  );
});

interface MoodDisplayProps {
  fieldValues: MoodFields | null | undefined;
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
      'Excited': '🤩',
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
      {fieldValues.energy != null && (
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

interface Exercise {
  name: string;
  weight?: number;
  sets?: number;
  reps?: number | string;
}

interface WorkoutFieldValues {
  workoutType?: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed';
  place?: 'Home' | 'In Building Gym' | 'Outside Gym';
  duration?: number;
  exercises?: string | Exercise[];
}

interface WorkoutDisplayProps {
  fieldValues: WorkoutFieldValues | null | undefined;
}

/**
 * Display component for workout entries - full width card with exercises
 */
export const WorkoutDisplay = memo(function WorkoutDisplay({ fieldValues }: WorkoutDisplayProps) {
  if (!fieldValues) return null;

  const { workoutType, place, duration, exercises } = fieldValues;

  // Parse exercises if it's a JSON string
  let exerciseList: Exercise[] = [];
  if (exercises) {
    if (typeof exercises === 'string') {
      try {
        exerciseList = JSON.parse(exercises);
      } catch {
        // If not valid JSON, treat as single exercise name
        exerciseList = [{ name: exercises }];
      }
    } else {
      exerciseList = exercises;
    }
  }

  const iconSize = 13;

  const getTypeIcon = (type: string | undefined): ReactNode => {
    switch (type) {
      case 'Strength': return <Dumbbell size={iconSize} />;
      case 'Cardio': return <HeartPulse size={iconSize} />;
      case 'Flexibility': return <StretchHorizontal size={iconSize} />;
      case 'Mixed': return <Shuffle size={iconSize} />;
      default: return <Dumbbell size={iconSize} />;
    }
  };

  const getPlaceIcon = (p: string | undefined): ReactNode | null => {
    switch (p) {
      case 'Home': return <Home size={iconSize} />;
      case 'In Building Gym': return <Building2 size={iconSize} />;
      case 'Outside Gym': return <Warehouse size={iconSize} />;
      default: return null;
    }
  };

  const formatExercise = (ex: Exercise) => {
    const parts = [ex.name];
    if (ex.weight) parts.push(`${ex.weight}kg`);
    if (ex.sets && ex.reps) parts.push(`${ex.sets}×${ex.reps}`);
    else if (ex.reps) parts.push(`${ex.reps}`);
    return parts.join(' ');
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: '10px 14px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        width: '100%',
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: exerciseList.length > 0 ? 8 : 0,
      }}>
        <span style={{
          color: 'var(--accent)',
          fontWeight: 600,
          fontSize: 11,
        }}>
          [WORKOUT]
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}>
          {getTypeIcon(workoutType)}
          <span style={{ fontWeight: 500 }}>{workoutType || 'Strength'}</span>
        </span>
        {place && (
          <>
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
              {getPlaceIcon(place)}
              {place}
            </span>
          </>
        )}
      </div>

      {/* Exercises row - inline */}
      {exerciseList.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          color: 'var(--text-secondary)',
          fontSize: 11,
        }}>
          {exerciseList.map((ex, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              {formatExercise(ex)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

// Media field values interface
interface MediaFields {
  mediaId?: string;
  // Legacy fields for backward compatibility
  mediaType?: string;
  title?: string;
}

interface MediaDisplayProps {
  fieldValues: MediaFields | null | undefined;
  mediaItems?: Array<{
    id: string;
    title: string;
    mediaType: string;
    notionUrl?: string;
  }>;
}

/**
 * Display component for media entries (books, movies, games, etc.)
 * Resolves mediaId from Media Library if available
 */
export const MediaDisplay = memo(function MediaDisplay({ fieldValues, mediaItems = [] }: MediaDisplayProps) {
  if (!fieldValues) return null;

  // Resolve media item from library
  const mediaItem = fieldValues.mediaId
    ? mediaItems.find(m => m.id === fieldValues.mediaId)
    : null;

  // Use resolved media item or fall back to legacy fields
  const mediaType = mediaItem?.mediaType || fieldValues.mediaType;
  const title = mediaItem?.title || fieldValues.title;
  const notionUrl = mediaItem?.notionUrl;

  const iconStyle = { width: 14, height: 14, strokeWidth: 2 };

  const getMediaIcon = (type: string | undefined) => {
    switch (type) {
      case 'Book':
        return <Book {...iconStyle} />;
      case 'Movie':
        return <Film {...iconStyle} />;
      case 'Game':
        return <Gamepad2 {...iconStyle} />;
      case 'TV':
        return <Tv {...iconStyle} />;
      case 'Anime':
        return <Clapperboard {...iconStyle} />;
      case 'Podcast':
        return <Mic {...iconStyle} />;
      default:
        return <Film {...iconStyle} />;
    }
  };

  const getMediaLabel = (type: string | undefined) => {
    const labels: Record<string, string> = {
      'Book': 'BOOK',
      'Movie': 'MOVIE',
      'Game': 'GAME',
      'TV': 'TV SHOW',
      'Anime': 'ANIME',
      'Podcast': 'PODCAST',
    };
    return labels[type || ''] || 'MEDIA';
  };

  const handleClick = () => {
    if (notionUrl) {
      window.open(notionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={notionUrl ? handleClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        padding: '8px 12px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        width: 'fit-content',
        maxWidth: '100%',
        cursor: notionUrl ? 'pointer' : 'default',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (notionUrl) {
          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
      }}
    >
      <span style={{
        color: 'var(--accent)',
        fontWeight: 600,
        fontSize: 11,
        flexShrink: 0
      }}>
        [{getMediaLabel(mediaType)}]
      </span>

      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
        {getMediaIcon(mediaType)}
      </span>

      {title && (
        <span style={{
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
      )}

      {notionUrl && (
        <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 4 }}>
          ↗
        </span>
      )}
    </div>
  );
});
