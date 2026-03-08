export const isCompatibleFormat = (array, panel) => {
    const aMounting = array.mounting || "In-Roof (GSE)";
    if (aMounting === "On Roof") return true;

    const pGseComp = panel.gseCompatibility || "Both";
    const aFormat = array.format || "Portrait";
    if (aFormat === "Landscape" && pGseComp === "Portrait Only") return false;
    if (aFormat === "Portrait" && pGseComp === "Landscape Only") return false;
    return true;
};

export const analyzeArray = (
    arrayId,
    { arraysData, panelsData, chargersData, siteControllers, selections }
) => {
    const array = arraysData.find((a) => a.id === arrayId);
    if (!array) return null;

    const sel = selections[arrayId] || {};

    let panel = null;
    if (sel.panel !== "") {
        panel = panelsData.find((p) => p.model === sel.panel);
        // Optional: fallback to first compatible if the selected one is completely missing from DB somehow, but don't default if intentionally cleared.
        if (!panel && sel.panel) {
            panel =
                panelsData.find(
                    (p) => p.active !== false && isCompatibleFormat(array, p)
                ) || panelsData[0];
        }
    }

    let controllerInstance = null;
    let controller = null;
    let mpptIndex = sel.controllerMppt || 1;

    if (sel.controllerInstanceId) {
        controllerInstance = siteControllers.find(
            (sc) => sc.id === sel.controllerInstanceId
        );
        if (controllerInstance) {
            controller = chargersData.find(
                (c) => c.id === controllerInstance.modelId
            );
        }
    } else if (sel.controller) {
        // Legacy fallback
        controller = chargersData.find((c) => c.id === sel.controller);
    }

    if (!panel || !controller) {
        let coldVoc = 0;
        let hotVmp = 0;
        let peakPower = 0;
        let cost = 0;

        if (panel) {
            peakPower = panel.power * array.count;
            const pStrings = array.parallelStrings || 1;
            const panelsPerSeriesString = array.count / pStrings;
            coldVoc = panel.voc * panelsPerSeriesString * 1.084;
            hotVmp = panel.vmp * panelsPerSeriesString * 0.9;
            cost = panel.price * array.count;
        }

        return {
            array,
            panel,
            controller,
            controllerInstance,
            mpptIndex,
            status: "warning",
            messages: [
                "Please select both a Solar Panel and a PV Controller to view system analysis.",
            ],
            peakPower,
            cost,
            costPerKWp: peakPower > 0 ? cost / (peakPower / 1000) : 0,
            coldVoc,
            hotVmp,
        };
    }

    const peakPower = panel.power * array.count;
    const pStrings = array.parallelStrings || 1;
    const panelsPerSeriesString = array.count / pStrings;

    const stringVocSTC = panel.voc * panelsPerSeriesString;
    const coldVoc = stringVocSTC * 1.084;

    const stringVmpSTC = panel.vmp * panelsPerSeriesString;
    const hotVmp = stringVmpSTC * 0.9;
    const cost = panel.price * array.count;

    const isVocError = coldVoc > controller.maxV;
    const isVocWarn = coldVoc > controller.maxV * 0.94 && !isVocError;
    const isVmpError = hotVmp < controller.startupV;
    const arrayIsc = panel.isc * pStrings;
    const isIscError = arrayIsc > controller.maxIsc;
    const isFormatError = !isCompatibleFormat(array, panel);

    let status = "valid";
    let messages = [];

    if (isFormatError) {
        status = "error";
        const aFormat = array.format || "Portrait";
        if (aFormat === "Landscape") {
            messages.push(
                `FATAL PHYSICAL: The ${panel.name} is only compatible with Portrait GSE integrated trays.`
            );
        } else {
            messages.push(
                `FATAL PHYSICAL: The ${panel.name} is only compatible with Landscape GSE integrated trays.`
            );
        }
    }

    const isHeightOk =
        !array.maxPanelHeight ||
        (panel.height && panel.height <= array.maxPanelHeight);
    const isWidthOk =
        !array.maxPanelWidth ||
        (panel.width && panel.width <= array.maxPanelWidth);
    const isWeightOk =
        !array.maxPanelWeight ||
        (panel.weight != null && panel.weight <= Number(array.maxPanelWeight));
    if (!isHeightOk || !isWidthOk) {
        status = "error";
        messages.push(
            `FATAL PHYSICAL: The selected panel (${panel.height}x${panel.width}mm) exceeds your specified maximum dimensions for this array.`
        );
    }
    if (!isWeightOk && array.maxPanelWeight) {
        status = "error";
        messages.push(
            `FATAL PHYSICAL: The selected panel (${panel.weight}kg) exceeds your specified maximum panel weight (${array.maxPanelWeight}kg) for this array.`
        );
    }

    if (isVocError) {
        status = "error";
        messages.push(
            `FATAL: Cold Voc (${coldVoc.toFixed(
                1
            )}V) exceeds PV controller limit (${controller.maxV}V). Will destroy hardware.`
        );
    } else if (isVocWarn) {
        if (status !== "error") status = "warning";
        messages.push(
            `Cold Voc (${coldVoc.toFixed(
                1
            )}V) is dangerously close to PV controller limit (${controller.maxV}V). Margin is too tight.`
        );
    }

    if (isVmpError) {
        status = "error";
        messages.push(
            `FATAL: Hot Vmp (${hotVmp.toFixed(
                1
            )}V) is below PV controller startup threshold (${controller.startupV}V). Will not start on hot days.`
        );
    }

    if (isIscError) {
        status = "error";
        messages.push(
            `FATAL: Array Isc (${arrayIsc.toFixed(
                2
            )}A) exceeds PV controller tracker limit (${controller.maxIsc}A).`
        );
    }

    if (messages.length === 0) {
        messages.push("Configuration is safe.");
    }

    return {
        array,
        panel,
        controller,
        controllerInstance,
        mpptIndex,
        status,
        messages,
        peakPower,
        cost, // Note: controller cost is no longer folded into this array-level figure
        costPerKWp: peakPower > 0 ? cost / (peakPower / 1000) : 0,
        coldVoc,
        hotVmp,
    };
};

