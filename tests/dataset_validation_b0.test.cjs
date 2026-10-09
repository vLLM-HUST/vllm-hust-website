'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_v1.b0.json'), 'utf8'));

test('Qwen2.5 publishes a complete explicit cell-state matrix', () => {
    assert.equal(DATA.contract_version, 'dataset-validation-v1');
    assert.equal(DATA.datasets.length, 44);
    assert.equal(DATA.metrics.length, 6);
    assert.equal(DATA.results.length, 44 * 6);
    assert.equal(DATA.results.filter((cell) => cell.status === 'passed').length, 6);
    assert.equal(DATA.results.filter((cell) => cell.status === 'baseline_only').length, 162);
    assert.equal(DATA.results.filter((cell) => cell.status === 'not_tested').length, 90);
    assert.equal(DATA.results.filter((cell) => cell.status === 'not_applicable').length, 6);
    assert.ok(DATA.results.filter((cell) => cell.status === 'baseline_only').every((cell) => cell.provenance.archive_sha256 === '60084956ff45dbd361c299fb4f1f0d0e4ff6538636701405c97b4d5f4848f9bd')); // pragma: allowlist secret
    assert.equal(new Set(DATA.results.map((cell) => cell.dataset_id)).size, 44);
    assert.ok(DATA.datasets.every((dataset) => Array.isArray(dataset.applicable_metric_ids)));
});

test('B1 selection is per cell and keeps unmatched datasets empty', () => {
    assert.equal(DATA.candidate_policy.id, 'best-per-cell');
    assert.equal(DATA.candidate_policy.single_version_required, false);
    assert.ok(DATA.results.filter((cell) => cell.dataset_id === 'szyn-opencode-swebench-verified-500').every((cell) => cell.status === 'not_applicable'));
    const longbench = DATA.results.find((cell) => cell.dataset_id === 'longbench-v2' && cell.metric_id === 'request_success_rate');
    assert.equal(longbench.baseline_value, 98);
});

test('B1 audit rejects near matches instead of populating incomparable cells', () => {
    assert.equal(DATA.candidate_search.audited_at, '2026-10-03');
    assert.equal(DATA.candidate_search.eligible_cells, 6);
    assert.equal(DATA.candidate_search.rejected_near_matches.length, 4);
    assert.deepEqual(
        new Set(DATA.candidate_search.rejected_near_matches.map((item) => item.dataset_id)),
        new Set(['sharegpt-v3', 'sonnet', 'instructcoder'])
    );
    assert.ok(DATA.results.filter((cell) => cell.dataset_id !== 'ai2-arc').every((cell) => cell.value === null));
});

test('only matched ARC B1 is published while unmatched GSM8K evidence is retained', () => {
    const candidateCells = DATA.results.filter((cell) => cell.value !== null);
    assert.equal(candidateCells.length, 6);
    assert.ok(candidateCells.every((cell) => cell.provenance.repository === 'vLLM-HUST/vllm-hust-vSpec'));
    assert.ok(candidateCells.every((cell) => cell.provenance.repository_commit === '4a29bf9bce72b3ea8cf7abbc54cbba204f00942f')); // pragma: allowlist secret
    assert.ok(candidateCells.every((cell) => cell.provenance.engine_commit === '762f85b311fbab0bcf8921dd216f5093cd58b9b8')); // pragma: allowlist secret
    const arcOutput = candidateCells.find((cell) => cell.dataset_id === 'ai2-arc' && cell.metric_id === 'output_token_throughput');
    assert.equal(arcOutput.value, 442.61142407483453);
    assert.equal(arcOutput.baseline_value, 274.82);
    const unmatched = DATA.candidate_search.unadmitted_candidates[0];
    assert.equal(unmatched.dataset_id, 'gsm8k');
    assert.equal(unmatched.results.length, 6);
    assert.equal(unmatched.results.find((cell) => cell.metric_id === 'output_token_throughput').value, 611.2674615325014);
    assert.ok(DATA.results.filter((cell) => cell.dataset_id === 'gsm8k').every((cell) => cell.status === 'not_tested' && cell.value === null));
});

test('Dataset Validation loads the model index rather than a fixed artifact', () => {
    const page = fs.readFileSync(path.join(ROOT, 'dataset-validation.html'), 'utf8');
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_index_v1.json'), 'utf8'));
    assert.match(page, /dataset_validation_index_v1\.json/);
    assert.match(page, /id="dataset-program-list"/);
    assert.match(page, /id="validation-model-select"/);
    assert.match(page, /Measured scenarios remain available as supplementary material/);
    assert.equal(index.program_url, './data/dataset_program_v1.json');
    assert.equal(index.scenarios.length, 7);
    assert.equal(index.default_scenario_id, 'qwen35-35b-a3b-bf16-tp2-pp1-dp1-ep-off-ctx262k-apc-on-mtp2-full-piecewise-sweprefix-900s');
    const visible = index.scenarios.filter((scenario) => scenario.selector_visible !== false);
    assert.equal(visible.length, 6);
    assert.deepEqual(visible.slice(0, 4).map((scenario) => scenario.data_url), [
        './data/dataset_validation_qwen35_frontier_unified_900s.json',
        './data/dataset_validation_qwen35_frontier_betterscale_900s.json',
        './data/dataset_validation_qwen35_frontier_pipeline_pp2_900s.json',
        './data/dataset_validation_qwen35_bidkv.json',
    ]);
    assert.ok(visible.slice(0, 4).every((scenario) => scenario.label.startsWith('Paired B0/B1')));
    assert.ok(visible[4].label.startsWith('B0 only'));
    assert.ok(visible[5].label.startsWith('Partial B0/B1'));
    assert.equal(index.scenarios[6].data_url, './data/dataset_validation_qwen35_tp2_matrix.json');
    assert.equal(index.scenarios[6].selector_visible, false);
});

test('remaining declared Frontier pairs keep their own Native and regressions', () => {
    const betterscale = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_frontier_betterscale_900s.json'), 'utf8'));
    assert.equal(betterscale.baseline.id, 'swe-capacity16-native');
    assert.equal(betterscale.scenario.baseline_graph_mode, 'FULL_AND_PIECEWISE');
    assert.equal(betterscale.scenario.candidate_graph_mode, 'FULL');
    assert.ok(betterscale.results.every((cell) => cell.selected_candidate_id === 'betterscale'));
    assert.deepEqual(new Set(betterscale.results.map((cell) => cell.comparison.trend)), new Set(['improved']));

    const pipeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_frontier_pipeline_pp2_900s.json'), 'utf8'));
    assert.equal(pipeline.baseline.id, 'swe-k8s-pp2-20260925-nativepp-r1');
    assert.equal(pipeline.scenario.pipeline_parallel_size, 2);
    assert.equal(pipeline.scenario.hardware, '4× Ascend 910B2');
    assert.ok(pipeline.results.every((cell) => cell.selected_candidate_id === 'pipeline-microbatch-migration'));
    assert.deepEqual(new Set(pipeline.results.map((cell) => cell.comparison.trend)), new Set(['improved', 'regressed']));
    assert.ok(pipeline.results.every((cell) => cell.candidate_values[0].runtime_effectiveness === 'exercised'));
});

test('Qwen3.5 unified Frontier scenario publishes all paired MOD candidates', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_frontier_unified_900s.json'), 'utf8'));
    assert.equal(data.scenario.expert_parallel, false);
    assert.equal(data.scenario.max_model_len, 262144);
    assert.equal(data.scenario.prefix_caching, true);
    assert.equal(data.scenario.measurement_seconds, 900);
    assert.equal(data.datasets.length, 5);
    assert.equal(data.metrics.length, 2);
    assert.equal(data.results.length, 10);
    assert.ok(data.results.every((cell) => cell.candidate_values.length === 6));
    assert.ok(data.results.every((cell) => cell.candidate_values.some((candidate) => candidate.candidate_id === cell.selected_candidate_id && candidate.value === cell.value)));
    const c1 = data.results.find((cell) => cell.dataset_id === 'swe-prefix-reuse-c1' && cell.metric_id === 'output_token_throughput');
    assert.equal(c1.selected_candidate_id, 'kvcompress-ascend');
    const c16 = data.results.find((cell) => cell.dataset_id === 'swe-prefix-reuse-c16' && cell.metric_id === 'output_token_throughput');
    assert.equal(c16.selected_candidate_id, 'pegaflow-vllm-connectors');
    assert.deepEqual(new Set(c16.candidate_values.map((candidate) => candidate.candidate_id)), new Set(['bidkv', 'dla', 'kv-materialization-arrival-control', 'kv-tiering-migration', 'kvcompress-ascend', 'pegaflow-vllm-connectors']));
});

test('Qwen3.5 repaired B0 metadata publishes the measured 35B workbook configuration', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_tp2_ep_ctx32k_apcoff_inf_out256.json'), 'utf8'));
    assert.equal(data.scenario.model, 'Qwen3.5-35B-A3B');
    assert.equal(data.scenario.tensor_parallel_size, 2);
    assert.equal(data.scenario.expert_parallel, true);
    assert.equal(data.scenario.max_model_len, 32768);
    assert.equal(data.scenario.prefix_caching, false);
    assert.equal(data.scenario.graph_mode, 'FULL_DECODE_ONLY');
    assert.equal(data.scenario.request_rate, 'inf');
    assert.equal(data.scenario.output_length, 256);
    assert.equal(data.datasets.length, 21);
    assert.equal(data.metrics.length, 6);
    assert.equal(data.results.length, 126);
    assert.ok(data.results.every((cell) => cell.status === 'baseline_only' && cell.baseline_value !== null));
    const cell = (datasetId, metricId) => data.results.find((item) => item.dataset_id === datasetId && item.metric_id === metricId);
    assert.equal(cell('jsonschemabench', 'request_throughput').baseline_value, 1.8);
    assert.equal(cell('jsonschemabench', 'request_success_rate').baseline_value, 99.5);
    assert.equal(cell('longbench', 'request_throughput').baseline_value, 1.21);
    assert.equal(cell('longbench-v2', 'request_success_rate').baseline_value, 99);
    assert.ok(data.results.every((item) => item.provenance.result_json_sha256));
});

test('Qwen3.5 TP2 matrix separates online and agent applicability', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_tp2_matrix.json'), 'utf8'));
    assert.equal(data.scenario.id, 'qwen35-35b-a3b-bf16-tp2-dataset-matrix-v1');
    assert.equal(data.datasets.length, 44);
    assert.equal(data.metrics.length, 7);
    assert.equal(data.results.length, 44 * 7);
    assert.equal(data.results.filter((cell) => cell.status === 'not_tested').length, 258);
    assert.equal(data.results.filter((cell) => cell.status === 'not_applicable').length, 49);
    const szyn = data.results.find((cell) => cell.dataset_id === 'szyn-opencode-swebench-verified-500' && cell.metric_id === 'agent_resolve_rate');
    assert.equal(szyn.status, 'baseline_only');
    assert.equal(szyn.baseline_value, 46.4);
    assert.equal(szyn.value, null);
    assert.equal(szyn.provenance.resolved_tasks, 232);
    assert.equal(szyn.provenance.attempted_tasks, 500);
    assert.equal(szyn.provenance.raw_publishable, false);
    assert.equal(szyn.provenance.adjudicated_publishable, true);
    assert.match(szyn.note_zh, /232\/500/);
    assert.match(szyn.tracking_url, /vllm-hust-dev-hub\/issues\/87$/);
});

test('BidKV publishes the evidenced Qwen3.5 EvoScientist cell as a separate scenario', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset_validation_qwen35_bidkv.json'), 'utf8'));
    assert.equal(data.scenario.id, 'qwen35-35b-a3b-bf16-tp4-c12-kv512m');
    assert.equal(data.datasets.length, 1);
    assert.equal(data.metrics.length, 1);
    assert.equal(data.results.length, 1);
    const cell = data.results[0];
    assert.equal(cell.dataset_id, 'evoscientist');
    assert.equal(cell.metric_id, 'output_token_throughput');
    assert.equal(cell.baseline_value, 35.66676184907216);
    assert.equal(cell.value, 40.60051695308914);
    assert.equal(cell.provenance.repository, 'vLLM-HUST/vllm-hust-bidkv');
    assert.deepEqual(cell.provenance.policy_selections, [10, 7]);
});
