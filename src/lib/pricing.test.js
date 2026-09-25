import { describe, it, expect } from "vitest";
import {
    hasKnownPrice,
    knownPrice,
    formatMoney,
    formatUnitPrice,
    priceAge,
    priceAgeText,
    compareMissingLast,
} from "./pricing";

describe("known prices", () => {
    it("treats 0, blank, missing and junk as unknown", () => {
        for (const price of [0, "", null, undefined, "abc", -5]) {
            expect(hasKnownPrice({ price })).toBe(false);
            expect(knownPrice({ price })).toBeNull();
        }
        expect(knownPrice({ price: "84.88" })).toBe(84.88);
    });
});

describe("formatting", () => {
    it("formats money with pence", () => {
        expect(formatMoney(2248.8)).toBe("£2,248.80");
        expect(formatMoney(null)).toBe("—");
        expect(formatUnitPrice({ price: 0 })).toBe("Price unavailable");
        expect(formatUnitPrice({ price: 84.88 })).toBe("£84.88");
    });
});

describe("priceAge", () => {
    const now = new Date("2026-09-25T12:00:00Z");

    it("labels the month and flags checks older than 60 days", () => {
        expect(priceAge("2026-08-08", now)).toEqual({ label: "Aug 2026", days: 48, isStale: false });
        expect(priceAge("2026-06-01", now).isStale).toBe(true);
        expect(priceAgeText("2026-06-01", now)).toBe("Price checked Jun 2026 (may be out of date)");
    });

    it("returns null or empty text when never checked", () => {
        expect(priceAge("", now)).toBeNull();
        expect(priceAgeText(undefined, now)).toBe("");
    });
});

describe("compareMissingLast", () => {
    it("puts missing values last and defers otherwise", () => {
        expect(compareMissingLast(null, 1)).toBe(1);
        expect(compareMissingLast(1, null)).toBe(-1);
        expect(compareMissingLast(null, null)).toBe(0);
        expect(compareMissingLast(1, 2)).toBeNull();
    });
});
