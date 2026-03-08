import React from 'react';
import Modal from '../Modal';
import { ExternalLink, Info } from '../Icons';

export default function PanelInfoModal({ open, panel, userNote, onClose, onUpdateNote }) {
    if (!panel) return null;

    const p = panel;

    const header = (
        <div>
            <h2 className="text-2xl font-bold text-slate-800">{p.name}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{p.power} Watts</span>
                <span className="text-sm font-medium text-slate-600">£{p.price} per unit</span>
                {p.gseCompatibility === 'Both' && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">Portrait & Landscape</span>}
                {p.gseCompatibility === 'Portrait Only' && <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">Portrait GSE Only</span>}
                {p.gseCompatibility === 'Landscape Only' && <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">Landscape GSE Only</span>}
                {p.datasheetUrl && (
                    <a href={p.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
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
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Physical Specifications</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Dimensions</dt><dd className="text-slate-800 font-semibold">{p.height || 'Unknown'} x {p.width || 'Unknown'} mm</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Weight</dt><dd className="text-slate-800 font-semibold">{p.weight ? `${p.weight} kg` : 'Unknown'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Glass Type</dt><dd className="text-slate-800 font-semibold">{p.glass || 'Unknown'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Bifaciality</dt><dd className="text-slate-800 font-semibold">{p.bifacial ? 'Yes (Rear Yield)' : 'No (Mono-facial)'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Cell Layout</dt><dd className="text-slate-800 font-semibold">{p.cells || 'Unknown'}</dd></div>
                        </dl>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Electrical Limits (STC)</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Efficiency</dt><dd className="text-slate-800 font-semibold text-blue-700">{p.efficiency ? `${p.efficiency}%` : 'Unknown'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Voc (Open Circuit)</dt><dd className="text-slate-800 font-semibold">{p.voc} V</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Vmp (Max Power)</dt><dd className="text-slate-800 font-semibold">{p.vmp} V</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500 font-medium">Isc (Short Circuit)</dt><dd className="text-slate-800 font-semibold">{p.isc} A</dd></div>
                        </dl>
                    </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center"><Info size={14} className="mr-2" /> Engineering Design Notes</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{p.notes || 'No specific architectural notes for this module. Refer to standard datasheets.'}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">Your Persistent Notes</h3>
                    <textarea
                        className="w-full p-4 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 min-h-[100px] resize-y shadow-inner"
                        placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                        value={userNote || ''}
                        onChange={(e) => onUpdateNote?.(p.model, e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-2 text-right">Notes autosave to your browser.</p>
                </div>
            </div>
        </Modal>
    );
}
