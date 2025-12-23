/**
 * Content parsing utilities for timeline entries
 * Handles markdown-like syntax and URL linkification
 */

import React from 'react';

/**
 * Parse inline markdown: **bold**, `code`, ==highlight==, ~~strikethrough~~, URLs
 */
export function parseInlineMarkdown(text: string, keyPrefix: string = ''): React.ReactNode[] {
  if (!text) return [];

  // Combined regex for all inline patterns
  const inlineRegex = /(\*\*[^*]+\*\*|`[^`]+`|==[^=]+=\s*=|~~[^~]+~~|https?:\/\/[^\s]+)/g;
  const parts = text.split(inlineRegex);

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return React.createElement('strong', { key, className: 'md-bold' }, part.slice(2, -2));
    }

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      return React.createElement('code', { key, className: 'md-inline-code' }, part.slice(1, -1));
    }

    // Highlight: ==text==
    if (part.startsWith('==') && part.endsWith('==')) {
      return React.createElement('mark', { key, className: 'md-highlight' }, part.slice(2, -2));
    }

    // Strikethrough: ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return React.createElement('del', { key, className: 'md-strikethrough' }, part.slice(2, -2));
    }

    // URL
    if (part.match(/^https?:\/\//)) {
      return React.createElement('a', {
        key,
        href: part,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: { color: 'var(--accent)', wordBreak: 'break-all' },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      }, part);
    }

    return part;
  });
}

interface HeadingContent {
  level: 1 | 2 | 3;
  text: React.ReactNode[];
}

interface ContentParseResult {
  type: 'text' | 'image' | 'location' | 'blockquote' | 'heading' | 'codeblock';
  content: React.ReactNode | HeadingContent | string;
  key: string;
}

/**
 * Parse content with markdown-like syntax
 * Supports: code blocks, images, locations, blockquotes, headings
 */
export function parseContent(text: string): ContentParseResult[] {
  if (!text) return [];

  // Pre-process: split inline image/location markers onto separate lines
  // This handles mobile uploads where the newline before 🖼️ or 📍 is missing
  let processedText = text;
  // Match 🖼️ or 🖼 (with or without variation selector) followed by a URL
  processedText = processedText.replace(/\s+(🖼[\uFE0E\uFE0F]?\s*https?:\/\/)/g, '\n$1');
  // Match 📍 or 📍 (with or without variation selector) followed by location text
  processedText = processedText.replace(/\s+(📍[\uFE0E\uFE0F]?\s*[^\n]+)/g, '\n$1');

  const lines = processedText.split('\n');
  const result: ContentParseResult[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const key = `line-${lineIdx}`;

    // Code block start/end: ```
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
      } else {
        result.push({
          type: 'codeblock',
          content: codeBlockLines.join('\n'),
          key: `code-${lineIdx}`,
        });
        inCodeBlock = false;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Image line: 🖼️ url (robust matching for mobile - handles variation selectors)
    // The frame emoji can be 🖼 (U+1F5BC) or 🖼️ (with variation selector U+FE0F)
    const trimmedLine = line.trim();
    const imageMatch = trimmedLine.match(/^🖼[\uFE0E\uFE0F]?\s*(.+)$/);
    if (imageMatch) {
      result.push({
        type: 'image',
        content: imageMatch[1].trim(),
        key,
      });
      continue;
    }

    // Location line: 📍 location (robust matching for mobile)
    const locationMatch = trimmedLine.match(/^📍[\uFE0E\uFE0F]?\s*(.+)$/);
    if (locationMatch) {
      result.push({
        type: 'location',
        content: locationMatch[1].trim(),
        key,
      });
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('> ')) {
      result.push({
        type: 'blockquote',
        content: parseInlineMarkdown(line.slice(2), key),
        key,
      });
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      result.push({
        type: 'heading',
        content: { level: 3, text: parseInlineMarkdown(line.slice(4), key) },
        key,
      });
      continue;
    }
    if (line.startsWith('## ')) {
      result.push({
        type: 'heading',
        content: { level: 2, text: parseInlineMarkdown(line.slice(3), key) },
        key,
      });
      continue;
    }
    if (line.startsWith('# ')) {
      result.push({
        type: 'heading',
        content: { level: 1, text: parseInlineMarkdown(line.slice(2), key) },
        key,
      });
      continue;
    }

    // Regular line with inline markdown
    result.push({
      type: 'text',
      content: parseInlineMarkdown(line, key),
      key,
    });
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    result.push({
      type: 'codeblock',
      content: codeBlockLines.join('\n'),
      key: 'code-unclosed',
    });
  }

  return result;
}

/**
 * Darken a hex color for light mode visibility
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (num >> 16) - Math.round((255 * percent) / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round((255 * percent) / 100));
  const b = Math.max(0, (num & 0xff) - Math.round((255 * percent) / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get preview text from content (first line, truncated)
 */
export function getPreview(content: string, maxLength: number = 40): string {
  if (!content) return '(empty)';
  const firstLine = content.split('\n')[0];
  return firstLine.length > maxLength ? firstLine.slice(0, maxLength) + '...' : firstLine;
}
