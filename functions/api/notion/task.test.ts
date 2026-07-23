import { describe, expect, it } from 'vitest';
import { extractNotionTaskName } from './task.ts';

describe('extractNotionTaskName', () => {
    it('joins title fragments from the title property', () => {
        expect(extractNotionTaskName({
            properties: {
                Status: { type: 'status' },
                Task: {
                    type: 'title',
                    title: [{ plain_text: 'Ship ' }, { plain_text: 'Chronolog' }],
                },
            },
        })).toBe('Ship Chronolog');
    });

    it('falls back to text content and returns null for an empty title', () => {
        expect(extractNotionTaskName({
            properties: { Task: { type: 'title', title: [{ text: { content: 'Fallback' } }] } },
        })).toBe('Fallback');
        expect(extractNotionTaskName({ properties: {} })).toBeNull();
    });
});
