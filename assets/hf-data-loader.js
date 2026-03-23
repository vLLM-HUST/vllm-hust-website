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
    validateWithMarker: true
};

const CACHE_KEY = 'llm_engine_hf_leaderboard_cache_v1';

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

async function getLatestMarker() {
    try {
        const marker = await loadFromHuggingFace(HF_CONFIG.files.lastUpdated);
        if (marker && marker.last_updated) {
            return marker.last_updated;
        }
    } catch (_e) {
        // ignore and fallback
    }

    try {
        const marker = await loadFromLocal(HF_CONFIG.files.lastUpdated);
        if (marker && marker.last_updated) {
            return marker.last_updated;
        }
    } catch (_e) {
        // ignore and fallback
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
    // Hugging Face raw file URL 格式
    // https://huggingface.co/datasets/{repo}/resolve/{branch}/{path}
    const url = `https://huggingface.co/datasets/${HF_CONFIG.repo}/resolve/${HF_CONFIG.branch}/${filename}`;

    console.log(`[HF Loader] Fetching: ${url}`);

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
        if (!HF_CONFIG.validateWithMarker) {
            console.log('[HF Loader] ✅ Loaded from session cache');
            return cachedEnvelope.data;
        }

        const latestMarker = await getLatestMarker();
        if (latestMarker && cachedEnvelope.marker && cachedEnvelope.marker === latestMarker) {
            console.log('[HF Loader] ✅ Loaded from session cache (marker matched)');
            return cachedEnvelope.data;
        }

        if (!latestMarker) {
            console.log('[HF Loader] ⚠️ Marker unavailable, fallback to TTL cache');
            return cachedEnvelope.data;
        }

        console.log('[HF Loader] ♻️ Marker changed, refreshing leaderboard data');
    }

    const result = { single: [], multi: [], compare: null };

    // 尝试从 Hugging Face 加载
    try {
        console.log('[HF Loader] Loading from Hugging Face...');

        const marker = await getLatestMarker();

        const [singleData, multiData, compareData] = await Promise.all([
            loadFromHuggingFace(HF_CONFIG.files.single),
            loadFromHuggingFace(HF_CONFIG.files.multi),
            loadOptionalJson(loadFromHuggingFace, HF_CONFIG.files.compare)
        ]);

        result.single = normalizeEntryArray(singleData);
        result.multi = normalizeEntryArray(multiData);
        result.compare = compareData && typeof compareData === 'object' ? compareData : null;

        writeCache(result, marker);
        console.log(`[HF Loader] ✅ Loaded from HF: ${result.single.length} single, ${result.multi.length} multi`);
        return result;

    } catch (hfError) {
        console.warn('[HF Loader] ⚠️ HF load failed:', hfError.message);

        // 如果配置允许，尝试本地备用
        if (HF_CONFIG.fallbackToLocal) {
            try {
                console.log('[HF Loader] Trying local fallback...');

                const [singleData, multiData, compareData] = await Promise.all([
                    loadFromLocal(HF_CONFIG.files.single),
                    loadFromLocal(HF_CONFIG.files.multi),
                    loadOptionalJson(loadFromLocal, HF_CONFIG.files.compare)
                ]);

                result.single = normalizeEntryArray(singleData);
                result.multi = normalizeEntryArray(multiData);
                result.compare = compareData && typeof compareData === 'object' ? compareData : null;

                writeCache(result, null);
                console.log(`[HF Loader] ✅ Loaded from local: ${result.single.length} single, ${result.multi.length} multi`);
                return result;

            } catch (localError) {
                console.error('[HF Loader] ❌ Local fallback also failed:', localError.message);
                throw new Error('Failed to load data from both HF and local');
            }
        }

        throw hfError;
    }
}

/**
 * 获取数据的最后更新时间（从 HF API）
 * @returns {Promise<string|null>}
 */
async function getLastUpdated() {
    try {
        // Prefer explicit marker file synced by website workflow
        const marker = await loadFromHuggingFace(HF_CONFIG.files.lastUpdated);
        if (marker && marker.last_updated) {
            return marker.last_updated;
        }
    } catch (_e) {
        // ignore and fallback
    }

    try {
        const marker = await loadFromLocal(HF_CONFIG.files.lastUpdated);
        if (marker && marker.last_updated) {
            return marker.last_updated;
        }
    } catch (_e) {
        // ignore and fallback
    }

    try {
        // Fallback: HF Datasets API repo metadata
        const url = `https://huggingface.co/api/datasets/${HF_CONFIG.repo}`;
        const response = await fetch(url);

        if (response.ok) {
            const info = await response.json();
            return info.lastModified || null;
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
    config: HF_CONFIG
};
