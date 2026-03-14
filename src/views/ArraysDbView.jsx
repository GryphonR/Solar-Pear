import React from 'react';
import { Plus, Trash2 } from '../components/Icons';
import { useAppState } from '../context/AppStateContext';

export default function ArraysDbView() {
    const {
        arraysData,
        areasData,
        updateArray,
        deleteArray,
        deleteArea,
        setAddAreaModal,
        openAddArrayModal,
    } = useAppState();
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Array Configuration & Areas</h2>
                    <p className="text-slate-500">
                        Group your physical arrays into distinct Areas. Calculate separate System Summaries per
                        Area.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setAddAreaModal({ open: true, data: '' })}
                        className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 transition-colors"
                    >
                        <Plus size={16} className="mr-2" /> Add Area
                    </button>
                    <button
                        onClick={openAddArrayModal}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        <Plus size={16} className="mr-2" /> Add Array
                    </button>
                </div>
            </div>

            {arraysData.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <p className="text-slate-700 font-medium mb-2">You don&apos;t have any arrays yet.</p>
                    <p className="text-slate-600 text-sm mb-4">Add an area and an array to get started.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {areasData.length <= 1 && (
                            <button
                                onClick={() => setAddAreaModal({ open: true, data: '' })}
                                className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 transition-colors"
                            >
                                <Plus size={16} className="mr-2" /> Add Area
                            </button>
                        )}
                        <button
                            onClick={openAddArrayModal}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            <Plus size={16} className="mr-2" /> Add Array
                        </button>
                    </div>
                </div>
            )}

            {areasData.map((areaName) => {
                const areaArrays = arraysData.filter((a) => a.area === areaName);
                return (
                    <div key={areaName} className="mb-6">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                {areaName}{' '}
                                <span className="font-normal text-slate-400 normal-case">
                                    ({areaArrays.length} arrays)
                                </span>
                            </h3>
                            <button
                                onClick={() => deleteArea(areaName)}
                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                title="Delete Area"
                            >
                                Delete Area
                            </button>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                            Array Name
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                            Physical Area
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                            Roof Direction
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                                            Panel Count
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                                            Panel Orientation
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                                            Mounting System
                                        </th>
                                        <th scope="col" className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {areaArrays.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-6 px-4 text-center text-slate-400 italic">
                                                No arrays assigned to {areaName}.
                                            </td>
                                        </tr>
                                    ) : (
                                        areaArrays.map((a) => (
                                            <tr
                                                key={a.id}
                                                className="border-b border-slate-100 hover:bg-slate-50 focus-within:bg-blue-50"
                                            >
                                                <td className="p-1">
                                                    <input
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        type="text"
                                                        value={a.name}
                                                        onChange={(e) => updateArray(a.id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-1">
                                                    <select
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        value={a.area || 'House'}
                                                        onChange={(e) => updateArray(a.id, 'area', e.target.value)}
                                                    >
                                                        {areasData.map((ar) => (
                                                            <option key={ar} value={ar}>
                                                                {ar}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-1">
                                                    <input
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        type="text"
                                                        value={a.orientation}
                                                        onChange={(e) =>
                                                            updateArray(a.id, 'orientation', e.target.value)
                                                        }
                                                    />
                                                </td>
                                                <td className="p-1">
                                                    <input
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        type="number"
                                                        step="1"
                                                        value={a.count}
                                                        onChange={(e) =>
                                                            updateArray(a.id, 'count', parseInt(e.target.value) || 0)
                                                        }
                                                    />
                                                </td>
                                                <td className="p-1 hidden md:table-cell">
                                                    {(a.mounting || 'In-Roof (GSE)') === 'In-Roof (GSE)' ? (
                                                        <select
                                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                            value={a.format || 'Portrait'}
                                                            onChange={(e) =>
                                                                updateArray(a.id, 'format', e.target.value)
                                                            }
                                                        >
                                                            <option value="Portrait">Portrait</option>
                                                            <option value="Landscape">Landscape</option>
                                                        </select>
                                                    ) : (
                                                        <div className="w-full p-2 text-slate-400 text-sm italic">
                                                            Flexible (Rail)
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-1 hidden md:table-cell">
                                                    <select
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        value={a.mounting || 'In-Roof (GSE)'}
                                                        onChange={(e) =>
                                                            updateArray(a.id, 'mounting', e.target.value)
                                                        }
                                                    >
                                                        <option value="In-Roof (GSE)">In-Roof (GSE)</option>
                                                        <option value="On Roof">On Roof</option>
                                                    </select>
                                                </td>
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => deleteArray(a.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Delete Array"
                                                        aria-label="Delete array"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
