/**
 * Tag Parser Utility
 * Extracts #tags from content and returns cleaned content + tag array
 */

/**
 * Parse tags from content string
 * @param content - Raw content with potential #tags
 * @returns Object with cleanContent (tags removed) and tags array
 */
export function parseTags(content: string): { cleanContent: string; tags: string[] } {
    if (!content) return { cleanContent: '', tags: [] };

    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    const tags: string[] = [];
    const matches = content.matchAll(tagRegex);

    for (const match of matches) {
        const tag = match[1].toLowerCase(); // Normalize to lowercase
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
    }

    // Remove tags from content
    const cleanContent = content.replace(tagRegex, '').replace(/\s+/g, ' ').trim();

    return { cleanContent, tags };
}

/**
 * Format tags array to display string
 * @param tags - Array of tag strings
 * @returns Formatted string like "#tag1 #tag2"
 */
export function formatTags(tags: string[]): string {
    if (!tags || tags.length === 0) return '';
    return tags.map(tag => `#${tag}`).join(' ');
}

/**
 * Extract unique tags from multiple entries
 * @param entries - Array of entries
 * @returns Sorted array of unique tags with counts
 */
export function extractAllTags(entries: Array<{ tags?: string[] }>): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();

    entries.forEach(entry => {
        if (entry.tags && Array.isArray(entry.tags)) {
            entry.tags.forEach((tag: string) => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        }
    });

    return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count); // Sort by count descending
}
