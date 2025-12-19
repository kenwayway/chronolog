import { memo, MouseEvent } from 'react';

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

interface Exercise {
  name: string;
  weight?: number;
  sets?: number;
  reps?: number | string;
}

interface WorkoutFieldValues {
  workoutType?: 'Strength' | 'Flexibility' | 'Mixed';
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

  const { workoutType, duration, exercises } = fieldValues;

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

  const getTypeIcon = (type: string | undefined) => {
    switch (type) {
      case 'Strength': return '💪';
      case 'Flexibility': return '🧘';
      case 'Mixed': return '🏋️';
      default: return '💪';
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
        <span style={{ fontSize: 14 }}>{getTypeIcon(workoutType)}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {workoutType || 'Strength'}
        </span>
        {duration && (
          <>
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <span style={{ color: 'var(--text-dim)' }}>{duration}min</span>
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
