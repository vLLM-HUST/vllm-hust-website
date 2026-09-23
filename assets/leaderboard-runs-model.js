/* Pure snapshot -> task definitions / independent run rows. No network or DOM. */
(function (root) {
    'use strict';
    const clean = value => value !== null && value !== undefined && value !== '';
    const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const stable = value => JSON.stringify(value, function (_key, item) {
        return item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
    });
    const hash = text => {
        let value = 0xcbf29ce484222325n;
        for (const char of text) value = BigInt.asUintN(64, (value ^ BigInt(char.codePointAt(0))) * 0x100000001b3n);
        return value.toString(16).padStart(16, '0');
    };
    // Client exports sometimes include the full offline EngineArgs. These belong
    // to run configuration, not task identity. Keep unknown client knobs in the tag.
    const runKeys = new Set([
        'host', 'port', 'model', 'tokenizer', 'served_model_name', 'result_dir', 'result_filename',
        'output_json', 'save_result', 'save_detailed', 'percentile_metrics', 'metric_percentiles',
        'tensor_parallel_size', 'pipeline_parallel_size', 'data_parallel_size', 'enable_expert_parallel',
        'worker_cls', 'scheduler_cls', 'distributed_executor_backend', 'dtype', 'max_model_len', 'max_num_seqs',
        'max_num_batched_tokens', 'kv_cache_memory_bytes', 'gpu_memory_utilization', 'enable_prefix_caching',
        'no_enable_prefix_caching', 'mamba_cache_mode', 'async_scheduling', 'shutdown_timeout',
        'additional_config', 'limit_mm_per_prompt', 'compilation_config', 'speculative_config', 'enforce_eager',
        'enable_prompt_tokens_details', 'trust_remote_code', 'disable_log_stats', 'disable_log_requests',
        'TASK_QUEUE_ENABLE', 'HCCL_OP_EXPANSION_MODE'
    ]);
    const taskNames = {
        'sharegpt-online': 'ShareGPT', 'instructcoder-online': 'InstructCoder',
        'agent-research-online': 'Agent Research', 'prefix-repetition-online': 'Prefix Repetition',
        'random-online': 'Random', 'random-latency': 'Random · offline latency',
        'sharegpt-throughput': 'ShareGPT · offline throughput', 'sonnet-throughput': 'Sonnet · offline throughput'
    };
    function taskDefinition(entry) {
        const w = entry.workload || {}, spec = entry.same_spec || {};
        const parameters = Object.fromEntries(Object.entries(spec.resolved_client_parameters || {})
            .filter(([key]) => !runKeys.has(key)));
        // Host-specific cache roots are not dataset identities. Preserve the file
        // or HF name and all sampling knobs; show the original path in run details.
        if (parameters.dataset_path) parameters.dataset_path = String(parameters.dataset_path).split('/').pop();
        const name = String(w.name || spec.scenario || 'unknown').replace(/-\d+chip$/, '');
        const definition = { name, dataset: w.dataset ?? parameters.dataset_name ?? null,
            input_length: w.input_length ?? null, output_length: w.output_length ?? null,
            concurrency: parameters.max_concurrency ?? w.concurrent_requests ?? null,
            batch_size: parameters.batch_size ?? w.batch_size ?? null, parameters };
        // Incomplete legacy evidence is not proof of the same workload. Keep
        // unknown definitions scoped to their declared spec (or record identity).
        if (!Object.keys(parameters).length) definition.unknown_contract = spec.spec_id || entry.entry_id;
        return definition;
    }
    function parallel(entry) {
        const p = entry.same_spec?.resolved_server_parameters || {};
        const parts = [['TP', p.tensor_parallel_size], ['PP', p.pipeline_parallel_size], ['DP', p.data_parallel_size]]
            .filter(([, value]) => clean(value)).map(([key, value]) => `${key}${value}`);
        if (p.enable_expert_parallel === true || p.enable_expert_parallel === '') parts.push('EP');
        return { label: parts.join(' · ') || '—', chips: entry.hardware?.chip_count ?? null,
            nodes: entry.same_spec?.node_count ?? entry.cluster?.node_count ?? 1 };
    }
    function safeURL(value) {
        try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
        catch (_) { return null; }
    }
    function graphPrefix(entry) {
        const p = entry.same_spec?.resolved_server_parameters || {};
        let c = p.compilation_config;
        if (typeof c === 'string') { try { c = JSON.parse(c); } catch (_) { c = null; } }
        const eager = p.enforce_eager === true || p.enforce_eager === '';
        const graph = eager ? 'eager' : c?.cudagraph_mode || (p.enforce_eager === false ? 'graph' : 'graph ?');
        let s = p.speculative_config;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = null; } }
        const mtp = s?.num_speculative_tokens ? `MTP${s.num_speculative_tokens}`
            : /No MTP/i.test(entry.metadata?.notes || '') ? 'MTP off' : 'MTP ?';
        const apc = p.no_enable_prefix_caching === true || p.enable_prefix_caching === false ? 'APC off'
            : p.enable_prefix_caching === true || p.enable_prefix_caching === '' ? 'APC on' : 'APC ?';
        return `${graph} · ${mtp} · ${apc}`;
    }
    function identity(entry, attribution, components) {
        const meta = entry.metadata || {}, runtime = meta.runtime_provenance || {};
        const host = runtime.engine || {};
        // BetterScale was published in the engine slot; preserve that original
        // field in evidence, but display the independently recorded host here.
        const engine = entry.engine === 'betterscale'
            ? (host.repository === 'vllm-project/vllm' ? 'vllm'
                : host.repository === 'vLLM-HUST/vllm-hust' ? 'vllm-hust' : 'unknown')
            : entry.engine || 'unknown';
        const component = components.get(attribution?.component_id);
        const known = attribution && (!attribution.component_id || component);
        return { engine, engineVersion: entry.engine === 'betterscale' ? host.ref || '' : entry.engine_version || '',
            backend: runtime.plugin?.engine || '',
            mod: known ? component?.id || 'none' : 'unknown',
            modName: known ? component?.name || '' : '',
            modStatus: known ? attribution.status : 'unknown',
            modVersion: known && component?.id === 'betterscale' ? entry.engine_version || '' : '',
            modMaintainers: known ? component?.maintainers || [] : [],
            modRepository: known ? safeURL(component?.canonical_repository) : null,
            modReason: known ? attribution.reason : 'No reviewed per-run MOD identity or activation evidence.',
            modEvidence: known ? (attribution.evidence_urls || []).map(safeURL).filter(Boolean) : [] };
    }
    function build(payload, supplement = {}, catalog = {}, attributions = {}) {
        const components = new Map((catalog.components || []).map(c => [c.id, c]));
        const identities = new Map();
        for (const group of attributions.groups || []) {
            if (!['enabled', 'baseline', 'related'].includes(group.status)) throw new Error('Invalid MOD evidence status');
            for (const id of group.entry_ids || []) {
                if (identities.has(id)) throw new Error('Duplicate MOD attribution');
                identities.set(id, group);
            }
        }
        const entries = new Map();
        // Current publications take precedence over the same historical entry ID.
        for (const [source, list] of [['current', [...(payload.single || []), ...(payload.multi || [])]], ['historical', payload.historical || []]]) {
            for (const entry of list) {
                if (!entry.entry_id || entries.has(entry.entry_id)) continue;
                if (source === 'historical' && entry.historical_recovery?.admitted_for_historical_trend !== true) continue;
                entries.set(entry.entry_id, { entry, source });
            }
        }
        const tasks = new Map(), rows = [], ids = new Set();
        for (const { entry, source } of entries.values()) {
            const candidates = supplement.observations?.[entry.entry_id];
            const runs = Array.isArray(candidates) && candidates.length ? candidates : [entry];
            for (const run of runs) {
                // Same run appearing in several published aggregates is shown once.
                const id = run.entry_id || entry.entry_id;
                if (ids.has(id)) continue;
                ids.add(id);
                const task = taskDefinition(run), key = stable(task), taskId = `task-${hash(key)}`;
                if (tasks.has(taskId) && stable(tasks.get(taskId).definition) !== key) throw new Error('Task identity collision');
                const concurrency = task.concurrency !== null ? `C${task.concurrency}` : task.batch_size !== null ? `B${task.batch_size}` : '?';
                const taskLabel = `${taskNames[task.name] || task.name} · ${concurrency}`;
                tasks.set(taskId, { id: taskId, label: taskLabel, definition: task });
                const m = run.model || {}, h = run.hardware || {}, meta = run.metadata || {};
                const par = parallel(run);
                const hardware = [h.vendor, h.chip_model, h.memory_per_chip_gb && `${h.memory_per_chip_gb} GB`].filter(Boolean).join(' · ');
                const model = m.display_name || m.short_name || m.name || '—';
                const modelKey = stable([m.canonical_id || m.repo_id || m.name, m.precision, m.quantization, par, hardware]);
                const metric = run.metrics || {};
                const aggregate = runs.length === 1 && entry.canonical_aggregate?.count > 1 ? entry.canonical_aggregate : null;
                rows.push({ id, taskId, taskLabel, model, modelKey, parallel: par, precision: m.precision || '—',
                    hardware, ...identity(run, identities.get(entry.entry_id), components), source,
                    aggregate, repeat: run.repeat_index ?? null, prefix: graphPrefix(run),
                    date: meta.submitted_at || '', version: run.engine_version || '',
                    metrics: { ttft: number(metric.ttft_ms), tpot: number(metric.tpot_ms ?? metric.tbt_ms),
                        // Never invent a pooled percentile from aggregate-of-run percentiles.
                        ttftP95: aggregate ? null : number(metric.ttft_p95_ms ?? metric.p95_ttft_ms),
                        tpotP95: aggregate ? null : number(metric.tpot_p95_ms ?? metric.p95_tpot_ms),
                        throughput: number(metric.throughput_tps), batchLatency: number(metric.batch_latency_ms) },
                    evidence: safeURL(meta.raw_evidence_url || meta.github_commit_url || meta.github_pr_url),
                    manifest: safeURL(meta.evidence_manifest_url),
                    entry: run, parentId: entry.entry_id });
            }
        }
        const labels = new Map();
        for (const task of tasks.values()) labels.set(task.label, (labels.get(task.label) || 0) + 1);
        for (const task of tasks.values()) if (labels.get(task.label) > 1) task.label += ` · ${task.id.slice(-6)}`;
        for (const row of rows) row.taskLabel = tasks.get(row.taskId).label;
        const newest = new Map();
        for (const row of rows) newest.set(row.modelKey, [newest.get(row.modelKey) || '', row.date].sort().at(-1));
        rows.sort((a, b) => newest.get(b.modelKey).localeCompare(newest.get(a.modelKey)) || a.modelKey.localeCompare(b.modelKey)
            || a.taskLabel.localeCompare(b.taskLabel) || Number(b.modStatus === 'baseline') - Number(a.modStatus === 'baseline') || a.mod.localeCompare(b.mod) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
        return { rows, tasks: [...tasks.values()].sort((a, b) => a.label.localeCompare(b.label)) };
    }
    // Column filters use exact underlying values, never rounded display strings.
    function columnValue(row, key) {
        if (key in row.metrics) return row.metrics[key];
        return ({ model: row.modelKey, hardware: row.hardware, task: row.taskId, engine: row.engine, mod: stable([row.mod, row.modStatus]),
            run: row.id, config: row.prefix })[key] ?? null;
    }
    function selectRows(rows, filters = {}, sort = null) {
        const result = rows.filter(row => Object.entries(filters).every(([key, values]) =>
            values.includes(columnValue(row, key))));
        if (sort) result.sort((a, b) => {
            const sortValue = row => sort.key === 'model' ? `${row.model} ${row.parallel.label} ${row.precision}`
                : sort.key === 'task' ? row.taskLabel : sort.key === 'run' ? `${row.date} ${row.id}` : sort.key === 'mod' ? `${row.modName || row.mod} ${row.modStatus}` : columnValue(row, sort.key);
            const av = sortValue(a), bv = sortValue(b);
            // Missing observations always follow measured values in either direction.
            if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
            const compare = typeof av === 'number' && typeof bv === 'number' ? av - bv
                : String(av).localeCompare(String(bv), undefined, { numeric: true });
            return compare * (sort.direction === 'desc' ? -1 : 1);
        });
        return result;
    }
    const api = { identity, build, taskDefinition, parallel, stable, graphPrefix, safeURL, columnValue, selectRows };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.LeaderboardRunsModel = api;
})(globalThis);
