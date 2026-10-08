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
        batch_size: { direction: 'max', unit: 'prompts / batch' },
        output_tps_per_chip: { direction: 'max', unit: 'output tok/s/chip' },
        cost_per_million: { direction: 'min', unit: 'USD / 1M output tokens' }
    };
    function validate(data) {
        if (data?.schema_version !== 'leaderboard-frontier/v1' || !Array.isArray(data.cohorts) || !Array.isArray(data.points)) throw new Error('Unsupported Frontier snapshot');
        const baseline = data.official_baseline;
        if (!object(baseline) || typeof baseline.id !== 'string' || !baseline.id
            || baseline.engine !== 'vLLM + vLLM-Ascend'
            || !/^\d+\.\d+\.\d+$/.test(baseline.vllm_version)
            || !/^\d+\.\d+\.\d+$/.test(baseline.vllm_ascend_version)
            || typeof baseline.comparison_policy !== 'string' || !baseline.comparison_policy) throw new Error('Invalid official baseline');
        const ids = new Set(), aliases = new Set(), contracts = new Set();
        for (const c of data.cohorts) {
            const key = JSON.stringify([c.model?.id, c.precision?.id, c.workload?.id, c.context_tokens]);
            if (!c.id || ids.has(c.id) || aliases.has(c.id) || contracts.has(key) || !c.model?.id || !c.model?.revision || !c.model?.label
                || !c.precision?.id || !c.precision?.label || !c.workload?.id || !c.workload?.label
                || !object(c.workload?.contract) || !Number.isInteger(c.context_tokens) || c.context_tokens < 1) throw new Error('Invalid or duplicate Frontier cohort');
            ids.add(c.id); contracts.add(key);
            if (c.aliases != null && (!Array.isArray(c.aliases) || new Set(c.aliases).size !== c.aliases.length
                || c.aliases.some(alias => typeof alias !== 'string' || !alias || ids.has(alias) || aliases.has(alias)))) throw new Error('Invalid Frontier cohort aliases');
            for (const alias of c.aliases || []) aliases.add(alias);
            const axes = c.workload.contract.frontier_axes;
            if (axes != null && (!object(axes) || !metrics[axes.x] || !metrics[axes.y])) throw new Error('Invalid Frontier axes');
            const presentation = c.workload.contract.presentation;
            if (presentation != null && !['concurrency-series', 'fixed-comparison', 'configuration-study'].includes(presentation)) throw new Error('Invalid Frontier presentation');
            const displayPrefix = c.workload.contract.display_series_prefix;
            if (displayPrefix != null && (typeof displayPrefix !== 'string' || !displayPrefix)) throw new Error('Invalid display series prefix');
            const displaySeries = c.workload.contract.display_series_ids;
            if (displaySeries != null && (!Array.isArray(displaySeries) || !displaySeries.length
                || new Set(displaySeries).size !== displaySeries.length || displaySeries.some(series => typeof series !== 'string' || !series)
                || displayPrefix != null)) throw new Error('Invalid display series IDs');
            const displayLabels = c.workload.contract.display_group_labels;
            if (displayLabels != null && (!object(displayLabels) || Object.entries(displayLabels).some(([group, labels]) =>
                !group || !object(labels) || typeof labels.label_en !== 'string' || !labels.label_en
                || typeof labels.label_zh !== 'string' || !labels.label_zh))) throw new Error('Invalid display group labels');
            const defaultGroups = c.workload.contract.default_groups;
            if (defaultGroups != null && (!Array.isArray(defaultGroups) || !defaultGroups.length
                || new Set(defaultGroups).size !== defaultGroups.length || defaultGroups.some(group => typeof group !== 'string' || !group))) throw new Error('Invalid default groups');
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
            if (c.mod_sources != null && (!Array.isArray(c.mod_sources) || new Set(c.mod_sources.map(s=>s?.id)).size !== c.mod_sources.length
                || c.mod_sources.some(s=>!s || !c.mods.includes(s.id) || !/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/.test(s.repository)
                    || !/^[0-9a-f]{40}$/.test(s.revision) || (s.additional_revisions != null && (!Array.isArray(s.additional_revisions) || s.additional_revisions.some(r=>!/^[0-9a-f]{40}$/.test(r))))))) throw new Error(`Invalid MOD source: ${p.id}`);
            if (e.sampling_date_utc != null && (typeof e.sampling_date_utc !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.sampling_date_utc)
                || !Number.isFinite(Date.parse(e.sampling_date_utc)) || new Date(e.sampling_date_utc).toISOString().slice(0,10) !== e.sampling_date_utc)) throw new Error(`Invalid sampling date: ${p.id}`);
            if (c.experiment_group != null && (typeof c.experiment_group !== 'string' || !c.experiment_group.trim())) throw new Error(`Invalid experiment group: ${p.id}`);
            if (p.study_group != null && (!object(p.study_group) || typeof p.study_group.id !== 'string' || !p.study_group.id
                || typeof p.study_group.label_en !== 'string' || !p.study_group.label_en
                || typeof p.study_group.label_zh !== 'string' || !p.study_group.label_zh)) throw new Error(`Invalid study group: ${p.id}`);
            if (data.cohorts.find(cohort => cohort.id === p.cohort_id).workload.contract.presentation === 'configuration-study'
                && p.study_group == null) throw new Error(`Missing study group: ${p.id}`);
            if (Object.values(p.metrics).some(v => v !== null && (!finite(v) || v < 0))) throw new Error(`Invalid metric: ${p.id}`);
            const rotationRequired = data.cohorts.find(cohort => cohort.id === p.cohort_id).workload.contract.session_rotation;
            if ((rotationRequired || p.load.session_rotation_depth != null)
                && (!Number.isInteger(p.load.session_rotation_depth) || p.load.session_rotation_depth < 1)) throw new Error(`Invalid session rotation depth: ${p.id}`);
            if (p.load.presentation_group != null && (!object(p.load.presentation_group) || typeof p.load.presentation_group.id !== 'string' || !p.load.presentation_group.id
                || typeof p.load.presentation_group.label_en !== 'string' || !p.load.presentation_group.label_en
                || typeof p.load.presentation_group.label_zh !== 'string' || !p.load.presentation_group.label_zh)) throw new Error(`Invalid presentation group: ${p.id}`);
            if (p.load.concurrency_series != null && (typeof p.load.concurrency_series !== 'string' || !p.load.concurrency_series
                || !Number.isInteger(p.load.concurrency) || p.load.concurrency < 1)) throw new Error(`Invalid concurrency series: ${p.id}`);
            if (p.cost != null && (!positive(p.cost.usd_per_hour) || !p.cost.source || !p.cost.scope)) throw new Error(`Invalid deployment cost: ${p.id}`);
            pointIds.add(p.id);
        }
        for (const c of data.cohorts) for (const series of c.workload.contract.display_series_ids || []) {
            if (!data.points.some(point => point.cohort_id === c.id && point.load.concurrency_series === series)) throw new Error(`Missing display series: ${series}`);
        }
        for (const c of data.cohorts) {
            const shared = c.workload.contract.comparison_point_ids;
            const compatible = id => {
                const point = data.points.find(p => p.id === id);
                const source = data.cohorts.find(source => source.id === point?.cohort_id);
                return source && !source.display_withdrawal && source.model.id === c.model.id
                    && source.precision.id === c.precision.id && source.context_tokens === c.context_tokens;
            };
            if (shared != null && (c.workload.contract.presentation !== 'configuration-study'
                || !Array.isArray(shared) || !shared.length || new Set(shared).size !== shared.length
                || shared.some(id => !pointIds.has(id) || !compatible(id)))) throw new Error('Invalid comparison point IDs');
        }
        return data;
    }
    function visibleData(data) {
        const cohorts = data.cohorts.filter(cohort => !cohort.display_withdrawal);
        const ids = new Set(cohorts.map(cohort => cohort.id));
        return {...data, cohorts, points: data.points.filter(point => ids.has(point.cohort_id))};
    }
    function resolveCohort(cohorts, requested) {
        return cohorts.find(cohort => cohort.id === requested || cohort.aliases?.includes(requested));
    }
    function presentationPoints(points, cohort) {
        // Reuse immutable measurements in a study without moving or duplicating source records.
        const shared = new Set(cohort?.workload?.contract?.comparison_point_ids || []);
        const members = points.filter(point => shared.size && cohort?.workload?.contract?.presentation === 'configuration-study'
            ? shared.has(point.id) : point.cohort_id === cohort?.id || shared.has(point.id));
        const series = cohort?.workload?.contract?.display_series_ids;
        if (series) return members.filter(point => series.includes(point.load.concurrency_series));
        const prefix = cohort?.workload?.contract?.display_series_prefix;
        return prefix ? members.filter(point => point.load.concurrency_series?.startsWith(prefix)) : members;
    }
    function safeURL(value) {
        try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch (_) { return null; }
    }
    function value(point, key) {
        const m = point.metrics;
        if (key === 'batch_size') return positive(point.load.batch_size) ? point.load.batch_size : null;
        if (key === 'interactivity') return positive(m.tpot_ms) ? 1000 / m.tpot_ms : null;
        if (key === 'output_tps_per_chip') return positive(m.output_tps) ? m.output_tps / point.configuration.hardware.accelerator_count : null;
        if (key === 'cost_per_million') return positive(m.output_tps) && positive(point.cost?.usd_per_hour)
            ? point.cost.usd_per_hour * 1e6 / (3600 * m.output_tps) : null;
        return finite(m[key]) ? m[key] : null;
    }
    function modKey(point) { return [...point.configuration.mods].sort().join('+') || 'none'; }
    function groupKey(point) { return point.study_group?.id || point.load.presentation_group?.id || point.configuration.experiment_group || modKey(point); }
    function frontierKey(point) { return JSON.stringify([point.cohort_id, groupKey(point), point.load.session_rotation_depth ?? null]); }
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
    // Each cohort × measured configuration group × rotation depth owns an independent frontier.
    // Coordinates always come from one whole observed run, never mixed metrics.
    function groupFrontiers(points, xKey, yKey) {
        const groups = new Map();
        for (const point of points) {
            const key = frontierKey(point);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(point);
        }
        return [...groups.values()].map(members => {
            const seen = new Set();
            return project(members, xKey, yKey).frontier.filter(row => {
                const key = JSON.stringify([row.x, row.y]);
                if (seen.has(key)) return false;
                seen.add(key); return true;
            });
        }).filter(rows => rows.length);
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
            const key = JSON.stringify([
                p.cohort_id, series, p.load.session_rotation_depth ?? null
            ]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        }
        return [...groups.values()].filter(rows => rows.length > 1)
            .map(rows => [...rows].sort((a, b) => a.point.load.concurrency - b.point.load.concurrency));
    }
    // BetterScale is a workload-tuned configuration family; connect its Pareto vertices.
    // Other groups retain their declared, fixed-configuration concurrency sweeps.
    function chartSeries(rows, xKey, yKey, cohort) {
        const shared = cohort?.workload?.contract?.comparison_point_ids;
        if (cohort?.workload?.contract?.presentation === 'configuration-study') {
            const comparison = rows.filter(row => shared?.includes(row.point.id));
            // One best-trade-off envelope per MOD and depth, not a fixed-capacity sweep.
            return groupFrontiers(comparison.map(row => row.point), xKey, yKey)
                .filter(line => line.length > 1);
        }
        const betterScale = rows.filter(row => groupKey(row.point) === 'betterscale');
        return [...concurrencySeries(rows.filter(row => groupKey(row.point) !== 'betterscale')),
            ...groupFrontiers(betterScale.map(row => row.point), xKey, yKey).filter(line => line.length > 1)];
    }
    const api = { validate, visibleData, resolveCohort, presentationPoints, metrics, value, modKey, groupKey, frontierKey, project, safeURL, mtpState, concurrencySeries, chartSeries, groupFrontiers, failedCorrectness };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.LeaderboardFrontierModel = api;
})(globalThis);
