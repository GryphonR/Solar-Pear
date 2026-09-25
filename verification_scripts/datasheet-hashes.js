/**
 * @file datasheet-hashes.js
 * Datasheet fingerprinting (roadmap 3.4). Downloads every catalogue datasheet URL, records its
 * SHA-256, size and content type in verification_scripts/datasheet-hashes.json, and reports:
 * - CHANGED: the file differs from the last recorded hash (a silent manufacturer revision), so
 *   any product reviewed against it should be re-checked;
 * - FAILED: the URL no longer downloads;
 * - NEW: first time the URL has been fingerprinted.
 *
 *   npm run verify:datasheets                 # all URLs
 *   npm run verify:datasheets -- --limit=10   # first 10 (for a quick test)
 *   npm run verify:datasheets -- --dry-run    # report without writing the hash file
 *
 * Exits 1 when any datasheet changed or failed, so a scheduled job can open an issue/PR.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { PANELS_DIR, CONTROLLERS_DIR, ROOT } from './lib/paths.js';

const HASH_FILE = path.join(ROOT, 'verification_scripts/datasheet-hashes.json');
const CONCURRENCY = 4;
const TIMEOUT_MS = 30000;
const MAX_BYTES = 40 * 1024 * 1024;

async function loadDir(dir) {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const lists = await Promise.all(
        files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')))
    );
    return lists.flat();
}

async function fingerprint(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'SolarPear-datasheet-check/1.0 (+https://solarpear.echook.uk)' },
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) return { ok: false, error: `Too large (${buf.length} bytes)` };
        return {
            ok: true,
            sha256: crypto.createHash('sha256').update(buf).digest('hex'),
            bytes: buf.length,
            contentType: res.headers.get('content-type') || '',
        };
    } catch (e) {
        return { ok: false, error: e.name === 'AbortError' ? 'Timed out' : e.message };
    } finally {
        clearTimeout(timer);
    }
}

async function main() {
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
    const dryRun = process.argv.includes('--dry-run');

    const items = [...(await loadDir(PANELS_DIR)), ...(await loadDir(CONTROLLERS_DIR))];
    const byUrl = new Map();
    for (const item of items) {
        const url = item.datasheetUrl;
        if (!url || !/^https?:\/\//i.test(url)) continue;
        if (!byUrl.has(url)) byUrl.set(url, []);
        byUrl.get(url).push(item.model || item.id);
    }
    const urls = [...byUrl.keys()].slice(0, limit);

    let previous = {};
    try {
        previous = JSON.parse(await fs.readFile(HASH_FILE, 'utf-8'));
    } catch {
        previous = {};
    }
    const next = { ...previous };
    const today = new Date().toISOString().slice(0, 10);
    const report = { NEW: [], CHANGED: [], FAILED: [], UNCHANGED: 0 };

    let index = 0;
    async function worker() {
        while (index < urls.length) {
            const url = urls[index++];
            const result = await fingerprint(url);
            const products = byUrl.get(url);
            const prev = previous[url];
            if (!result.ok) {
                report.FAILED.push(`${url}  (${result.error})  → ${products.join(', ')}`);
                next[url] = { ...(prev || {}), lastError: result.error, lastCheckedAt: today };
                continue;
            }
            const entry = {
                sha256: result.sha256,
                bytes: result.bytes,
                contentType: result.contentType,
                firstSeenAt: prev?.sha256 === result.sha256 ? prev.firstSeenAt : today,
                lastCheckedAt: today,
                products,
            };
            if (!prev?.sha256) report.NEW.push(url);
            else if (prev.sha256 !== result.sha256) report.CHANGED.push(`${url}  → re-check ${products.join(', ')}`);
            else report.UNCHANGED++;
            next[url] = entry;
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

    for (const key of ['CHANGED', 'FAILED', 'NEW']) {
        if (report[key].length) console.log(`\n${key} (${report[key].length}):\n  ${report[key].join('\n  ')}`);
    }
    console.log(
        `\n${urls.length} datasheet URL(s): ${report.UNCHANGED} unchanged, ${report.NEW.length} new, ${report.CHANGED.length} changed, ${report.FAILED.length} failed`
    );

    if (!dryRun) {
        const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
        await fs.writeFile(HASH_FILE, JSON.stringify(sorted, null, 2) + '\n');
        console.log(`Wrote ${path.relative(ROOT, HASH_FILE)}`);
    }
    process.exitCode = report.CHANGED.length || report.FAILED.length ? 1 : 0;
}

await main();
