import { describe, expect, it } from "vitest";
import { isPrivateOrSpecialIp, assertSafeFetchUrl } from "./normalize.mjs";
import { validateEntry, validateEntryArray } from "./validateEntry.mjs";

describe("isPrivateOrSpecialIp", () => {
    it("blocks loopback, RFC1918, link-local, metadata", () => {
        expect(isPrivateOrSpecialIp("127.0.0.1")).toBe(true);
        expect(isPrivateOrSpecialIp("10.0.0.1")).toBe(true);
        expect(isPrivateOrSpecialIp("172.16.0.1")).toBe(true);
        expect(isPrivateOrSpecialIp("192.168.1.1")).toBe(true);
        expect(isPrivateOrSpecialIp("169.254.169.254")).toBe(true);
        expect(isPrivateOrSpecialIp("0.0.0.0")).toBe(true);
        expect(isPrivateOrSpecialIp("100.64.1.1")).toBe(true);
    });

    it("allows public IPv4", () => {
        expect(isPrivateOrSpecialIp("8.8.8.8")).toBe(false);
        expect(isPrivateOrSpecialIp("1.1.1.1")).toBe(false);
    });

    it("blocks IPv6 loopback and unique-local", () => {
        expect(isPrivateOrSpecialIp("::1")).toBe(true);
        expect(isPrivateOrSpecialIp("::")).toBe(true);
        expect(isPrivateOrSpecialIp("0:0:0:0:0:0:0:1")).toBe(true);
        expect(isPrivateOrSpecialIp("fc00::1")).toBe(true);
        expect(isPrivateOrSpecialIp("fe80::1")).toBe(true);
    });
});

describe("assertSafeFetchUrl", () => {
    it("rejects non-http schemes", async () => {
        const r = await assertSafeFetchUrl("file:///etc/passwd");
        expect(r.ok).toBe(false);
    });

    it("rejects literal private IPs", async () => {
        const r = await assertSafeFetchUrl("http://127.0.0.1/secret");
        expect(r.ok).toBe(false);
        expect(r.status).toMatch(/private/i);
    });

    it("rejects metadata IP", async () => {
        const r = await assertSafeFetchUrl("http://169.254.169.254/latest/meta-data/");
        expect(r.ok).toBe(false);
    });
});

describe("validateEntry", () => {
    const schema = {
        fieldOrder: ["name", "power", "active"],
        types: { name: "string", power: "number", active: "boolean" },
    };

    it("accepts typed entry and null numbers", () => {
        expect(validateEntry({ name: "A", power: null, active: true }, schema).ok).toBe(true);
    });

    it("rejects wrong types", () => {
        const r = validateEntry({ name: "A", power: "400", active: true }, schema);
        expect(r.ok).toBe(false);
    });

    it("requires array for file bodies", () => {
        expect(validateEntryArray({}, schema).ok).toBe(false);
        expect(validateEntryArray([{ name: "A", power: 1, active: false }], schema).ok).toBe(true);
    });
});
