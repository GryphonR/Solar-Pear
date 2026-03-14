import React from 'react';

/**
 * Dropdown to choose parallel strings (divisors of array.count). Only rendered when count has multiple divisors.
 */
export default function ParallelStringsSelect({ array, arrayId, updateArray }) {
    const divisors = [];
    for (let i = 1; i <= array.count; i++) {
        if (array.count % i === 0) divisors.push(i);
    }

    if (divisors.length <= 1) return null;

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Wiring Configuration:</span>
            <select
                className="text-sm font-medium border border-slate-300 rounded-md px-2 py-1 bg-blue-50 text-blue-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={array.parallelStrings || 1}
                onChange={(e) =>
                    updateArray(arrayId, 'parallelStrings', parseInt(e.target.value, 10))
                }
                title="Series / Parallel String Wiring"
            >
                {divisors.map((d) => (
                    <option key={d} value={d}>
                        {array.count / d}S{d}P ({array.count / d} Series x {d} Parallel)
                    </option>
                ))}
            </select>
        </div>
    );
}
