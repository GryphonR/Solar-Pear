import React from 'react';
import { Plus, Info, ExternalLink } from '../components/Icons';
import BuyButton from '../components/BuyButton';
import { useAppState } from '../context/AppStateContext';

export default function ChargersDbView() {
    const {
        chargersData,
        setChargersData,
        systemVoltage,
        setSystemVoltage,
        systemType,
        setSystemType,
        filterEps,
        setFilterEps,
        filterHouseBackup,
        setFilterHouseBackup,
        updateCharger,
        addCharger,
        setInfoModalChargerId,
    } = useAppState();
    const manufacturers = [...new Set(chargersData.map((c) => c.manufacturer || 'Unknown'))].sort((a, b) =>
        a.localeCompare(b)
    );

    const toggleAllChargersMfr = (mfr, active) => {
        setChargersData((prev) =>
            prev.map((c) => ((c.manufacturer || 'Unknown') === mfr ? { ...c, active } : c))
        );
    };

    const updateChargerFilters = (newType, newVoltage, newEps, newHouseBackup) => {
        setChargersData((prev) =>
            prev.map((c) => {
                const volts = c.systemVoltages || [48];
                const matchesVoltage = newVoltage === null || volts.includes(newVoltage);
                let matchesType = false;
                if (newType === 'any') {
                    matchesType = true;
                } else if (newType === 'dc-charger') {
                    matchesType = c.systemType === 'dc-charger';
                } else if (newType === 'grid-connected') {
                    matchesType = !!(c.g98_cert || c.g99_cert);
                    if (matchesType) {
                        if (newEps && !c.eps) matchesType = false;
                        if (newHouseBackup && !c.house_backup) matchesType = false;
                    }
                } else if (newType === 'off-grid-ac') {
                    matchesType = !!c.pure_off_grid_native;
                }
                return { ...c, active: matchesVoltage && matchesType };
            })
        );
    };

    const handleSetSystemVoltage = (v) => {
        setSystemVoltage(v);
        updateChargerFilters(systemType, v, filterEps, filterHouseBackup);
    };

    const handleSetSystemType = (t) => {
        setSystemType(t);
        updateChargerFilters(t, systemVoltage, filterEps, filterHouseBackup);
    };

    const handleToggleEps = () => {
        const next = !filterEps;
        setFilterEps(next);
        updateChargerFilters(systemType, systemVoltage, next, filterHouseBackup);
    };

    const handleToggleHouseBackup = () => {
        const next = !filterHouseBackup;
        setFilterHouseBackup(next);
        updateChargerFilters(systemType, systemVoltage, filterEps, next);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">PV Controllers Database</h2>
                    <p className="text-slate-500">Standalone MPPT chargers and hybrid inverters.</p>
                </div>
                <button
                    onClick={addCharger}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <Plus size={16} className="mr-2" /> Add Controller
                </button>
            </div>
            <div className="space-y-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        DC Bus Voltage
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleSetSystemVoltage(null)}
                            className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                                systemVoltage === null ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            Any
                        </button>
                        {[12, 24, 36, 48, 96].map((v) => (
                            <button
                                key={v}
                                onClick={() => handleSetSystemVoltage(v)}
                                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                                    systemVoltage === v
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {v}V
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Controller Type
                        </span>
                        <div className="flex rounded-lg overflow-hidden border border-slate-300 shadow-sm text-sm font-medium">
                            <button
                                onClick={() => handleSetSystemType('any')}
                                className={`px-3 py-1.5 transition-colors ${
                                    systemType === 'any' ? 'bg-slate-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Any
                            </button>
                            <button
                                onClick={() => handleSetSystemType('dc-charger')}
                                className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                    systemType === 'dc-charger'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                🔌 DC Charger
                            </button>
                            <button
                                onClick={() => handleSetSystemType('grid-connected')}
                                className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                    systemType === 'grid-connected'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                ⚡ Grid-Connected AC
                            </button>
                            <button
                                onClick={() => handleSetSystemType('off-grid-ac')}
                                className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                    systemType === 'off-grid-ac'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                🔋 Off-Grid AC
                            </button>
                        </div>
                    </div>

                    {systemType === 'grid-connected' && (
                        <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                    checked={filterEps}
                                    onChange={handleToggleEps}
                                />
                                Emergency Power (EPS)
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                    checked={filterHouseBackup}
                                    onChange={handleToggleHouseBackup}
                                />
                                House Blackout protection
                            </label>
                        </div>
                    )}
                </div>
            </div>
            {manufacturers.map((mfr) => {
                const mfrChargers = chargersData.filter((c) => (c.manufacturer || 'Unknown') === mfr);
                const allActive = mfrChargers.every((c) => c.active !== false);
                const noneActive = mfrChargers.every((c) => c.active === false);
                return (
                    <div key={mfr}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                {mfr}{' '}
                                <span className="font-normal text-slate-400 normal-case">
                                    ({mfrChargers.length} controllers)
                                </span>
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => toggleAllChargersMfr(mfr, true)}
                                    disabled={allActive}
                                    className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => toggleAllChargersMfr(mfr, false)}
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
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Name
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Model ID
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">
                                                Info
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Type
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Voltages
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Max DC (V)
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Max Isc (A)
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Startup (V)
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Price (£)
                                            </th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                                Buy
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chargersData
                                            .filter((c) => (c.manufacturer || 'Unknown') === mfr)
                                            .map((c) => (
                                                <tr
                                                    key={c.id}
                                                    className="border-b border-slate-100 hover:bg-slate-50 focus-within:bg-blue-50"
                                                >
                                                    <td className="p-1 px-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                            checked={c.active !== false}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'active', e.target.checked)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            className="min-w-[220px] w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            type="text"
                                                            value={c.name}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'name', e.target.value)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1 px-4">
                                                        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                                            {c.id}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        <div className="flex justify-center items-center gap-1">
                                                            <button
                                                                onClick={() => setInfoModalChargerId(c.id)}
                                                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                                title="View Technical Specs"
                                                                aria-label="View technical specs"
                                                            >
                                                                <Info size={18} />
                                                            </button>
                                                            {c.datasheetUrl && (
                                                                <a
                                                                    href={c.datasheetUrl}
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
                                                    <td className="p-1 px-4">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                c.type === 'hybrid_inverter'
                                                                    ? 'bg-purple-100 text-purple-700'
                                                                    : 'bg-blue-100 text-blue-700'
                                                            }`}
                                                        >
                                                            {c.type === 'hybrid_inverter' ? 'Hybrid' : 'MPPT'}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 px-4 text-xs text-slate-500">
                                                        {(c.systemVoltages || [48]).join('V / ')}V
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            type="number"
                                                            step="1"
                                                            value={c.maxV}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'maxV', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            type="number"
                                                            step="1"
                                                            value={c.maxIsc}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'maxIsc', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            type="number"
                                                            step="1"
                                                            value={c.startupV}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'startupV', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            type="number"
                                                            step="1"
                                                            value={c.price}
                                                            onChange={(e) =>
                                                                updateCharger(c.id, 'price', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-1 px-4">
                                                        <BuyButton buyLinks={c.buyLinks ?? {}} />
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
