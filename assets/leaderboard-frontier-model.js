/* Independent measured-point projection. No synthetic performance or runtime tuning. */
(function (root) {
    'use strict';
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    const positive = v => finite(v) && v > 0;
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const metrics = {
        interactivity: { direction: 'max', unit: 'output tok/s/user' },
        decode_p90_tps: { direction: 'max', unit: 'output tok/s/user' },
        ttft_p95_ms: { direction: 'min', unit: 'ms' },
        tpot_p95_ms: { direction: 'min', unit: 'ms' },
        e2e_p95_ms: { direction: 'min', unit: 'ms' },
        output_tps: { direction: 'max', unit: 'output tok/s' },
        output_tps_per_chip: { direction: 'max', unit: 'output tok/s/chip' },
        cost_per_million: { direction: 'min', unit: 'USD / 1M output tokens' }
    };
    function validate(data) {
        if (data?.schema_version !== 'leaderboard-frontier/v1' || !Array.isArray(data.cohorts) || !Array.isArray(data.points)) throw new Error('Unsupported Frontier snapshot');
        const ids = new Set(), contracts = new Set();
        for (const c of data.cohorts) {
            const key = JSON.stringify([c.model?.id, c.precision?.id, c.workload?.id, c.context_tokens]);
            if (!c.id || ids.has(c.id) || contracts.has(key) || !c.model?.id || !c.model?.revision || !c.model?.label
                || !c.precision?.id || !c.precision?.label || !c.workload?.id || !c.workload?.label
                || !object(c.workload?.contract) || !Number.isInteger(c.context_tokens) || c.context_tokens < 1) throw new Error('Invalid or duplicate Frontier cohort');
            ids.add(c.id); contracts.add(key);
        }
        const pointIds = new Set();
        for (const p of data.points) {
            const c = p.configuration, e = p.evidence;
            if (!p.id || pointIds.has(p.id) || !ids.has(p.cohort_id) || !c?.engine || !c.engine_version
                || !Array.isArray(c.mods) || c.mods.some(id => typeof id !== 'string' || !id)
                || new Set(c.mods).size !== c.mods.length || !c.hardware?.label
                || !Number.isInteger(c.hardware.accelerator_count) || c.hardware.accelerator_count < 1
                || !object(c.parameters) || !object(p.load) || !object(p.metrics)
                || !Number.isInteger(c.context_capacity_tokens)
                || c.context_capacity_tokens < data.cohorts.find(cohort => cohort.id === p.cohort_id).context_tokens || e?.status !== 'measured'
                || !Array.isArray(e.run_ids) || !e.run_ids.length || !e.aggregation
                || !safeURL(e.url)) throw new Error(`Invalid measured configuration: ${p.id || '?'}`);
            if (c.experiment_group != null && (typeof c.experiment_group !== 'string' || !c.experiment_group.trim())) throw new Error(`Invalid experiment group: ${p.id}`);
            if (Object.values(p.metrics).some(v => v !== null && (!finite(v) || v < 0))) throw new Error(`Invalid metric: ${p.id}`);
            if (p.load.concurrency_series != null && (typeof p.load.concurrency_series !== 'string' || !p.load.concurrency_series
                || !Number.isInteger(p.load.concurrency) || p.load.concurrency < 1)) throw new Error(`Invalid concurrency series: ${p.id}`);
            if (p.cost != null && (!positive(p.cost.usd_per_hour) || !p.cost.source || !p.cost.scope)) throw new Error(`Invalid deployment cost: ${p.id}`);
            pointIds.add(p.id);
        }
        return data;
    }
    function safeURL(value) {
        try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch (_) { return null; }
    }
    function value(point, key) {
        const m = point.metrics;
        if (key === 'interactivity') return positive(m.tpot_ms) ? 1000 / m.tpot_ms : null;
        if (key === 'output_tps_per_chip') return positive(m.output_tps) ? m.output_tps / point.configuration.hardware.accelerator_count : null;
        if (key === 'cost_per_million') return positive(m.output_tps) && positive(point.cost?.usd_per_hour)
            ? point.cost.usd_per_hour * 1e6 / (3600 * m.output_tps) : null;
        return finite(m[key]) ? m[key] : null;
    }
    function modKey(point) { return [...point.configuration.mods].sort().join('+') || 'none'; }
    function groupKey(point) { return point.configuration.experiment_group || modKey(point); }
    function failedCorrectness(point) { return point.configuration.parameters.functional_status === 'failed'; }
    function project(points, xKey, yKey) {
        if (!metrics[xKey] || !metrics[yKey]) throw new Error('Unknown Frontier axis');
        const measured = points.map(point => ({ point, x: value(point, xKey), y: value(point, yKey) }))
            .filter(p => p.x !== null && p.y !== null);
        const signX = metrics[xKey].direction === 'max' ? 1 : -1;
        const signY = metrics[yKey].direction === 'max' ? 1 : -1;
        // Strict Pareto dominance. Equal observations are retained, not arbitrarily best-picked.
        for (const a of measured) a.frontier = !failedCorrectness(a.point) && !measured.some(b =>
            !failedCorrectness(b.point) &&
            signX * b.x >= signX * a.x && signY * b.y >= signY * a.y
            && (signX * b.x > signX * a.x || signY * b.y > signY * a.y));
        return { measured, excluded: points.length - measured.length,
            frontier: measured.filter(p => p.frontier).sort((a, b) => a.x - b.x || a.point.id.localeCompare(b.point.id)) };
    }
    function mtpState(point) {
        const tokens = point.configuration.parameters.mtp_draft_tokens;
        return Number.isFinite(tokens) && tokens >= 0 ? (tokens > 0 ? 'on' : 'off') : 'unknown';
    }
    function concurrencySeries(rows) {
        const groups = new Map();
        for (const row of rows) {
            const p = row.point, series = p.load.concurrency_series;
            if (!series) continue;
            const key = JSON.stringify([p.cohort_id, series]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        }
        return [...groups.values()].filter(rows => rows.length > 1)
            .map(rows => [...rows].sort((a, b) => a.point.load.concurrency - b.point.load.concurrency));
    }
    const api = { validate, metrics, value, modKey, groupKey, project, safeURL, mtpState, concurrencySeries, failedCorrectness };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.LeaderboardFrontierModel = api;
})(globalThis);
