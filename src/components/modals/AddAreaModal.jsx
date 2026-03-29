import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

export default function AddAreaModal({
    open,
    mode = 'add',
    value,
    originalName = null,
    areas,
    onClose,
    onSave,
    onDelete,
}) {
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState(() => value || '');

    useEffect(() => {
        if (!open) return;
        setDraft(value || '');
        setError(null);
    }, [open, value]);

    const trimmed = (draft || '').trim();
    const isDuplicate =
        trimmed &&
        areas.some(
            (a) =>
                a.toLowerCase() === trimmed.toLowerCase() &&
                (mode !== 'edit' || a.toLowerCase() !== (originalName || '').toLowerCase())
        );
    const isInvalid = !trimmed || isDuplicate;

    const handleSave = () => {
        if (!trimmed) {
            setError('Please enter an area name.');
            return;
        }
        if (
            areas.some(
                (a) =>
                    a.toLowerCase() === trimmed.toLowerCase() &&
                    (mode !== 'edit' || a.toLowerCase() !== (originalName || '').toLowerCase())
            )
        ) {
            setError(`An Area named "${trimmed}" already exists.`);
            return;
        }
        onSave(trimmed);
        onClose();
    };

    const handleChange = (newValue) => {
        setError(null);
        setDraft(newValue);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit Area' : 'Add New Area'}
            maxWidth="max-w-md"
            bodyScrollable={false}
            footer={
                <>
                    {error && (
                        <p className="text-red-600 text-sm mr-auto" role="alert">
                            {error}
                        </p>
                    )}
                    {mode === 'edit' && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 font-medium transition-colors"
                        >
                            Delete Area
                        </button>
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
                        {mode === 'edit' ? 'Save Changes' : 'Save Area'}
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
                    value={draft}
                    onChange={(e) => handleChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
            </div>
        </Modal>
    );
}
