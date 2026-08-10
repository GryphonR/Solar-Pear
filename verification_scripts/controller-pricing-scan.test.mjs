/**
 * @file controller-pricing-scan.test.mjs
 * Unit tests for controller relevance / plausibility gates used by the pricing scan.
 */

import { describe, expect, it } from 'vitest';
import {
    getControllerModel,
    identifierLooksRelevant,
    modelTokens,
    needsPriceCheck,
    priceLooksPlausible,
    titleLooksRelevant,
} from './controller-pricing-scan.js';

describe('getControllerModel', () => {
    it('prefers the display name over an opaque order-code modelNumber', () => {
        expect(
            getControllerModel({
                modelNumber: 'SCC075015060R',
                name: 'SmartSolar MPPT 75/15',
            })
        ).toBe('SmartSolar MPPT 75/15');
    });

    it('falls back to modelNumber when name is blank', () => {
        expect(getControllerModel({ modelNumber: 'SCC075015060R', name: '' })).toBe('SCC075015060R');
    });

    it('returns null when both are missing', () => {
        expect(getControllerModel({})).toBeNull();
    });
});

describe('modelTokens', () => {
    it('splits on non-alphanumeric and drops short tokens', () => {
        expect(modelTokens('MPPT 75/15')).toEqual(['mppt']);
        expect(modelTokens('SmartSolar-MPPT-100/50')).toEqual(['smartsolar', 'mppt', '100']);
    });
});

describe('identifierLooksRelevant', () => {
    it('accepts an exact order-code substring', () => {
        expect(
            identifierLooksRelevant(
                'victron smartsolar mppt 150/35 scc115035210',
                'SCC115035210'
            )
        ).toBe(true);
    });

    it('requires every digit run so 75/10 cannot match a 75/15 title', () => {
        expect(identifierLooksRelevant('victron smartsolar mppt 75/15', 'SmartSolar MPPT 75/10')).toBe(
            false
        );
        expect(identifierLooksRelevant('victron smartsolar mppt 75/10', 'SmartSolar MPPT 75/10')).toBe(
            true
        );
    });
});

describe('titleLooksRelevant', () => {
    it('matches a retailer title against the display name when modelNumber is an order code', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC075015060R',
            name: 'SmartSolar MPPT 75/15',
        };
        expect(titleLooksRelevant('Victron SmartSolar MPPT 75/15 Charge Controller', controller)).toBe(
            true
        );
    });

    it('still matches when the title only echoes the order code', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC115035210',
            name: 'SmartSolar MPPT 150/35',
        };
        expect(titleLooksRelevant('Victron SCC115035210 Solar Charge Controller', controller)).toBe(true);
    });

    it('accepts when every meaningful name token appears (reordered)', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC110050210',
            name: 'SmartSolar MPPT 100/50',
        };
        expect(titleLooksRelevant('Victron Energy 100/50 SmartSolar MPPT', controller)).toBe(true);
    });

    it('rejects a title missing the manufacturer', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC075015060R',
            name: 'SmartSolar MPPT 75/15',
        };
        expect(titleLooksRelevant('Generic SmartSolar MPPT 75/15 Charge Controller', controller)).toBe(
            false
        );
    });

    it('rejects a sibling SKU that only shares part of the rating', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC075010060R',
            name: 'SmartSolar MPPT 75/10',
        };
        expect(titleLooksRelevant('Victron SmartSolar MPPT 75/15 Charge Controller', controller)).toBe(
            false
        );
    });

    it('rejects a title that only shares a generic token like MPPT', () => {
        const controller = {
            manufacturer: 'Victron Energy',
            modelNumber: 'SCC075015060R',
            name: 'SmartSolar MPPT 75/15',
        };
        expect(titleLooksRelevant('Victron Energy MPPT Charge Controller', controller)).toBe(false);
    });

    it('returns false for an empty title', () => {
        expect(
            titleLooksRelevant('', {
                manufacturer: 'Solis',
                modelNumber: 'S6-EH1P5K-L',
                name: 'S6 5kW Hybrid',
            })
        ).toBe(false);
    });
});

describe('priceLooksPlausible', () => {
    it('rejects PRICE ONLY results even inside a type band', () => {
        expect(priceLooksPlausible(150, { type: 'charger' }, { hasBuyLink: false })).toBe(false);
    });

    it('accepts a charger price with a corroborating buy link', () => {
        expect(priceLooksPlausible(150, { type: 'charger' }, { hasBuyLink: true })).toBe(true);
    });

    it('rejects a charger price far above the band', () => {
        expect(priceLooksPlausible(5000, { type: 'charger' }, { hasBuyLink: true })).toBe(false);
    });

    it('accepts a hybrid inverter price in band', () => {
        expect(priceLooksPlausible(1150, { type: 'hybrid_inverter' }, { hasBuyLink: true })).toBe(true);
    });

    it('rejects a hybrid inverter priced like a charger accessory', () => {
        expect(priceLooksPlausible(25, { type: 'hybrid_inverter' }, { hasBuyLink: true })).toBe(false);
    });

    it('uses the default band when type is unknown', () => {
        expect(priceLooksPlausible(400, { type: 'mystery' }, { hasBuyLink: true })).toBe(true);
        expect(priceLooksPlausible(5, { type: 'mystery' }, { hasBuyLink: true })).toBe(false);
    });
});

describe('needsPriceCheck', () => {
    it('is true when never checked', () => {
        expect(needsPriceCheck({ price: 100, priceCheckedAt: '' })).toBe(true);
    });

    it('is false when checked recently and a price exists', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(needsPriceCheck({ price: 199, priceCheckedAt: today })).toBe(false);
    });
});
