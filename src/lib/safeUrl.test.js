import { describe, it, expect } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('safeHttpUrl', () => {
    it('accepts http and https URLs', () => {
        expect(safeHttpUrl('https://example.com/path')).toMatch(/^https:\/\/example\.com\//);
        expect(safeHttpUrl('http://example.com')).toMatch(/^http:\/\/example\.com\/?/);
    });

    it('rejects javascript and data schemes', () => {
        expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
        expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    });

    it('rejects URLs with credentials', () => {
        expect(safeHttpUrl('https://user:pass@example.com/')).toBeNull();
    });

    it('returns null for empty or invalid input', () => {
        expect(safeHttpUrl('')).toBeNull();
        expect(safeHttpUrl(null)).toBeNull();
        expect(safeHttpUrl('not a url')).toBeNull();
    });
});
