import React from 'react';
import Modal from '../Modal';
import { CheckCircle, ExternalLink, Info, XIcon } from '../Icons';

export default function ChargerInfoModal({ open, charger, userNote, onClose, onUpdateNote }) {
    if (!charger) return null;

    const c = charger;

    const header = (
        <div>
            <h2 className="text-2xl font-bold text-slate-800">{c.name}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.type === 'hybrid_inverter' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {c.type === 'hybrid_inverter' ? 'Hybrid Inverter' : 'MPPT Charger'}
                </span>
                <span className="text-sm font-medium text-slate-600">£{c.price || 0} per unit</span>
                {c.datasheetUrl && (
                    <a href={c.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
                        <ExternalLink size={12} className="mr-1" /> Datasheet
                    </a>
                )}
            </div>
        </div>
    );

    return (
        <Modal open={open} onClose={onClose} header={header} headerAlign="start">
            <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Input Specifications</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Max PV Voltage</dt><dd className="text-red-700 font-bold">{c.maxV} V</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Startup Voltage</dt><dd className="text-slate-800 font-semibold">{c.startupV} V</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Max Short Circuit Current</dt><dd className="text-slate-800 font-semibold">{c.maxIsc || 'N/A'} A</dd></div>
                        </dl>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">System Compatibility</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Battery Voltages</dt><dd className="text-slate-800 font-semibold">{(c.systemVoltages || [48]).join('V, ')}V</dd></div>
                        </dl>
                    </div>
                    <div className="col-span-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">UK Grid Certifications</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className={`p-3 rounded-lg border ${c.g98_cert ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                <div className="flex items-center gap-2">{c.g98_cert ? <CheckCircle size={16} /> : <XIcon size={16} />}<span className="text-sm font-bold">G98 Cert</span></div>
                            </div>
                            <div className={`p-3 rounded-lg border ${c.g99_cert ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                <div className="flex items-center gap-2">{c.g99_cert ? <CheckCircle size={16} /> : <XIcon size={16} />}<span className="text-sm font-bold">G99 Cert</span></div>
                            </div>
                            <div className={`p-3 rounded-lg border ${c.g100_cert ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                <div className="flex items-center gap-2">{c.g100_cert ? <CheckCircle size={16} /> : <XIcon size={16} />}<span className="text-sm font-bold">G100 Cert</span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center"><Info size={14} className="mr-2" /> Engineering Design Notes</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{c.notes || 'No specific architectural notes for this controller. Refer to manufacturer specifications.'}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">Your Persistent Notes</h3>
                    <textarea
                        className="w-full p-4 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 min-h-[100px] resize-y shadow-inner"
                        placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                        value={userNote || ''}
                        onChange={(e) => onUpdateNote?.(c.id, e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-2 text-right">Notes autosave to your browser.</p>
                </div>
            </div>
        </Modal>
    );
}
