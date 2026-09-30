import { useDataState } from '../context/AppStateContext';
import { arrayProgress, arrayStatus, summariseStatuses, systemMeta, totals } from '../lib/designStatus';

/**
 * Per-system and per-array summaries of the active project for the new shell: status, progress and
 * totals, all read from `getArrayAnalysis` (no checks of its own). Recomputed each render, like the old
 * sidebar, because the analysis depends on filters as well as the design.
 *
 * @returns {{ project: object, systems: Array<{ id, name, settings, meta, summary, totals, arrays: Array<{ id, name, analysis, status, progress }> }>, projectSummary, projectTotals }}
 */
export function useDesignSummary() {
    const { activeProject, getArrayAnalysis } = useDataState();

    const analysed = new Map(
        activeProject.arrays.map((a) => {
            const analysis = getArrayAnalysis(a.id);
            return [a.id, { id: a.id, name: a.name, analysis, status: arrayStatus(analysis), progress: arrayProgress(analysis) }];
        })
    );
    const systems = activeProject.systems.map((s) => {
        const arrays = activeProject.arrays.filter((a) => a.systemId === s.id).map((a) => analysed.get(a.id));
        return {
            id: s.id,
            name: s.name,
            settings: s.settings || {},
            meta: systemMeta(s.settings, arrays.length),
            summary: summariseStatuses(arrays.map((a) => a.status)),
            totals: totals(arrays.map((a) => a.analysis)),
            arrays,
        };
    });
    const all = [...analysed.values()];
    return {
        project: activeProject,
        systems,
        projectSummary: summariseStatuses(all.map((a) => a.status)),
        projectTotals: totals(all.map((a) => a.analysis)),
    };
}
