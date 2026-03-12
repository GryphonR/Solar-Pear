import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, ChevronDown } from './Icons';

/** Smart buy button: disabled if no links, plain link if one, dropdown if many */
export default function BuyButton({ buyLinks = {} }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const entries = Object.entries(buyLinks).filter(
        ([, url]) => typeof url === 'string' && url.trim()
    );

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (entries.length === 0) {
        return (
            <button disabled className="inline-flex items-center justify-center w-7 h-7 rounded bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" title="No purchase links available">
                <ShoppingCart size={14} />
            </button>
        );
    }
    if (entries.length === 1) {
        return (
            <a href={entries[0][1]} target="_blank" rel="noopener noreferrer sponsored" title={`Buy from ${entries[0][0]}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors border border-emerald-700">
                <ShoppingCart size={14} />
            </a>
        );
    }
    return (
        <div className="relative inline-block" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                title="Multiple purchase options"
                className="inline-flex items-center justify-center h-7 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors border border-emerald-700"
            >
                <ShoppingCart size={14} /> <ChevronDown size={12} className={`ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {entries.map(([supplier, url]) => (
                        <a key={supplier} href={url} target="_blank" rel="noopener noreferrer sponsored"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                            <ShoppingCart size={12} />{supplier}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
