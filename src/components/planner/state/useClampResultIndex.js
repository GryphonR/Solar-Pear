import { useEffect } from 'react';

/**
 * Keeps selected planner result index within current ranked result bounds.
 * @param {Array} visibleRanked
 * @param {(updater: (idx:number)=>number) => void} setActiveResultIndex
 */
export function useClampResultIndex(visibleRanked, setActiveResultIndex) {
    useEffect(() => {
        setActiveResultIndex((i) => {
            const n = visibleRanked.length;
            if (n === 0) return 0;
            return Math.min(i, n - 1);
        });
    }, [visibleRanked, setActiveResultIndex]);
}
