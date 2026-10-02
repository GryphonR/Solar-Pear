/**
 * @file ports.js
 * Controller ports in a system (roadmap 13.6). One array uses one MPPT port and ports are exclusive, as
 * in the engine (see domain-rules.md, "Model assumptions"). Pure.
 */

import { controllerForInput } from './arrayAnalysis';

/** Number of MPPT ports on a controller model (at least 1). */
export function portCount(model) {
    return Math.max(1, Number(model?.trackers) || 1);
}

/**
 * Ports of each controller unit and the array on each.
 *
 * @param {Array<{ id: string, modelId: string }>} instances
 * @param {Array<{ id: string, controllerInstanceId?: string, controllerMppt?: number }>} arrays
 * @param {Array<{ id: string, trackers?: number }>} chargers
 * @returns {Array<{ instance: object, model: object|null, ports: Array<{ port: number, arrayId: string|null }> }>}
 */
export function unitPorts(instances, arrays, chargers) {
    return instances.map((instance) => {
        const model = chargers.find((c) => c.id === instance.modelId) || null;
        const ports = Array.from({ length: portCount(model) }, (_, i) => {
            const port = i + 1;
            const array = arrays.find((a) => a.controllerInstanceId === instance.id && (Number(a.controllerMppt) || 1) === port);
            return { port, arrayId: array ? array.id : null };
        });
        return { instance, model, ports };
    });
}

/** Free ports across units, e.g. for "Change port" or assigning an unconnected array. */
export function freePorts(instances, arrays, chargers) {
    return unitPorts(instances, arrays, chargers).flatMap(({ instance, model, ports }) =>
        ports.filter((p) => !p.arrayId).map((p) => ({ instanceId: instance.id, port: p.port, model, instance }))
    );
}

/** Arrays in the system with no controller port. */
export function unassignedArrays(arrays, instances) {
    const ids = new Set(instances.map((i) => i.id));
    return arrays.filter((a) => !a.controllerInstanceId || !ids.has(a.controllerInstanceId));
}

/**
 * Short limits of one port, e.g. "22 A · 41.25 A Isc", shown beside the port name only when the model's
 * inputs differ (`mpptInputs`, roadmap 1.13); null otherwise.
 */
export function portLimitsLabel(model, port) {
    if (!model || !Array.isArray(model.mpptInputs) || model.mpptInputs.length === 0) return null;
    const c = controllerForInput(model, port);
    const parts = [
        Number(c.maxOperatingI) > 0 ? `${c.maxOperatingI} A` : null,
        Number(c.maxIsc) > 0 ? `${c.maxIsc} A Isc` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
}

/** "MPPT 1", or "MPPT 1 (22 A · 41.25 A Isc)" when the model's inputs differ. */
export function portName(model, port) {
    const limits = portLimitsLabel(model, port);
    return limits ? `MPPT ${port} (${limits})` : `MPPT ${port}`;
}
