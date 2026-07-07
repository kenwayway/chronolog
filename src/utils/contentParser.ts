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
  const inlineRegex = /(\*\*[^*]+\*\*|`[^`]+`|==[^=]+==|~~[^~]+~~|https?:\/\/[^\s]+)/g;

  // Walk actual regex matches instead of String.split(): split() would also
  // hand the untouched filler text between matches through the same
  // startsWith/endsWith check below, so plain text that merely *looks* like
  // a delimiter (e.g. two unrelated "==" in "a==b and c==d") got misrendered
  // as if it had matched.
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const part = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (part.startsWith('**')) {
      nodes.push(React.createElement('strong', { key, className: 'md-bold' }, part.slice(2, -2)));
    } else if (part.startsWith('`')) {
      nodes.push(React.createElement('code', { key, className: 'md-inline-code' }, part.slice(1, -1)));
    } else if (part.startsWith('==')) {
      nodes.push(React.createElement('mark', { key, className: 'md-highlight' }, part.slice(2, -2)));
    } else if (part.startsWith('~~')) {
      nodes.push(React.createElement('del', { key, className: 'md-strikethrough' }, part.slice(2, -2)));
    } else {
      // URL
      nodes.push(React.createElement('a', {
        key,
        href: part,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: { color: 'var(--accent)', wordBreak: 'break-all' },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      }, part));
    }

    lastIndex = match.index + part.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface HeadingContent {
  level: 1 | 2 | 3;
  text: React.ReactNode[];
}

export type TableAlign = 'left' | 'center' | 'right' | null;

export interface TableContent {
  headers: React.ReactNode[][];
  alignments: TableAlign[];
  rows: React.ReactNode[][][];
}

interface ContentParseResult {
  type: 'text' | 'image' | 'location' | 'blockquote' | 'heading' | 'codeblock' | 'table';
  content: React.ReactNode | HeadingContent | TableContent | string;
  key: string;
}

/** Split a `| a | b |` (or `a | b`, no outer pipes) row into trimmed cells */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

/** GFM-style separator row: `| --- | :---: | ---: |` */
function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed) && trimmed.includes('-');
}

function parseTableAlignment(separatorLine: string): TableAlign[] {
  return splitTableRow(separatorLine).map((cell): TableAlign => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

/**
 * Parse content with markdown-like syntax
 * Supports: code blocks, images, locations, blockquotes, headings, tables
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

    // Table: a row containing "|" followed by a "| --- | --- |" separator row
    if (trimmedLine.includes('|') && lineIdx + 1 < lines.length && isTableSeparatorRow(lines[lineIdx + 1])) {
      const alignments = parseTableAlignment(lines[lineIdx + 1]);
      const headers = splitTableRow(trimmedLine).map((cell, ci) => parseInlineMarkdown(cell, `${key}-h${ci}`));

      const rows: React.ReactNode[][][] = [];
      let bodyIdx = lineIdx + 2;
      while (bodyIdx < lines.length) {
        const bodyLine = lines[bodyIdx].trim();
        if (!bodyLine || !bodyLine.includes('|')) break;
        rows.push(splitTableRow(bodyLine).map((cell, ci) => parseInlineMarkdown(cell, `${key}-r${bodyIdx}-${ci}`)));
        bodyIdx++;
      }

      result.push({
        type: 'table',
        content: { headers, alignments, rows },
        key: `table-${lineIdx}`,
      });
      lineIdx = bodyIdx - 1;
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
