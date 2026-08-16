'use strict';

// Unit tests for the publication-identity logic introduced for issue #205.
//
// The loader (assets/hf-data-loader.js) is a browser script with no module
// export surface, so we load it in a Node vm sandbox and override the source
// dispatch functions to drive the pure logic through loadLeaderboardData.
//
// Scenarios covered (issue #205 acceptance criteria):
//   - canonical empty + stale HF/local non-empty -> authoritative empty state
//   - canonical unavailable + exact matching mirror -> fallback is used
//   - canonical unavailable + marker/checksum mismatch -> fail closed
//   - atomic single/multi/compare selection (mixed generations never merge)

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const LOADER_PATH = path.join(__dirname, '..', 'assets', 'hf-data-loader.js');
const SOURCE = fs.readFileSync(LOADER_PATH, 'utf8');

function loadSandbox() {
    const sandbox = {
        window: {},
        console,
        fetch: async () => {
            throw new Error('fetch not expected in tests');
        },
        setTimeout,
        clearTimeout,
    };
    sandbox.window.HFDataLoader = undefined;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'hf-data-loader.js' });
    return sandbox;
}

function emptySnapshot() {
    return { single: [], multi: [], historical: [], compare: null };
}

test('canonical EMPTY snapshot renders empty state and does not revive stale HF/local', async () => {
    const sandbox = loadSandbox();
    const calls = { single: [], multi: [], compare: [], lastLoaded: [], cached: [] };

    sandbox.getSourcePriority = () => ['github', 'hf', 'local'];
    sandbox.loadSnapshotFromSource = async (source) => {
        calls.single.push(source);
        throw Object.assign(new Error('empty canonical'), { isEmptySnapshot: true });
    };
    sandbox.writeCache = (data, marker) => calls.cached.push({ data, marker });
    sandbox.setLastLoadedSource = (source) => calls.lastLoaded.push(source);

    const result = await sandbox.loadLeaderboardData();

    // Authoritative empty state, no staleness flag, no stale revival.
    assert.strictEqual(JSON.stringify(result), JSON.stringify(emptySnapshot()));
    assert.strictEqual(result.staleness, undefined);
    // Only the canonical source was ever consulted; HF/local never loaded.
    assert.strictEqual(JSON.stringify(calls.single), JSON.stringify(['github']));
    assert.strictEqual(JSON.stringify(calls.lastLoaded), JSON.stringify(['github']));
    // A cache entry was written so the empty state is reproducible offline.
    assert.strictEqual(calls.cached.length, 1);
    assert.strictEqual(JSON.stringify(calls.cached[0].data), JSON.stringify(emptySnapshot()));
});

test('canonical UNAVAILABLE falls back to an exact mirrored publication', async () => {
    const sandbox = loadSandbox();
    const mirror = { single: [{ id: 'mirror' }], multi: [], compare: null };

    sandbox.getSourcePriority = () => ['github', 'hf', 'local'];
    sandbox.loadSnapshotFromSource = async (source) => {
        if (source === 'github') {
            throw new Error('github network-unavailable');
        }
        if (source === 'hf') {
            return { data: mirror, marker: '2026-08-01:abcd1234' };
        }
        throw new Error('local should not be reached');
    };
    sandbox.getExpectedCanonicalIdentity = async () => ({
        marker: '2026-08-01:abcd1234',
        targetRegistry: '',
    });
    sandbox.setLastLoadedSource = () => {};

    const result = await sandbox.loadLeaderboardData();
    assert.strictEqual(result, mirror);
    assert.strictEqual(result.staleness, undefined);
});

test('canonical UNAVAILABLE + mismatched marker fails closed (no stale revival)', async () => {
    const sandbox = loadSandbox();

    sandbox.getSourcePriority = () => ['github', 'hf', 'local'];
    sandbox.loadSnapshotFromSource = async (source) => {
        if (source === 'github') {
            throw new Error('github network-unavailable');
        }
        // Both fallbacks carry a DIFFERENT publication marker than canonical.
        return { data: { single: [{ id: 'stale' }], multi: [], compare: null }, marker: 'DIFFERENT-MARKER' };
    };
    sandbox.getExpectedCanonicalIdentity = async () => ({
        marker: 'CANONICAL-MARKER',
        targetRegistry: '',
    });
    sandbox.setLastLoadedSource = () => {};

    const result = await sandbox.loadLeaderboardData();
    assert.strictEqual(result.single.length, 0);
    assert.strictEqual(result.multi.length, 0);
    assert.strictEqual(result.staleness, 'no-verified-fallback');
});

test('canonical UNAVAILABLE + mismatched target-registry checksum fails closed', async () => {
    const sandbox = loadSandbox();

    sandbox.getSourcePriority = () => ['github', 'hf'];
    sandbox.loadSnapshotFromSource = async (source) => {
        if (source === 'github') {
            throw new Error('github network-unavailable');
        }
        return {
            data: { single: [{ target_registry_sha256: 'fallback-hash-B' }], multi: [], compare: null },
            marker: '',
        };
    };
    sandbox.getExpectedCanonicalIdentity = async () => ({
        marker: '',
        targetRegistry: 'canonical-hash-A',
    });
    sandbox.setLastLoadedSource = () => {};

    const result = await sandbox.loadLeaderboardData();
    assert.strictEqual(result.staleness, 'no-verified-fallback');
});

test('publicationIdentitiesMatch rejects marker and checksum divergence', () => {
    const sandbox = loadSandbox();
    const { publicationIdentitiesMatch, buildPublicationIdentity } = sandbox;

    const a = buildPublicationIdentity(
        { single: [{ target_registry_sha256: 'abc' }], multi: [], compare: null },
        'marker-1'
    );

    // Exact match.
    const b = buildPublicationIdentity(
        { single: [{ target_registry_sha256: 'abc' }], multi: [], compare: null },
        'marker-1'
    );
    assert.strictEqual(publicationIdentitiesMatch(a, b), true);

    // Marker differs.
    const c = buildPublicationIdentity({ single: [], multi: [], compare: null }, 'marker-2');
    assert.strictEqual(publicationIdentitiesMatch(a, c), false);

    // Checksum differs.
    const d = buildPublicationIdentity({ single: [], multi: [], compare: null }, 'marker-1');
    d.targetRegistry = 'different-hash';
    assert.strictEqual(publicationIdentitiesMatch(a, d), false);
});

test('getPublicationTargetRegistryFingerprint refuses to merge mixed generations', () => {
    const sandbox = loadSandbox();
    const { getPublicationTargetRegistryFingerprint } = sandbox;

    // No generation declares a checksum -> '' (matches on marker only).
    assert.strictEqual(
        getPublicationTargetRegistryFingerprint({ single: [], multi: [], compare: null }),
        ''
    );

    // A single shared generation -> the shared hash.
    assert.strictEqual(
        getPublicationTargetRegistryFingerprint({
            single: [{ target_registry_sha256: 'gen-1' }],
            multi: [{ target_registry_sha256: 'gen-1' }],
            compare: { groups: [{ engines: [{ target_registry_sha256: 'gen-1' }] }] },
        }),
        'gen-1'
    );

    // Mixed generations across single/multi/compare -> null (never mergeable).
    assert.strictEqual(
        getPublicationTargetRegistryFingerprint({
            single: [{ target_registry_sha256: 'gen-1' }],
            multi: [{ target_registry_sha256: 'gen-2' }],
            compare: null,
        }),
        null
    );
});
