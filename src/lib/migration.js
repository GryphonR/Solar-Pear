export function extractUserNotes(savedNotesJson) {
    if (!savedNotesJson) return {};
    try {
        const parsed = JSON.parse(savedNotesJson);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function migrateArrays(savedArraysJson, initialArrays) {
    if (!savedArraysJson) return initialArrays;
    try {
        const parsed = JSON.parse(savedArraysJson);
        if (!Array.isArray(parsed)) return initialArrays;
        return parsed.map((a) => ({
            ...a,
            format: a.format || "Portrait",
            mounting: a.mounting || "In-Roof (GSE)",
            maxPanelHeight: a.maxPanelHeight || "",
            maxPanelWidth: a.maxPanelWidth || "",
            maxPanelWeight: a.maxPanelWeight || "",
            // Selection fields live on the array entry (no separate `solar_selections` persistence).
            // Keep legacy-safe defaults if older backups/localStorage entries didn't have them.
            panel: a.panel ?? "",
            controllerInstanceId: a.controllerInstanceId ?? "",
            controllerMppt:
                a.controllerMppt !== undefined && Number.isFinite(Number(a.controllerMppt))
                    ? Number(a.controllerMppt)
                    : 1,
            controller: a.controller ?? "",
            area:
                a.area ||
                (a.id?.toLowerCase().includes("garage") ? "Garage" : "House"),
            planner:
                a.planner && typeof a.planner === "object"
                    ? a.planner
                    : {
                          roofInput: {
                              mode: "actual",
                              x_m: 6,
                              y_m: 4,
                              projectedX_m: 6,
                              projectedY_m: 4,
                              tilt_deg: 30,
                          },
                          roofPolygon: null,
                          exclusions: [],
                          spacing: { edge_mm: 400, gap_mm: 25 },
                          options: { orientation: "either" },
                          layoutOverride: { enabled: false },
                          lastResult: null,
                      },
        }));
    } catch {
        return initialArrays;
    }
}

export function migrateSelectionsAndSiteControllers({
    savedSelectionsJson,
    savedSiteControllersJson,
    savedArraysJson,
    initialArrays,
    initialSelections,
    initialChargers,
}) {
    let selections = initialSelections;
    let siteControllers = [];
    if (savedSiteControllersJson) {
        try {
            const parsed = JSON.parse(savedSiteControllersJson);
            siteControllers = Array.isArray(parsed) ? parsed : [];
        } catch {
            siteControllers = [];
        }
    }

    if (savedSelectionsJson) {
        let parsed;
        try {
            parsed = JSON.parse(savedSelectionsJson);
        } catch {
            parsed = null;
        }
        if (parsed && typeof parsed === "object") {
        let migratedSelections = {};
        let generatedInstances = [];
        let instancesByModel = {};

        for (const arrId in parsed) {
            const sel = parsed[arrId];
            if (
                sel.controller &&
                typeof sel.controller === "string" &&
                !sel.controllerInstanceId
            ) {
                const modelId = sel.controller;
                const model =
                    initialChargers.find((c) => c.id === modelId) || {
                        name: "Migrated Controller",
                        manufacturer: "Unknown",
                        trackers: 1,
                    };
                const trackerCap = Math.max(1, Number(model.trackers) || 1);

                // Cap MPPT index at model.trackers; spawn a new physical instance when full.
                if (
                    !instancesByModel[modelId] ||
                    instancesByModel[modelId].mpptCount >= trackerCap
                ) {
                    const instance = {
                        id: `inst_${modelId}_${Date.now()}_${Math.random()
                            .toString(36)
                            .substr(2, 5)}`,
                        modelId: modelId,
                        name: `${
                            model.manufacturer ? model.manufacturer + " " : ""
                        }${model.name}`,
                    };
                    instancesByModel[modelId] = {
                        instance,
                        mpptCount: 0,
                    };
                    generatedInstances.push(instance);
                }

                instancesByModel[modelId].mpptCount++;

                migratedSelections[arrId] = {
                    panel: sel.panel,
                    // Legacy-safe: preserve the original controller model id assignment.
                    controller: sel.controller,
                    controllerInstanceId: instancesByModel[modelId].instance.id,
                    controllerMppt: instancesByModel[modelId].mpptCount,
                };
            } else {
                migratedSelections[arrId] = { ...sel };
            }
        }
        selections = migratedSelections;
        if (generatedInstances.length > 0) {
            siteControllers = [...siteControllers, ...generatedInstances];
        }
        }
    }

    if (siteControllers.length > 0) {
        let currentArrays = initialArrays;
        if (savedArraysJson) {
            try {
                const parsed = JSON.parse(savedArraysJson);
                if (Array.isArray(parsed)) currentArrays = parsed;
            } catch {
                /* keep initialArrays */
            }
        }
        let currentSelections = initialSelections;
        if (savedSelectionsJson) {
            try {
                const parsed = JSON.parse(savedSelectionsJson);
                if (parsed && typeof parsed === "object") currentSelections = parsed;
            } catch {
                /* keep initialSelections */
            }
        }

        siteControllers = siteControllers.map((sc) => {
            if (sc.area) return sc;

            const assignedArrayId = Object.entries(currentSelections).find(
                ([, sel]) => sel.controllerInstanceId === sc.id
            )?.[0];

            const assignedArea = assignedArrayId
                ? currentArrays.find((a) => a.id === assignedArrayId)?.area
                : "House";

            return { ...sc, area: assignedArea || "House" };
        });
    }

    return { selections, siteControllers };
}

/**
 * Moves saved designs off discontinued or renamed catalogue items (roadmap 2.5).
 * `replacements` maps an old id to its successor: { panels: { oldModel: newModel }, controllers: { oldId: newId } }.
 * Only ids missing from the current catalogue are remapped, and only to successors that exist.
 * Chains (A → B → C) are followed.
 *
 * @param {{ arrays: object[], siteControllers: object[] }} design
 * @param {{ panels?: Record<string, string>, controllers?: Record<string, string> }} replacements
 * @param {{ panelModels: Set<string>, controllerIds: Set<string> }} catalogue
 * @returns {{ arrays: object[], siteControllers: object[], changes: Array<{ kind: 'panel'|'controller', from: string, to: string }> }}
 */
export function applyReplacements(design, replacements, catalogue) {
    const changes = [];
    const resolve = (id, map, exists) => {
        if (!id || exists.has(id) || !map) return null;
        let next = id;
        const seen = new Set();
        while (map[next] && !seen.has(next)) {
            seen.add(next);
            next = map[next];
            if (exists.has(next)) return next;
        }
        return null;
    };
    const seenChange = new Set();
    const record = (kind, from, to) => {
        const key = `${kind}:${from}`;
        if (!seenChange.has(key)) {
            seenChange.add(key);
            changes.push({ kind, from, to });
        }
    };
    const arrays = (design.arrays || []).map((a) => {
        const to = resolve(a.panel, replacements?.panels, catalogue.panelModels);
        if (!to) return a;
        record('panel', a.panel, to);
        return { ...a, panel: to };
    });
    const siteControllers = (design.siteControllers || []).map((sc) => {
        const to = resolve(sc.modelId, replacements?.controllers, catalogue.controllerIds);
        if (!to) return sc;
        record('controller', sc.modelId, to);
        return { ...sc, modelId: to };
    });
    return { arrays, siteControllers, changes };
}
