import { describe, expect, it } from 'vitest';
import { noteObjectToRow, sessionObjectToRow } from './_db.ts';

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

    it('persists zaddy origin without inventing it for user notes', () => {
        expect(noteObjectToRow({ ...base, origin: 'zaddy' }).origin).toBe('zaddy');
        expect(noteObjectToRow(base).origin).toBeNull();
    });

    it('persists zaddy origin on sessions', () => {
        expect(sessionObjectToRow({
            id: 's1',
            content: 'observed topic',
            startAt: 1,
            endAt: 2,
            origin: 'zaddy',
        }).origin).toBe('zaddy');
    });
});
