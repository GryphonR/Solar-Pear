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
            area:
                a.area ||
                (a.id?.toLowerCase().includes("garage") ? "Garage" : "House"),
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
                    savedP.gseCompatibility || initP.gseCompatibility || "Both",
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

