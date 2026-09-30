import { describe, it, expect } from "vitest";
import { freePorts, portCount, unassignedArrays, unitPorts } from "./ports";
import { controllerMatchesSystem } from "./controllerFilter";

const chargers = [
    { id: "hyb", trackers: 2 },
    { id: "mppt", trackers: 1 },
];
const instances = [
    { id: "i1", modelId: "hyb" },
    { id: "i2", modelId: "mppt" },
];
const arrays = [
    { id: "a", controllerInstanceId: "i1", controllerMppt: 2 },
    { id: "b", controllerInstanceId: "", controllerMppt: 1 },
    { id: "c", controllerInstanceId: "gone", controllerMppt: 1 },
];

describe("ports (roadmap 13.6)", () => {
    it("lists each unit's ports and the array on each", () => {
        const units = unitPorts(instances, arrays, chargers);
        expect(units[0].ports).toEqual([
            { port: 1, arrayId: null },
            { port: 2, arrayId: "a" },
        ]);
        expect(units[1].ports).toEqual([{ port: 1, arrayId: null }]);
        expect(portCount({})).toBe(1);
    });

    it("finds free ports and arrays without one", () => {
        expect(freePorts(instances, arrays, chargers).map((p) => `${p.instanceId}:${p.port}`)).toEqual(["i1:1", "i2:1"]);
        expect(unassignedArrays(arrays, instances).map((a) => a.id)).toEqual(["b", "c"]);
    });
});

describe("controllerMatchesSystem", () => {
    const hybrid = { systemVoltages: [48], systemType: "grid-connected", g99_cert: true, eps: true };
    it("filters by battery voltage and the system's controller filter", () => {
        expect(controllerMatchesSystem(hybrid, { systemVoltage: 48, systemType: "grid-connected" })).toBe(true);
        expect(controllerMatchesSystem(hybrid, { systemVoltage: 12, systemType: "any" })).toBe(false);
        expect(controllerMatchesSystem(hybrid, { systemVoltage: null, systemType: "dc-charger" })).toBe(false);
        expect(controllerMatchesSystem(hybrid, { systemVoltage: null, systemType: "grid-connected", filterHouseBackup: true })).toBe(false);
    });
});
