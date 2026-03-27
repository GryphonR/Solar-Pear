import React, { useEffect, useState } from 'react';
import Modal from '../Modal';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, checkbox }) {
    const [checked, setChecked] = useState(!!checkbox?.defaultChecked);

    useEffect(() => {
        if (open) {
            setChecked(!!checkbox?.defaultChecked);
        }
    }, [open, checkbox?.defaultChecked]);

    const handleConfirm = () => {
        onConfirm?.(checked);
        onCancel?.();
    };

    return (
        <Modal
            open={open}
            onClose={onCancel}
            title={title}
            maxWidth="max-w-sm"
            bodyScrollable={false}
            zIndex={100}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                    >
                        Confirm
                    </button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
                {checkbox && (
                    <label className="flex items-start gap-2 text-sm text-slate-700 select-none cursor-pointer">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span>{checkbox.label}</span>
                    </label>
                )}
            </div>
        </Modal>
    );
}
