import { describe, expect, it } from 'vitest';
import { noteObjectToRow } from './_db.ts';

describe('noteObjectToRow', () => {
    const base = { id: 'e1', content: 'hi', timestamp: 1000 };

    it('keeps a valid category', () => {
        expect(noteObjectToRow({ ...base, category: 'craft' }).category).toBe('craft');
    });

    it('drops an unknown category instead of storing it', () => {
        expect(noteObjectToRow({ ...base, category: 'not-a-category' }).category).toBeNull();
    });

    it('drops legacy category values (beans/sparks)', () => {
        expect(noteObjectToRow({ ...base, category: 'beans' }).category).toBeNull();
    });

    it('maps a missing category to null', () => {
        expect(noteObjectToRow(base).category).toBeNull();
    });
});
