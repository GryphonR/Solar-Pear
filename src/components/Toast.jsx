import React from 'react';
import { XIcon } from './Icons';

const variantStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function Toast({ message, variant = 'info', onClose }) {
    if (!message) return null;

    const styles = variantStyles[variant] || variantStyles.info;

    return (
        <div
            role="alert"
            className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border shadow-sm ${styles}`}
        >
            <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
            <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded hover:opacity-80 transition-opacity flex-shrink-0"
                aria-label="Dismiss"
            >
                <XIcon size={18} />
            </button>
        </div>
    );
}
