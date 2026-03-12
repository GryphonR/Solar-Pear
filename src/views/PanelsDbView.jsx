import React from 'react';
import { Plus, Info, ExternalLink } from '../components/Icons';
import { useAppState } from '../context/AppStateContext';

export default function PanelsDbView() {
    const {
        panelsData,
        setPanelsData,
        updatePanel,
        addPanel,
        setInfoModalPanelId,
    } = useAppState();
    const manufacturers = [...new Set(panelsData.map((p) => p.manufacturer || 'Unknown'))].sort((a, b) =>
        a.localeCompare(b)
    );

    const toggleAllPanelMfr = (mfr, active) => {
        setPanelsData((prev) =>
            prev.map((p) => ((p.manufacturer || 'Unknown') === mfr ? { ...p, active } : p))
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Solar Panels Database</h2>
                    <p className="text-slate-500">
                        View panel specifications. Only the price field is editable; use Select All / Deselect All to filter arrays.
                    </p>
                </div>
                <button
                    onClick={addPanel}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <Plus size={16} className="mr-2" /> Add Panel
                </button>
            </div>
            {manufacturers.map((mfr) => {
                const mfrPanels = panelsData.filter((p) => (p.manufacturer || 'Unknown') === mfr);
                const allActive = mfrPanels.every((p) => p.active !== false);
                const noneActive = mfrPanels.every((p) => p.active === false);
                return (
                    <div key={mfr}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                {mfr}{' '}
                                <span className="font-normal text-slate-400 normal-case">
                                    ({mfrPanels.length} panels)
                                </span>
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => toggleAllPanelMfr(mfr, true)}
                                    disabled={allActive}
                                    className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => toggleAllPanelMfr(mfr, false)}
                                    disabled={noneActive}
                                    className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left border-collapse relative">
                                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase text-center">
                                                Active
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Panel Name
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Model ID
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase text-center">
                                                Info
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                GSE Compat.
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Power (W)
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Voc (V)
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Vmp (V)
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Isc (A)
                                            </th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                                                Price (£)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mfrPanels.map((p) => (
                                            <tr
                                                key={p.model}
                                                className={`border-b border-slate-100 transition-colors ${
                                                    p.active === false
                                                        ? 'bg-slate-50 opacity-60'
                                                        : 'hover:bg-slate-50 focus-within:bg-blue-50'
                                                }`}
                                            >
                                                <td className="p-1 text-center">
                                                    <label className="flex justify-center items-center cursor-pointer" title="Include in array dropdown menus">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                            checked={p.active !== false}
                                                            onChange={() => updatePanel(p.model, 'active', p.active === false)}
                                                            aria-label="Active"
                                                        />
                                                    </label>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-800">{p.name}</span>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                                        {p.model}
                                                    </span>
                                                </td>
                                                <td className="p-1 text-center">
                                                    <div className="flex justify-center items-center gap-1">
                                                        <button
                                                            onClick={() => setInfoModalPanelId(p.model)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="View Technical Specs"
                                                            aria-label="View technical specs"
                                                        >
                                                            <Info size={18} />
                                                        </button>
                                                        {p.datasheetUrl && (
                                                            <a
                                                                href={p.datasheetUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                                title="View Manufacturer Datasheet"
                                                                aria-label="View manufacturer datasheet"
                                                            >
                                                                <ExternalLink size={18} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-600">{p.gseCompatibility || 'Both'}</span>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-800">{p.power}</span>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-800">{p.voc}</span>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-800">{p.vmp}</span>
                                                </td>
                                                <td className="p-1 px-2">
                                                    <span className="text-sm text-slate-800">{p.isc}</span>
                                                </td>
                                                <td className="p-1">
                                                    <input
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        type="number"
                                                        step="1"
                                                        value={p.price}
                                                        onChange={(e) =>
                                                            updatePanel(p.model, 'price', parseFloat(e.target.value) || 0)
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
