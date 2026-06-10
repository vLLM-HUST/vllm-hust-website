/**
 * Hugging Face Data Loader for LLM Engine Leaderboard
 *
 * 从 Hugging Face Datasets Hub 加载 benchmark 结果
 * 支持实时更新，无需后端服务
 */

const HF_CONFIG = {
    // Hugging Face 仓库配置
    repo: 'intellistream/llm-engine-benchmark-results',
    branch: 'main',

    // 数据文件路径（在 HF repo 中的路径）
    files: {
        single: 'leaderboard_single.json',
        multi: 'leaderboard_multi.json',
        compare: 'leaderboard_compare.json',
        lastUpdated: 'last_updated.json'
    },

    // 备用：本地数据（当 HF 不可用时）
    fallbackToLocal: true,
    localPath: './data/',

    // 前端缓存，避免频繁刷新时重复全量拉取
    cacheTTLms: 5 * 60 * 1000,

    // 启用标记文件一致性校验，避免同步后继续命中旧缓存
    validateWithMarker: true,

    // 远端优先使用镜像，官方站点作为回退
    endpoints: [
        'https://hf-mirror.com',
        'https://huggingface.co'
    ],

    // 数据源优先级：github -> hf -> local
    sources: ['github', 'hf', 'local'],

    // GitHub 仓库配置（用于不依赖 HF 的数据发布方式）
    github: {
        repo: 'vLLM-HUST/vllm-hust-benchmark',
        branch: 'main',
        dataPath: 'leaderboard-data/snapshots'
    }
};

const CACHE_KEY = 'llm_engine_hf_leaderboard_cache_v3';
let lastLoadedSource = null;

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
    const hardConstraintScopes = Array.isArray(compareSnapshot?.hard_constraints?.scopes)
        ? compareSnapshot.hard_constraints.scopes
        : [];

    if (groups.length > 0 || goalPairs.length > 0) {
        return true;
    }

    return hardConstraintScopes.length === 0;
}

function assertUsableLeaderboardPayload(result, source) {
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
            const response = await fetch(url, {
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
    const url = `${HF_CONFIG.localPath}${filename}`;
    console.log(`[HF Loader] Fallback to local: ${url}`);

    const response = await fetch(url);
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

    const response = await fetch(url, {
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

/**
 * 加载 leaderboard 数据（优先 HF，失败则本地）
 * @returns {Promise<{single: Array, multi: Array, compare: Object}>}
 */
async function loadLeaderboardData() {
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
            const latestMarker = await getLatestMarker();
            if (latestMarker && cachedEnvelope.marker && cachedEnvelope.marker === latestMarker) {
                setLastLoadedSource('cache');
                console.log('[HF Loader] ✅ Loaded from session cache (marker matched)');
                return cachedEnvelope.data;
            }

            if (!latestMarker) {
                setLastLoadedSource('cache');
                console.log('[HF Loader] ⚠️ Marker unavailable, fallback to TTL cache');
                return cachedEnvelope.data;
            }

            console.log('[HF Loader] ♻️ Marker changed, refreshing leaderboard data');
        }
    }

    const result = { single: [], multi: [], compare: null };

    const loaders = {
        github: loadFromGitHub,
        hf: loadFromHuggingFace,
        local: loadFromLocal,
    };

    const sourcePriority = getSourcePriority();
    let lastError = null;

    for (const source of sourcePriority) {
        const loader = loaders[source];
        if (!loader) {
            continue;
        }
        if (source === 'local' && !HF_CONFIG.fallbackToLocal) {
            continue;
        }

        try {
            console.log(`[HF Loader] Loading from ${source}...`);
            const marker = await getLatestMarker([source, ...sourcePriority.filter((item) => item !== source)]);
            const [singleData, multiData, compareData] = await Promise.all([
                loader(HF_CONFIG.files.single),
                loader(HF_CONFIG.files.multi),
                loadOptionalJson(loader, HF_CONFIG.files.compare)
            ]);

            result.single = normalizeEntryArray(singleData);
            result.multi = normalizeEntryArray(multiData);
            result.compare = compareData && typeof compareData === 'object' ? compareData : null;

            assertUsableLeaderboardPayload(result, source);

            writeCache(result, marker);
            setLastLoadedSource(source);
            console.log(
                `[HF Loader] ✅ Loaded from ${source}: ${result.single.length} single, ${result.multi.length} multi`
            );
            return result;
        } catch (error) {
            lastError = error;
            console.warn(`[HF Loader] ⚠️ ${source} load failed:`, error?.message || error);
        }
    }

    throw new Error(lastError?.message || 'Failed to load leaderboard data from all sources');
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

    const loadedSource = getLastLoadedSource();
    if (loadedSource === 'cache') {
        const cachedEnvelope = readCacheEnvelope();
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
            const response = await fetch(url);
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
    getLastUpdated,
    getLastLoadedSource,
    config: HF_CONFIG
};
