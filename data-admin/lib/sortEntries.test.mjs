import { describe, expect, it } from "vitest";
import { sortEntries } from "./sortEntries.mjs";

describe("sortEntries", () => {
    it("sorts panels by panel-series then ascending power", () => {
        const input = [
            { "panel-series": "B", power: 420 },
            { "panel-series": "A", power: 500 },
            { "panel-series": "A", power: 430 },
        ];
        const out = sortEntries("panels", input);
        expect(out.map((x) => `${x["panel-series"]}:${x.power}`)).toEqual(["A:430", "A:500", "B:420"]);
    });

    it("sorts controllers by modelNumber/name", () => {
        const input = [{ name: "Zeta" }, { modelNumber: "A10" }, { modelNumber: "B20" }];
        const out = sortEntries("controllers", input);
        expect(out.map((x) => x.modelNumber || x.name)).toEqual(["A10", "B20", "Zeta"]);
    });
});
