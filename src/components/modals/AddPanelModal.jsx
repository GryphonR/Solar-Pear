import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

export default function AddPanelModal({ open, data = {}, existingModelIds = [], onClose, onSave, onUpdateField }) {
    const d = data;
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const update = (field, value) => {
        setError(null);
        onUpdateField?.(field, value);
    };

    const modelId = (d.model || '').trim();
    const isInvalid = !modelId || existingModelIds.includes(modelId);

    const handleSave = () => {
        if (!modelId) {
            setError('Please enter a Model ID. It must be unique in the panel database.');
            return;
        }
        if (existingModelIds.includes(modelId)) {
            setError(`A panel with Model ID "${modelId}" already exists. Please choose a different Model ID.`);
            return;
        }
        onSave(d);
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add Custom Solar Panel"
            footer={
                <>
                    {error && (
                        <p className="text-red-600 text-sm mr-auto" role="alert">
                            {error}
                        </p>
                    )}
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                    <button type="button" onClick={handleSave} disabled={isInvalid} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Add Panel to Database</button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer</label>
                        <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.manufacturer} onChange={(e) => update('manufacturer', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Panel Name</label>
                        <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.name} onChange={(e) => update('name', e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="add-panel-model" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Model ID (Unique)</label>
                        <input id="add-panel-model" type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.model} onChange={(e) => update('model', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Peak Power (W)</label>
                        <input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.power} onChange={(e) => update('power', parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Electrical Specs (STC)</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Voc (V)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.voc} onChange={(e) => update('voc', parseFloat(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vmp (V)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.vmp} onChange={(e) => update('vmp', parseFloat(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Isc (A)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.isc} onChange={(e) => update('isc', parseFloat(e.target.value) || 0)} /></div>
                </div>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Physical Specs</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Height (mm)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.height} onChange={(e) => update('height', parseInt(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Width (mm)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.width} onChange={(e) => update('width', parseInt(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Weight (kg)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.weight} onChange={(e) => update('weight', parseFloat(e.target.value) || 0)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GSE Compatibility</label>
                        <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.gseCompatibility} onChange={(e) => update('gseCompatibility', e.target.value)}>
                            <option value="Both">Both</option>
                            <option value="Portrait Only">Portrait Only</option>
                            <option value="Landscape Only">Landscape Only</option>
                        </select>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price (£)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.price} onChange={(e) => update('price', parseFloat(e.target.value) || 0)} /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Engineering Notes</label><textarea className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.notes} onChange={(e) => update('notes', e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Datasheet URL</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.datasheetUrl} onChange={(e) => update('datasheetUrl', e.target.value)} /></div>
            </div>
        </Modal>
    );
}
