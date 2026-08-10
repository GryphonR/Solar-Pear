import { describe, it, expect } from 'vitest';
import {
    NO_SERIES_LABEL,
    panelSeriesKey,
    compareByManufacturerSeriesPower,
    groupPanelsBySeries,
    manufacturerSeriesFilterValue,
    parseManufacturerSeriesFilterValue,
    isNoSeriesKey,
    seriesDesignNotes,
} from './panelSeries';

describe('panelSeriesKey', () => {
    it('returns trimmed series when present', () => {
        expect(panelSeriesKey({ 'panel-series': 'Vertex S+' })).toBe('Vertex S+');
        expect(panelSeriesKey({ 'panel-series': '  Hi-MO 6  ' })).toBe('  Hi-MO 6  ');
    });

    it('buckets empty, blank, null, and missing as no series', () => {
        expect(panelSeriesKey({ 'panel-series': '' })).toBe(NO_SERIES_LABEL);
        expect(panelSeriesKey({ 'panel-series': '   ' })).toBe(NO_SERIES_LABEL);
        expect(panelSeriesKey({ 'panel-series': null })).toBe(NO_SERIES_LABEL);
        expect(panelSeriesKey({})).toBe(NO_SERIES_LABEL);
    });
});

describe('compareByManufacturerSeriesPower', () => {
    it('orders by manufacturer, then series, then power, then model', () => {
        const panels = [
            { manufacturer: 'B', 'panel-series': 'A', power: 400, model: 'b2' },
            { manufacturer: 'A', 'panel-series': 'Z', power: 400, model: 'a1' },
            { manufacturer: 'A', 'panel-series': 'A', power: 450, model: 'a3' },
            { manufacturer: 'A', 'panel-series': 'A', power: 400, model: 'a2' },
            { manufacturer: 'A', 'panel-series': '', power: 300, model: 'a0' },
        ];
        const sorted = [...panels].sort(compareByManufacturerSeriesPower);
        expect(sorted.map((p) => p.model)).toEqual(['a0', 'a2', 'a3', 'a1', 'b2']);
    });
});

describe('groupPanelsBySeries', () => {
    it('groups by series key and sorts series alphabetically', () => {
        const panels = [
            { model: '1', 'panel-series': 'Beta', power: 400 },
            { model: '2', 'panel-series': 'Alpha', power: 420 },
            { model: '3', 'panel-series': '', power: 300 },
            { model: '4', 'panel-series': 'Alpha', power: 430 },
        ];
        const groups = groupPanelsBySeries(panels);
        expect(groups.map((g) => g.seriesKey)).toEqual([NO_SERIES_LABEL, 'Alpha', 'Beta']);
        expect(groups[1].panels.map((p) => p.model)).toEqual(['2', '4']);
    });
});

describe('manufacturerSeriesFilterValue', () => {
    it('round-trips composite manufacturer|series values', () => {
        const value = manufacturerSeriesFilterValue('JA Solar', 'Deepblue 3.0');
        expect(value).toBe('JA Solar|Deepblue 3.0');
        expect(parseManufacturerSeriesFilterValue(value)).toEqual({
            manufacturer: 'JA Solar',
            seriesKey: 'Deepblue 3.0',
        });
    });

    it('returns null for invalid parse input', () => {
        expect(parseManufacturerSeriesFilterValue('')).toBeNull();
        expect(parseManufacturerSeriesFilterValue('nosep')).toBeNull();
    });
});

describe('isNoSeriesKey', () => {
    it('flags only the no-series sentinel', () => {
        expect(isNoSeriesKey(NO_SERIES_LABEL)).toBe(true);
        expect(isNoSeriesKey('Vertex S+')).toBe(false);
    });
});

describe('seriesDesignNotes', () => {
    it('returns the shared note for a real series', () => {
        const panels = [
            { model: 'a', notes: 'Series-wide note.' },
            { model: 'b', notes: 'Series-wide note.' },
        ];
        expect(seriesDesignNotes('Vertex S+', panels)).toBe('Series-wide note.');
    });

    it('falls back to the first non-empty note if one entry is blank', () => {
        const panels = [
            { model: 'a', notes: '' },
            { model: 'b', notes: 'Series-wide note.' },
        ];
        expect(seriesDesignNotes('Vertex S+', panels)).toBe('Series-wide note.');
    });

    it('returns empty string for the no-series edge case, even if a panel has notes', () => {
        const panels = [{ model: 'a', notes: 'One-off panel note.' }];
        expect(seriesDesignNotes(NO_SERIES_LABEL, panels)).toBe('');
    });

    it('returns empty string when no panel has a note', () => {
        expect(seriesDesignNotes('Vertex S+', [{ model: 'a', notes: '' }])).toBe('');
    });
});
