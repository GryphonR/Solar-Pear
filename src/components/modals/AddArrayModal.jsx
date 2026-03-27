import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

const defaultData = {
    name: 'New Array',
    area: 'House',
    orientation: 'South',
    count: 6,
    format: 'Portrait',
    mounting: 'On Roof',
    maxPanelHeight: '',
    maxPanelWidth: '',
    maxPanelWeight: '',
};

export default function AddArrayModal({
    open,
    mode = 'add',
    data = defaultData,
    areas,
    onClose,
    onSave,
    onUpdateField,
    onDelete,
}) {
    const d = { ...defaultData, ...data };
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const update = (field, value) => onUpdateField?.(field, value);

    const nameTrimmed = (d.name || '').trim();
    const areaValid = !!(d.area && areas.includes(d.area));
    const isInvalid = !nameTrimmed || !areaValid;

    const handleSave = () => {
        if (!nameTrimmed) {
            setError('Please enter an array name.');
            return;
        }
        if (!areaValid) {
            setError('Please select a valid area.');
            return;
        }
        onSave(d);
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit Physical Array' : 'Add Physical Array'}
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
                            Delete Array
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
                        {mode === 'edit' ? 'Save Changes' : 'Save Array'}
                    </button>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Array Name</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Area</label>
                    <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.area} onChange={(e) => update('area', e.target.value)}>
                        {areas.map((ar) => (
                            <option key={ar} value={ar}>{ar}</option>
                        ))}
                    </select>
                </div>
            </div>
        </Modal>
    );
}
