import React from 'react';
import { hasKnownPrice, formatMoney, priceAge } from '../lib/pricing';

/**
 * Unit price with its check date, e.g. "£84.88 per unit · checked Aug 2026".
 * Unknown prices (0/blank) read "Price unavailable"; checks older than PRICE_STALE_DAYS are flagged.
 * @param {{ item: { price?: number, priceCheckedAt?: string }, now?: Date }} props
 */
export default function PriceTag({ item, now }) {
    const known = hasKnownPrice(item);
    const age = known ? priceAge(item?.priceCheckedAt, now) : null;
    return (
        <span className="text-sm font-medium text-slate-600" data-testid="price-tag">
            {known ? `${formatMoney(item.price)} per unit` : 'Price unavailable'}
            {age && (
                <span
                    className={`ml-1 text-xs font-normal ${age.isStale ? 'text-amber-700' : 'text-slate-400'}`}
                    title={age.isStale ? 'This price was checked a while ago and may be out of date.' : undefined}
                >
                    · checked {age.label}
                    {age.isStale ? ' (may be out of date)' : ''}
                </span>
            )}
        </span>
    );
}
