import { test as base, expect } from '@playwright/test';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

// Every test gets a fresh browser context, so the browser cache never kicks in and
// each page load re-downloads Bootstrap from the CDN (~1.2s of the ~1.5s load time).
// Serve those assets from a local cache instead: first run downloads them, later runs
// (and the other workers) read them off disk.
const CDN_PATTERN = /^https:\/\/cdn\.jsdelivr\.net\//;
const CACHE_DIR = join(__dirname, '..', '.cdn-cache');

// Per-worker memory cache on top of the disk cache, so repeat hits skip the file I/O.
const memoryCache = new Map();

function cachePath(url) {
    return join(CACHE_DIR, createHash('sha1').update(url).digest('hex'));
}

function readCache(url) {
    if (memoryCache.has(url)) return memoryCache.get(url);

    const file = cachePath(url);
    if (!existsSync(file) || !existsSync(`${file}.type`)) return null;

    const entry = {
        body: readFileSync(file),
        contentType: readFileSync(`${file}.type`, 'utf8'),
    };
    memoryCache.set(url, entry);
    return entry;
}

function writeCache(url, entry) {
    memoryCache.set(url, entry);
    mkdirSync(CACHE_DIR, { recursive: true });

    // Write to a worker-private temp name first so parallel workers never expose a
    // half-written file to each other.
    const file = cachePath(url);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, entry.body);
    renameSync(tmp, file);
    writeFileSync(`${file}.type`, entry.contentType);
}

export const test = base.extend({
    context: async ({ context }, use) => {
        await context.route(CDN_PATTERN, async (route) => {
            const url = route.request().url();

            let entry = readCache(url);
            if (!entry) {
                const response = await route.fetch();
                if (!response.ok()) {
                    await route.fulfill({ response });
                    return;
                }
                entry = {
                    body: await response.body(),
                    contentType: response.headers()['content-type'] || 'application/octet-stream',
                };
                writeCache(url, entry);
            }

            // Only the content type is replayed: the original encoding/length headers
            // describe the compressed payload, but body() hands back decoded bytes.
            await route.fulfill({
                status: 200,
                headers: { 'content-type': entry.contentType },
                body: entry.body,
            });
        });

        await use(context);
    },
});

export { expect };
