import { describe, expect, it } from 'vitest';
import { entryObjectToRow } from './_db.ts';

describe('entryObjectToRow', () => {
    const base = { id: 'e1', type: 'NOTE', content: 'hi', timestamp: 1000 };

    it('keeps a valid category', () => {
        expect(entryObjectToRow({ ...base, category: 'craft' }).category).toBe('craft');
    });

    it('drops an unknown category instead of storing it', () => {
        expect(entryObjectToRow({ ...base, category: 'not-a-category' }).category).toBeNull();
    });

    it('drops legacy category values (beans/sparks)', () => {
        expect(entryObjectToRow({ ...base, category: 'beans' }).category).toBeNull();
    });

    it('maps a missing category to null', () => {
        expect(entryObjectToRow(base).category).toBeNull();
    });
});
