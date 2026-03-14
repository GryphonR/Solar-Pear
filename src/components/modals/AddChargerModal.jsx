import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

export default function AddChargerModal({ open, data = {}, existingIds = [], onClose, onSave, onUpdateField }) {
    const d = data;
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const update = (field, value) => {
        setError(null);
        onUpdateField?.(field, value);
    };

    const toggleVoltage = (v) => {
        const current = d.systemVoltages || [];
        update('systemVoltages', current.includes(v) ? current.filter((x) => x !== v) : [...current, v].sort((a, b) => a - b));
    };

    const chargerId = (d.id || '').trim();
    const isInvalid = !chargerId || existingIds.includes(chargerId);

    const handleSave = () => {
        if (!chargerId) {
            setError('Please enter a Model ID. It must be unique in the controller database.');
            return;
        }
        if (existingIds.includes(chargerId)) {
            setError(`A controller with Model ID "${chargerId}" already exists. Please choose a different Model ID.`);
            return;
        }
        onSave(d);
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add Custom PV Controller"
            footer={
                <>
                    {error && (
                        <p className="text-red-600 text-sm mr-auto" role="alert">
                            {error}
                        </p>
                    )}
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                    <button type="button" onClick={handleSave} disabled={isInvalid} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Add Controller to Database</button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.manufacturer} onChange={(e) => update('manufacturer', e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Device Name</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.name} onChange={(e) => update('name', e.target.value)} /></div>
                    <div><label htmlFor="add-charger-id" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Model ID (Unique)</label><input id="add-charger-id" type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.id} onChange={(e) => update('id', e.target.value)} /></div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Device Type</label>
                        <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.type} onChange={(e) => update('type', e.target.value)}>
                            <option value="charger">Standalone Charger</option>
                            <option value="hybrid_inverter">Hybrid Inverter</option>
                        </select>
                    </div>
                </div>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Supported Battery Voltages</h3>
                <div className="flex gap-3">
                    {[12, 24, 48].map((v) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded border border-slate-200 hover:bg-slate-100">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" checked={(d.systemVoltages || []).includes(v)} onChange={() => toggleVoltage(v)} />
                            <span className="text-sm font-bold text-slate-700">{v}V</span>
                        </label>
                    ))}
                </div>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">PV Input Limits (Per Tracker)</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max PV (V)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.maxV} onChange={(e) => update('maxV', parseInt(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Startup PV (V)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.startupV} onChange={(e) => update('startupV', parseInt(e.target.value) || 0)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max Isc (A)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.maxIsc} onChange={(e) => update('maxIsc', parseInt(e.target.value) || 0)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Number of Trackers</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.trackers} onChange={(e) => update('trackers', parseInt(e.target.value) || 1)} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price (£)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.price} onChange={(e) => update('price', parseInt(e.target.value) || 0)} /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Engineering Notes</label><textarea className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.notes} onChange={(e) => update('notes', e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Datasheet URL</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.datasheetUrl} onChange={(e) => update('datasheetUrl', e.target.value)} /></div>
            </div>
        </Modal>
    );
}
