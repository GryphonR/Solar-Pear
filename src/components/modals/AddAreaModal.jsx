import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

export default function AddAreaModal({ open, value, areas, onClose, onSave, onChange }) {
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const trimmed = (value || '').trim();
    const isDuplicate = trimmed && areas.some((a) => a.toLowerCase() === trimmed.toLowerCase());
    const isInvalid = !trimmed || isDuplicate;

    const handleSave = () => {
        if (!trimmed) {
            setError('Please enter an area name.');
            return;
        }
        if (areas.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
            setError(`An Area named "${trimmed}" already exists.`);
            return;
        }
        onSave(trimmed);
        onClose();
    };

    const handleChange = (newValue) => {
        setError(null);
        onChange(newValue);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add New Area"
            maxWidth="max-w-md"
            bodyScrollable={false}
            footer={
                <>
                    {error && (
                        <p className="text-red-600 text-sm mr-auto" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isInvalid}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Area
                    </button>
                </>
            }
        >
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Area Name</label>
                <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Outbuilding, Cabin"
                    className="w-full p-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
            </div>
        </Modal>
    );
}
