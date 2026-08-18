/**
 * Format a timestamp to HH:MM format
 */
export function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

/**
 * Format a timestamp to full date string
 */
export function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    })
}

/**
 * Format a session duration.
 *
 * Both callers render this into a narrow meta column beside the timeline, so
 * the result stays at most six characters and never carries two units below
 * the hour: `26m 50s` wrapped onto a second line, and the seconds on a session
 * that ran for half an hour were never the point. Sub-minute sessions still
 * report seconds, because there is nothing else to say about them.
 */
export function formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
        // Past ten hours the minutes are the same noise the seconds were, and
        // `10h 30m` is one character wider than the column can hold.
        if (hours >= 10) {
            return `${hours}h`
        }
        const remainingMinutes = minutes % 60
        return `${hours}h ${remainingMinutes}m`
    }

    if (minutes > 0) {
        return `${minutes}m`
    }

    return `${seconds}s`
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
