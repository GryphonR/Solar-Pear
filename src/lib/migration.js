import { GSE_COMPATIBILITY } from "./gseCompatibility";

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
    let siteControllers = savedSiteControllersJson
        ? JSON.parse(savedSiteControllersJson)
        : [];

    if (savedSelectionsJson) {
        const parsed = JSON.parse(savedSelectionsJson);
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
                if (!instancesByModel[modelId]) {
                    const model =
                        initialChargers.find((c) => c.id === modelId) || {
                            name: "Migrated Controller",
                            manufacturer: "Unknown",
                        };
                    instancesByModel[modelId] = {
                        instance: {
                            id: `inst_${modelId}_${Date.now()}_${Math.random()
                                .toString(36)
                                .substr(2, 5)}`,
                            modelId: modelId,
                            name: `${
                                model.manufacturer ? model.manufacturer + " " : ""
                            }${model.name}`,
                        },
                        mpptCount: 1,
                    };
                    generatedInstances.push(instancesByModel[modelId].instance);
                } else {
                    instancesByModel[modelId].mpptCount++;
                }

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

    if (siteControllers.length > 0) {
        const currentArrays = savedArraysJson
            ? JSON.parse(savedArraysJson)
            : initialArrays;
        const currentSelections = savedSelectionsJson
            ? JSON.parse(savedSelectionsJson)
            : initialSelections;

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

export function mergeChargers(initialChargers, options) {
    const {
        savedChargersJson = null,
        savedMpptsJson = null,
        savedInvertersJson = null,
    } = options || {};

    let mergedChargersMap = new Map();
    initialChargers.forEach((c) => mergedChargersMap.set(c.id, { ...c }));

    if (savedChargersJson) {
        const parsed = JSON.parse(savedChargersJson);
        parsed.forEach((c) => {
            if (mergedChargersMap.has(c.id)) {
                const initC = mergedChargersMap.get(c.id);
                mergedChargersMap.set(c.id, {
                    ...initC,
                    price: c.price,
                    notes: c.notes,
                    active: c.active,
                });
            } else {
                mergedChargersMap.set(c.id, c);
            }
        });
    } else if (savedMpptsJson || savedInvertersJson) {
        if (savedMpptsJson) {
            const parsedMppts = JSON.parse(savedMpptsJson);
            parsedMppts.forEach((m) => {
                if (mergedChargersMap.has(m.id)) {
                    const initC = mergedChargersMap.get(m.id);
                    mergedChargersMap.set(m.id, {
                        ...initC,
                        price: m.price,
                        notes: m.notes,
                    });
                }
            });
        }
        if (savedInvertersJson) {
            const parsedInverters = JSON.parse(savedInvertersJson);
            parsedInverters.forEach((i) => {
                if (mergedChargersMap.has(i.id)) {
                    const initC = mergedChargersMap.get(i.id);
                    mergedChargersMap.set(i.id, {
                        ...initC,
                        price: i.price,
                        notes: i.notes,
                    });
                }
            });
        }
    }

    return Array.from(mergedChargersMap.values());
}

export function mergePanels(initialPanels, savedPanelsJson) {
    if (!savedPanelsJson) return initialPanels;
    const parsed = JSON.parse(savedPanelsJson);
    const initPanelsMap = new Map(initialPanels.map((p) => [p.model, p]));
    const mergedPanels = parsed.map((savedP) => {
        const initP = initPanelsMap.get(savedP.model);
        if (initP) {
            return {
                ...initP,
                price: savedP.price,
                active: savedP.active,
                gseCompatibility:
                    savedP.gseCompatibility || initP.gseCompatibility || GSE_COMPATIBILITY.BOTH,
            };
        }
        return savedP;
    });
    initialPanels.forEach((initP) => {
        if (!parsed.find((p) => p.model === initP.model)) {
            mergedPanels.push(initP);
        }
    });
    return mergedPanels;
}

