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

export default function AddArrayModal({ open, data = defaultData, areas, onClose, onSave, onUpdateField }) {
    const d = { ...defaultData, ...data };
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const update = (field, value) => onUpdateField?.(field, value);

    const nameTrimmed = (d.name || '').trim();
    const countValid = typeof d.count === 'number' && d.count >= 1;
    const isInvalid = !nameTrimmed || !countValid;

    const handleSave = () => {
        if (!nameTrimmed) {
            setError('Please enter an array name.');
            return;
        }
        if (!countValid) {
            setError('Panel count must be at least 1.');
            return;
        }
        onSave(d);
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add Physical Array"
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
                        Save Array
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
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Roof Direction</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. South, SW" value={d.orientation} onChange={(e) => update('orientation', e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Panel Count</label>
                    <input type="number" step="1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.count} onChange={(e) => update('count', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mounting System</label>
                    <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.mounting} onChange={(e) => update('mounting', e.target.value)}>
                        <option value="In-Roof (GSE)">In-Roof (GSE)</option>
                        <option value="On Roof">On Roof</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Panel Orientation</label>
                    <select disabled={d.mounting !== 'In-Roof (GSE)'} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={d.format} onChange={(e) => update('format', e.target.value)}>
                        <option value="Portrait">Portrait</option>
                        <option value="Landscape">Landscape</option>
                    </select>
                </div>
            </div>
        </Modal>
    );
}
