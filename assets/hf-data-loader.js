/**
 * Hugging Face Data Loader for LLM Engine Leaderboard
 *
 * 从公开快照源加载 benchmark 结果
 * 支持 GitHub / Hugging Face / 本地快照，无需后端服务
 */

const HF_CONFIG = {
    // Hugging Face 仓库配置
    repo: 'intellistream/vllm-hust-benchmark-results',
    branch: 'main',

    // 数据文件路径（在 HF repo 中的路径）
    files: {
        single: 'leaderboard_single.json',
        multi: 'leaderboard_multi.json',
        historical: 'leaderboard_historical.json',
        compare: 'leaderboard_compare.json',
        lastUpdated: 'last_updated.json'
    },

    // 备用：本地数据（当 HF 不可用时）
    fallbackToLocal: true,
    localPath: './data/',

    // 前端缓存，避免频繁刷新时重复全量拉取
    cacheTTLms: 5 * 60 * 1000,

    // The atomic bundled snapshot paints immediately. Marker checks and remote
    // refreshes run after first paint so a slow data host cannot blank the chart.
    validateWithMarker: true,

    // 首屏展示后，在后台校验远端快照是否更新。
    backgroundRemoteSync: true,

    // 命中 session cache 时，marker 校验只短暂等待；慢网络下先展示缓存，
    // 再交给后台同步补齐最新远端数据。
    cacheMarkerTimeoutMs: 1200,

    // A stalled remote must not leave the stable-trend screen on a spinner.
    // The bundled snapshot is an atomic publication mirror and takes over once
    // the remote request budget is exhausted.
    remoteRequestTimeoutMs: 4500,
    canonicalIdentityTimeoutMs: 1200,

    // When the first remote attempt already timed out, do not immediately
    // repeat the same requests behind a successfully rendered local snapshot.
    offlineRetryDelayMs: 2500,

    // Hugging Face 远端使用镜像，官方站点作为回退
    endpoints: [
        'https://hf-mirror.com',
        'https://huggingface.co'
    ],

    // 数据源优先级：随站原子快照首屏展示，GitHub 在后台校验并刷新。
    sources: ['local', 'github'],

    // GitHub 仓库配置（用于不依赖 HF 的数据发布方式）
    github: {
        repo: 'vLLM-HUST/vllm-hust-benchmark',
        branch: 'main',
        dataPath: 'leaderboard-data/snapshots'
    }
};

const CACHE_KEY = 'llm_engine_hf_leaderboard_cache_v11_stable_trend';
const LOCAL_DATA_CACHE_BUST = 'leaderboard-data-20260817-stable-trend-2';
const BACKGROUND_SYNC_EVENT = 'vllm-hust:leaderboard-data-updated';
const PROGRESS_EVENT = 'vllm-hust:leaderboard-data-progress';
let lastLoadedSource = null;
let backgroundSyncPromise = null;

function getUniqueEndpoints() {
    const configured = Array.isArray(HF_CONFIG.endpoints) ? HF_CONFIG.endpoints : [];
    const fromWindow = typeof window !== 'undefined' && typeof window.VLLM_HF_ENDPOINT === 'string'
        ? [window.VLLM_HF_ENDPOINT]
        : [];
    const fromQuery = typeof window !== 'undefined'
        ? [new URLSearchParams(window.location.search).get('hfEndpoint')]
        : [];

    const raw = [...fromQuery, ...fromWindow, ...configured]
        .map((item) => String(item || '').trim().replace(/\/$/, ''))
        .filter(Boolean);

    return [...new Set(raw)];
}

function buildDatasetResolveUrl(endpoint, filename) {
    return `${endpoint}/datasets/${HF_CONFIG.repo}/resolve/${HF_CONFIG.branch}/${filename}`;
}

function buildDatasetApiUrl(endpoint) {
    return `${endpoint}/api/datasets/${HF_CONFIG.repo}`;
}

function normalizePathPrefix(rawPrefix) {
    const normalized = String(rawPrefix || '').trim().replace(/^\/+|\/+$/g, '');
    return normalized ? `${normalized}/` : '';
}

function getGithubConfig() {
    const fromWindow = typeof window !== 'undefined' && window.VLLM_GH_DATA_REPO
        ? String(window.VLLM_GH_DATA_REPO)
        : '';
    const query = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;

    const repo = (query?.get('ghRepo') || fromWindow || HF_CONFIG.github.repo || '').trim();
    const branch = (query?.get('ghBranch') || HF_CONFIG.github.branch || 'main').trim();
    const dataPath = (query?.get('ghPath') || HF_CONFIG.github.dataPath || 'data').trim();

    return {
        repo,
        branch,
        dataPath,
    };
}

function buildGitHubRawUrl(filename) {
    const github = getGithubConfig();
    const prefix = normalizePathPrefix(github.dataPath);
    return `https://raw.githubusercontent.com/${github.repo}/${github.branch}/${prefix}${filename}`;
}

function getSourcePriority() {
    const query = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
    const sourceOverride = (query?.get('dataSource') || '').trim().toLowerCase();
    if (sourceOverride === 'github') {
        return ['github', 'hf', 'local'];
    }
    if (sourceOverride === 'hf') {
        return ['hf', 'github', 'local'];
    }
    if (sourceOverride === 'local') {
        return ['local', 'github', 'hf'];
    }

    return Array.isArray(HF_CONFIG.sources) && HF_CONFIG.sources.length
        ? HF_CONFIG.sources
        : ['hf', 'local'];
}

function readCacheEnvelope() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.savedAt || !parsed.data) {
            return null;
        }
        const age = Date.now() - parsed.savedAt;
        if (age > HF_CONFIG.cacheTTLms) {
            return null;
        }
        return parsed;
    } catch (_error) {
        return null;
    }
}

function writeCache(data, marker = null) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            savedAt: Date.now(),
            marker,
            data
        }));
    } catch (_error) {
        // ignore cache write failures
    }
}

function clearCache() {
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch (_error) {
        // ignore cache clear failures
    }
}

function setLastLoadedSource(source) {
    lastLoadedSource = source;
}

function getLastLoadedSource() {
    return lastLoadedSource;
}

function withTimeout(promise, timeoutMs, label) {
    if (!timeoutMs || timeoutMs <= 0) {
        return promise;
    }

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`${label || 'Operation'} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise.then(
            (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

async function fetchWithTimeout(url, options = {}, label = 'Remote leaderboard request') {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), HF_CONFIG.remoteRequestTimeoutMs)
        : null;
    try {
        return await withTimeout(
            fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }),
            HF_CONFIG.remoteRequestTimeoutMs,
            label
        );
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function getLatestMarkerWithTimeout(sourcePriority, timeoutMs) {
    try {
        return await withTimeout(
            getLatestMarker(sourcePriority),
            timeoutMs,
            'Leaderboard marker check'
        );
    } catch (error) {
        console.warn('[HF Loader] Marker check skipped:', error?.message || error);
        return null;
    }
}

async function getLatestMarker(sourcePriority = getSourcePriority()) {
    const loaders = {
        github: loadFromGitHub,
        hf: loadFromHuggingFace,
        local: loadFromLocal,
    };

    for (const source of sourcePriority) {
        const loader = loaders[source];
        if (!loader) {
            continue;
        }
        if (source === 'local' && !HF_CONFIG.fallbackToLocal) {
            continue;
        }

        try {
            const marker = await loader(HF_CONFIG.files.lastUpdated);
            if (marker && marker.last_updated) {
                return marker.last_updated;
            }
        } catch (_error) {
            // ignore and try the next configured source
        }
    }

    return null;
}

function normalizeEntryArray(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && typeof payload === 'object') {
        return [payload];
    }
    return [];
}

function isCompareSnapshotUsable(compareSnapshot) {
    if (!compareSnapshot || typeof compareSnapshot !== 'object') {
        return true;
    }

    const groups = Array.isArray(compareSnapshot.groups) ? compareSnapshot.groups : [];
    const goalPairs = Array.isArray(compareSnapshot?.goal_progress?.pairs)
        ? compareSnapshot.goal_progress.pairs
        : [];
    const declaredGroupCount = Number(compareSnapshot.group_count);
    const declaredPairCount = Number(compareSnapshot.preferred_pair_count);
    const hasDeclaredCounts =
        Number.isInteger(declaredGroupCount) &&
        declaredGroupCount >= 0 &&
        Number.isInteger(declaredPairCount) &&
        declaredPairCount >= 0;

    if (hasDeclaredCounts) {
        return declaredGroupCount === groups.length && declaredPairCount === goalPairs.length;
    }

    // Older snapshots do not declare counts. Empty arrays are a valid business
    // state while canonical baselines are being rebuilt; their emptiness alone
    // must not turn otherwise usable single/multi snapshots into a fatal load.
    return Array.isArray(compareSnapshot.groups);
}

function isSnapshotEmpty(snapshot) {
    const single = Array.isArray(snapshot?.single) ? snapshot.single : [];
    const multi = Array.isArray(snapshot?.multi) ? snapshot.multi : [];
    const historical = Array.isArray(snapshot?.historical) ? snapshot.historical : [];
    return single.length === 0 && multi.length === 0 && historical.length === 0;
}

// -------------------------------------------------------------------------
// Publication identity (issue #205)
//
// The canonical source's atomic publication marker is authoritative, including
// an intentionally empty snapshot. A fallback source may only replace an
// unavailable canonical source when it carries the exact same publication
// identity (atomic marker + target-registry checksum) - never merely because it
// is non-empty.
// -------------------------------------------------------------------------

function getEntryTargetRegistryHash(entry) {
    return String(
        entry?.target_registry_sha256
            || entry?.metadata?.target_registry_sha256
            || ''
    ).trim();
}

// Consensus target-registry checksum across single/multi/compare of one
// publication. Returns the shared hash, '' when no entry declares one, or null
// when entries disagree (mixed generations - never mergeable).
function getPublicationTargetRegistryFingerprint(result) {
    const hashes = new Set();
    const collect = (entries) => {
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
            const hash = getEntryTargetRegistryHash(entry);
            if (hash) {
                hashes.add(hash);
            }
        });
    };
    collect(result?.single);
    collect(result?.multi);
    const groups = Array.isArray(result?.compare?.groups) ? result.compare.groups : [];
    groups.forEach((group) => {
        collect(group?.engines);
    });
    if (hashes.size > 1) {
        return null;
    }
    return hashes.size === 1 ? [...hashes][0] : '';
}

function buildPublicationIdentity(result, marker) {
    return {
        marker: String(marker || '').trim(),
        targetRegistry: getPublicationTargetRegistryFingerprint(result),
    };
}

// Two identities match only when every declared component agrees. A marker
// (atomic publication ID) or checksum present on either side must match; a
// mixed-generation fingerprint (null) never matches because the files cannot
// be atomically reconciled.
function publicationIdentitiesMatch(a, b) {
    if (!a || !b) {
        return false;
    }
    if (a.targetRegistry === null || b.targetRegistry === null) {
        return false;
    }
    if (a.marker && b.marker && a.marker !== b.marker) {
        return false;
    }
    if (a.targetRegistry && b.targetRegistry && a.targetRegistry !== b.targetRegistry) {
        return false;
    }
    return true;
}

function assertUsableLeaderboardPayload(result, source) {
    // Issue #200: a snapshot with zero benchmark records cannot populate the
    // leaderboard. Treat it as unusable so the loader falls through to the next
    // source instead of returning an empty page while other sources still hold data.
    if (isSnapshotEmpty(result)) {
        const emptyError = new Error(`Empty leaderboard snapshot from ${source}: no benchmark records`);
        emptyError.isEmptySnapshot = true;
        throw emptyError;
    }

    if (isCompareSnapshotUsable(result.compare)) {
        return;
    }

    const groups = Array.isArray(result.compare?.groups) ? result.compare.groups.length : 0;
    const goalPairs = Array.isArray(result.compare?.goal_progress?.pairs)
        ? result.compare.goal_progress.pairs.length
        : 0;
    const scopes = Array.isArray(result.compare?.hard_constraints?.scopes)
        ? result.compare.hard_constraints.scopes.length
        : 0;

    throw new Error(
        `Incomplete compare snapshot from ${source}: groups=${groups}, goal_pairs=${goalPairs}, hard_constraint_scopes=${scopes}`
    );
}

function splitSingleAndMulti(entries) {
    const single = [];
    const multi = [];
    entries.forEach((entry) => {
        const nodeCount = entry?.cluster?.node_count || 1;
        if (nodeCount > 1) {
            multi.push(entry);
        } else {
            single.push(entry);
        }
    });
    return { single, multi };
}

function normalizeKeyPart(value) {
    const raw = String(value ?? 'unknown').trim().toLowerCase();
    return raw.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function extractEngine(entry) {
    const direct = entry?.engine || entry?.metadata?.engine;
    if (direct && typeof direct === 'string') {
        const normalized = direct.trim().toLowerCase();
        if (normalized) {
            return normalized;
        }
    }

    return 'unknown';
}

function extractEngineVersion(entry) {
    const direct = entry?.engine_version || entry?.metadata?.engine_version;
    if (direct && typeof direct === 'string') {
        const normalized = direct.trim();
        if (normalized) {
            return normalized;
        }
    }

    return 'unknown';
}

function extractWorkloadForKey(entry) {
    const direct = entry?.workload?.name || entry?.workload_name || entry?.metadata?.workload;
    if (direct && typeof direct === 'string') {
        return direct.toUpperCase();
    }

    return 'UNKNOWN';
}

function buildIdempotencyKey(entry) {
    if (entry?.metadata?.idempotency_key) {
        return String(entry.metadata.idempotency_key);
    }

    return [
        normalizeKeyPart(extractEngine(entry)),
        normalizeKeyPart(extractEngineVersion(entry)),
        normalizeKeyPart(extractWorkloadForKey(entry)),
        normalizeKeyPart(entry?.model?.name),
        normalizeKeyPart(entry?.model?.precision),
        normalizeKeyPart(entry?.hardware?.chip_model),
        normalizeKeyPart(entry?.hardware?.chip_count),
        normalizeKeyPart(entry?.cluster?.node_count ?? 1),
        normalizeKeyPart(entry?.config_type),
    ].join('|');
}

function parseEntryTimestamp(entry) {
    const submittedAt = entry?.metadata?.submitted_at;
    if (submittedAt) {
        const ts = Date.parse(submittedAt);
        if (!Number.isNaN(ts)) {
            return ts;
        }
    }

    const releaseDate = entry?.metadata?.release_date;
    if (releaseDate) {
        const ts = Date.parse(releaseDate);
        if (!Number.isNaN(ts)) {
            return ts;
        }
    }

    return 0;
}

function preferNewerEntry(current, candidate) {
    const currentTs = parseEntryTimestamp(current);
    const candidateTs = parseEntryTimestamp(candidate);

    if (candidateTs !== currentTs) {
        return candidateTs > currentTs ? candidate : current;
    }

    const currentTps = Number(current?.metrics?.throughput_tps ?? 0);
    const candidateTps = Number(candidate?.metrics?.throughput_tps ?? 0);
    if (candidateTps !== currentTps) {
        return candidateTps > currentTps ? candidate : current;
    }

    return current;
}

function mergeByEntryId(entries) {
    const byEntryId = new Map();
    const byIdentityKey = new Map();

    entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        const entryId = entry?.entry_id;
        if (entryId) {
            const existingById = byEntryId.get(entryId);
            byEntryId.set(entryId, existingById ? preferNewerEntry(existingById, entry) : entry);
            return;
        }

        const identityKey = buildIdempotencyKey(entry);
        const existingByKey = byIdentityKey.get(identityKey);
        byIdentityKey.set(
            identityKey,
            existingByKey ? preferNewerEntry(existingByKey, entry) : entry,
        );
    });

    byEntryId.forEach((entry) => {
        const identityKey = buildIdempotencyKey(entry);
        const existingByKey = byIdentityKey.get(identityKey);
        byIdentityKey.set(
            identityKey,
            existingByKey ? preferNewerEntry(existingByKey, entry) : entry,
        );
    });

    return [...byIdentityKey.values()];
}

/**
 * 从 Hugging Face Hub 加载 JSON 文件
 * @param {string} filename - 文件名
 * @returns {Promise<Array>} - 解析后的 JSON 数据
 */
async function loadFromHuggingFace(filename) {
    const endpoints = getUniqueEndpoints();
    let lastError = null;

    for (const endpoint of endpoints) {
        const url = buildDatasetResolveUrl(endpoint, filename);
        console.log(`[HF Loader] Fetching: ${url}`);
        try {
            const response = await fetchWithTimeout(url, {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-cache'  // 确保获取最新数据
            });

            if (!response.ok) {
                throw new Error(`HF API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`[HF Loader] Endpoint failed: ${endpoint}`, error?.message || error);
        }
    }

    throw new Error(lastError?.message || 'All HF endpoints failed');
}

/**
 * 从本地加载 JSON 文件（备用）
 * @param {string} filename - 文件名
 * @returns {Promise<Array>} - 解析后的 JSON 数据
 */
async function loadFromLocal(filename) {
    const separator = filename.includes('?') ? '&' : '?';
    const url = `${HF_CONFIG.localPath}${filename}${separator}v=${LOCAL_DATA_CACHE_BUST}`;
    console.log(`[HF Loader] Fallback to local: ${url}`);

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Local file error: ${response.status}`);
    }
    return await response.json();
}

async function loadFromGitHub(filename) {
    const github = getGithubConfig();
    if (!github.repo) {
        throw new Error('GitHub data repo is not configured');
    }

    const url = buildGitHubRawUrl(filename);
    console.log(`[HF Loader] Fetching GitHub raw: ${url}`);

    const response = await fetchWithTimeout(url, {
        headers: {
            'Accept': 'application/json'
        },
        cache: 'no-cache'
    });

    if (!response.ok) {
        throw new Error(`GitHub raw error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

async function loadOptionalJson(loader, filename) {
    try {
        return await loader(filename);
    } catch (error) {
        console.warn(`[HF Loader] Optional file unavailable: ${filename}`, error?.message || error);
        return null;
    }
}

function dispatchProgress(payload, onProgress) {
    if (typeof onProgress === 'function') {
        onProgress(payload);
    }
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: payload }));
}

async function loadSnapshotFromSource(source, markerPriority = [source], options = {}) {
    const loaders = {
        github: loadFromGitHub,
        hf: loadFromHuggingFace,
        local: loadFromLocal,
    };
    const loader = loaders[source];
    if (!loader) {
        throw new Error(`Unknown leaderboard data source: ${source}`);
    }

    const partial = {};
    const notifyFileLoaded = (key, value) => {
        partial[key] = value;
        dispatchProgress({
            source,
            key,
            data: { ...partial },
            complete: false
        }, options.onProgress);
        return value;
    };

    const markerPromise = getLatestMarker(markerPriority);
    const [singleData, multiData, historicalData, compareData, marker] = await Promise.all([
        loader(HF_CONFIG.files.single)
            .then((data) => notifyFileLoaded('single', normalizeEntryArray(data))),
        loader(HF_CONFIG.files.multi)
            .then((data) => notifyFileLoaded('multi', normalizeEntryArray(data))),
        loadOptionalJson(loader, HF_CONFIG.files.historical)
            .then((data) => notifyFileLoaded('historical', normalizeEntryArray(data))),
        loadOptionalJson(loader, HF_CONFIG.files.compare)
            .then((data) => notifyFileLoaded(
                'compare',
                data && typeof data === 'object' ? data : null
            )),
        markerPromise
    ]);

    const result = {
        single: singleData,
        multi: multiData,
        historical: historicalData,
        compare: compareData,
    };

    assertUsableLeaderboardPayload(result, source);
    dispatchProgress({
        source,
        data: result,
        complete: true
    }, options.onProgress);
    return { data: result, marker };
}

function getRemoteSourcePriority() {
    const preferred = getSourcePriority().filter((source) => source !== 'local');
    const fallback = ['github', 'hf'].filter((source) => !preferred.includes(source));
    return [...preferred, ...fallback];
}

function dispatchBackgroundUpdate(data, source, marker) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }
    window.dispatchEvent(new CustomEvent(BACKGROUND_SYNC_EVENT, {
        detail: { data, source, marker }
    }));
}

async function syncRemoteSnapshotInBackground() {
    if (!HF_CONFIG.backgroundRemoteSync) {
        return null;
    }
    if (backgroundSyncPromise) {
        return backgroundSyncPromise;
    }

    backgroundSyncPromise = (async () => {
        const cachedEnvelope = readCacheEnvelope();
        const currentMarker = cachedEnvelope?.marker || null;

        for (const source of getRemoteSourcePriority()) {
            try {
                const remoteMarker = await getLatestMarker([source]);
                if (!remoteMarker) {
                    continue;
                }
                if (currentMarker && remoteMarker === currentMarker) {
                    console.log(`[HF Loader] ✅ Background ${source} marker matched`);
                    return null;
                }

                console.log(`[HF Loader] ♻️ Background ${source} marker changed, refreshing data`);
                const snapshot = await loadSnapshotFromSource(source, [source]);
                writeCache(snapshot.data, snapshot.marker || remoteMarker);
                setLastLoadedSource(source);
                dispatchBackgroundUpdate(snapshot.data, source, snapshot.marker || remoteMarker);
                return snapshot.data;
            } catch (error) {
                console.warn(`[HF Loader] Background ${source} sync failed:`, error?.message || error);
            }
        }

        return null;
    })().finally(() => {
        backgroundSyncPromise = null;
    });

    return backgroundSyncPromise;
}

function startBackgroundSync() {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }

    const run = () => syncRemoteSnapshotInBackground();
    if (getLastLoadedSource() === 'local') {
        window.setTimeout(run, HF_CONFIG.offlineRetryDelayMs);
        return backgroundSyncPromise || Promise.resolve(null);
    }
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 2500 });
        return backgroundSyncPromise || Promise.resolve(null);
    }

    window.setTimeout(run, 0);
    return backgroundSyncPromise || Promise.resolve(null);
}

/**
 * 加载 leaderboard 数据（远端优先，失败则本地）
 * @returns {Promise<{single: Array, multi: Array, historical: Array, compare: Object}>}
 */
async function loadLeaderboardData(options = {}) {
    const cachedEnvelope = readCacheEnvelope();
    if (cachedEnvelope) {
        if (!isCompareSnapshotUsable(cachedEnvelope.data?.compare)) {
            clearCache();
            console.warn('[HF Loader] Ignoring unusable session cache');
        } else if (!HF_CONFIG.validateWithMarker) {
            setLastLoadedSource('cache');
            console.log('[HF Loader] ✅ Loaded from session cache');
            return cachedEnvelope.data;
        } else {
            const latestMarker = await getLatestMarkerWithTimeout(
                getSourcePriority(),
                HF_CONFIG.cacheMarkerTimeoutMs
            );
            if (latestMarker && cachedEnvelope.marker && cachedEnvelope.marker === latestMarker) {
                setLastLoadedSource('cache');
                console.log('[HF Loader] ✅ Loaded from session cache (marker matched)');
                return cachedEnvelope.data;
            }

            if (!latestMarker) {
                setLastLoadedSource('cache');
                console.log('[HF Loader] ⚠️ Marker unavailable, fallback to TTL cache');
                startBackgroundSync();
                return cachedEnvelope.data;
            }

            console.log('[HF Loader] ♻️ Marker changed, refreshing leaderboard data');
        }
    }

    const sourcePriority = getSourcePriority();
    const canonicalSource = sourcePriority[0];

    // 1. The canonical source is authoritative - even when it publishes an
    // intentional empty snapshot. Never fall through to stale downstream data
    // merely because it still holds records (issue #205).
    try {
        console.log(`[HF Loader] Loading canonical from ${canonicalSource}...`);
        const canonical = await loadSnapshotFromSource(canonicalSource, sourcePriority, {
            onProgress: options.onProgress
        });
        writeCache(canonical.data, canonical.marker);
        setLastLoadedSource(canonicalSource);
        console.log(
            `[HF Loader] ✅ Loaded canonical from ${canonicalSource}: ` +
            `${canonical.data.single.length} single, ${canonical.data.multi.length} multi`
        );
        return canonical.data;
    } catch (canonicalError) {
        if (canonicalError?.isEmptySnapshot) {
            // Canonical is reachable but intentionally empty -> authoritative
            // empty/admission state. Do not revive older HF/local records.
            writeCache({ single: [], multi: [], historical: [], compare: null }, null);
            setLastLoadedSource(canonicalSource);
            console.warn(
                `[HF Loader] ⚠️ Canonical ${canonicalSource} published an empty snapshot; ` +
                'showing empty admission state'
            );
            return { single: [], multi: [], historical: [], compare: null };
        }

        // Canonical is network-unavailable. Fall back ONLY to an exact mirrored
        // publication carrying the same atomic publication identity.
        console.warn(`[HF Loader] ⚠️ Canonical ${canonicalSource} unavailable:`, canonicalError?.message || canonicalError);
        const expectedIdentity = await getExpectedCanonicalIdentity(sourcePriority);
        if (!expectedIdentity) {
            console.warn('[HF Loader] ⚠️ Canonical publication identity unknown; cannot verify any fallback');
            return { single: [], multi: [], historical: [], compare: null, staleness: 'no-verified-fallback' };
        }

        // The bundled site snapshot was copied from the canonical publication
        // at build time. Prefer it over another network hop during an outage so
        // the stable-trend screen has a bounded first paint.
        const fallbackSources = sourcePriority.slice(1).sort((left, right) => {
            if (left === 'local') return -1;
            if (right === 'local') return 1;
            return 0;
        });
        for (const source of fallbackSources) {
            if (source === 'local' && !HF_CONFIG.fallbackToLocal) {
                continue;
            }
            try {
                console.log(`[HF Loader] Checking fallback ${source}...`);
                const snapshot = await loadSnapshotFromSource(source, [source], {
                    onProgress: options.onProgress
                });
                const actual = buildPublicationIdentity(snapshot.data, snapshot.marker);
                if (publicationIdentitiesMatch(actual, expectedIdentity)) {
                    writeCache(snapshot.data, snapshot.marker);
                    setLastLoadedSource(source);
                    console.log(
                        `[HF Loader] ✅ Fallback ${source} matched canonical publication: ` +
                        `${snapshot.data.single.length} single, ${snapshot.data.multi.length} multi`
                    );
                    return snapshot.data;
                }
                console.warn(`[HF Loader] ⚠️ Fallback ${source} identity mismatch; skipping`);
            } catch (fallbackError) {
                console.warn(`[HF Loader] ⚠️ Fallback ${source} unavailable:`, fallbackError?.message || fallbackError);
            }
        }

        console.warn('[HF Loader] ⚠️ No fallback matched the canonical publication identity');
        return { single: [], multi: [], historical: [], compare: null, staleness: 'no-verified-fallback' };
    }
}

// Resolve the canonical source's atomic publication identity when its data files
// are network-unavailable. Only an exact mirrored publication may be used as a
// fallback, so we must know what the canonical publication is before trusting one.
async function getExpectedCanonicalIdentity(sourcePriority) {
    const canonical = sourcePriority[0];
    const marker = await getLatestMarkerWithTimeout(
        [canonical],
        HF_CONFIG.canonicalIdentityTimeoutMs
    );
    if (marker) {
        return { marker: String(marker || '').trim(), targetRegistry: '' };
    }

    // The local marker is pinned together with all bundled JSON files in the
    // same website release. It is therefore a trustworthy publication identity
    // when the live canonical marker cannot be reached, unlike an arbitrary
    // browser cache or an unversioned mirror.
    try {
        const bundledMarker = await loadFromLocal(HF_CONFIG.files.lastUpdated);
        if (bundledMarker?.last_updated) {
            return {
                marker: String(bundledMarker.last_updated).trim(),
                targetRegistry: '',
            };
        }
    } catch (_e) {
        // No pinned local publication is available; fail closed below.
    }
    return null;
}

/**
 * 获取数据的最后更新时间（从 HF API）
 * @returns {Promise<string|null>}
 */
async function getLastUpdated() {
    const loaders = {
        github: loadFromGitHub,
        hf: loadFromHuggingFace,
        local: loadFromLocal,
    };

    const cachedEnvelope = readCacheEnvelope();
    if (cachedEnvelope?.marker) {
        return cachedEnvelope.marker;
    }

    const loadedSource = getLastLoadedSource();
    if (loadedSource === 'cache') {
        if (cachedEnvelope?.marker) {
            return cachedEnvelope.marker;
        }
    } else if (loadedSource && loaders[loadedSource]) {
        try {
            const marker = await loaders[loadedSource](HF_CONFIG.files.lastUpdated);
            if (marker && marker.last_updated) {
                return marker.last_updated;
            }
        } catch (_e) {
            // fall back to the configured source priority below
        }
    }

    for (const source of getSourcePriority()) {
        const loader = loaders[source];
        if (!loader) {
            continue;
        }
        if (source === 'local' && !HF_CONFIG.fallbackToLocal) {
            continue;
        }
        try {
            const marker = await loader(HF_CONFIG.files.lastUpdated);
            if (marker && marker.last_updated) {
                return marker.last_updated;
            }
        } catch (_e) {
            // ignore and try next source
        }
    }

    try {
        // Fallback: HF Datasets API repo metadata
        for (const endpoint of getUniqueEndpoints()) {
            const url = buildDatasetApiUrl(endpoint);
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const info = await response.json();
                return info.lastModified || null;
            }
        }
    } catch (_e) {
        console.warn('[HF Loader] Could not get last updated time');
    }

    return null;
}

// 导出供 leaderboard.js 使用
window.HFDataLoader = {
    loadLeaderboardData,
    startBackgroundSync,
    getLastUpdated,
    getLastLoadedSource,
    config: HF_CONFIG
};
