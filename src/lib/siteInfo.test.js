import { describe, it, expect } from 'vitest';
import { dataCorrectionIssueUrl, REPO_URL } from './siteInfo';

describe('dataCorrectionIssueUrl', () => {
    it('prefills the data-correction form for a panel', () => {
        const url = new URL(dataCorrectionIssueUrl('panel', { name: 'Vertex S+ 430W', model: 'TSM-430NEG9R.28' }));
        expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
        expect(url.searchParams.get('template')).toBe('data-correction.yml');
        expect(url.searchParams.get('kind')).toBe('Panel');
        expect(url.searchParams.get('model')).toBe('Vertex S+ 430W (TSM-430NEG9R.28)');
        expect(url.searchParams.get('title')).toBe('[Data] Vertex S+ 430W: ');
    });

    it('uses the controller id and manufacturer for controllers', () => {
        const url = new URL(
            dataCorrectionIssueUrl('controller', { manufacturer: 'Victron', name: 'SmartSolar 100/30', id: 'ss100_30' })
        );
        expect(url.searchParams.get('kind')).toBe('Controller / inverter');
        expect(url.searchParams.get('model')).toBe('Victron SmartSolar 100/30 (ss100_30)');
    });

    it('does not repeat a brand the name already starts with', () => {
        const url = new URL(dataCorrectionIssueUrl('controller', { manufacturer: 'Deye', name: 'Deye SUN-5K', id: 'deye_5k' }));
        expect(url.searchParams.get('model')).toBe('Deye SUN-5K (deye_5k)');
    });
});
