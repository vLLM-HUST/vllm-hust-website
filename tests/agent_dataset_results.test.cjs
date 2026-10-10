'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'agent-dataset-results.js');
const DATA_PATH = path.join(__dirname, '..', 'data', 'agent_dataset_results.json');
const FRONTIER_PAGE_PATH = path.join(__dirname, '..', 'leaderboard-runs.html');
const DATASET_PAGE_PATH = path.join(__dirname, '..', 'dataset-validation.html');
const SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');

function loadTestApi() {
    const sandbox = {
        window: { addEventListener() {} },
        document: { addEventListener() {}, getElementById() { return {}; } },
        console,
    };
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'agent-dataset-results.js' });
    return sandbox.window.__agentDatasetResultsTest;
}

test('the public SZYN result contains only the complete campaign', () => {
    const api = loadTestApi();
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const normalized = api.normalize(data);
    assert.strictEqual(normalized.campaigns.length, 1);
    const campaign = normalized.campaigns[0];

    assert.strictEqual(campaign.dataset, 'SZYN-OPENCODE-SWEBENCH-VERIFIED-500');
    assert.strictEqual(campaign.owner_zh, '中国移动苏州（苏州云能）');
    assert.strictEqual(campaign.executed_tasks, 500);
    assert.strictEqual(campaign.total_tasks, 500);
    assert.strictEqual(campaign.resolved_tasks, 232);
    assert.strictEqual(campaign.resolution_rate, 0.464);
    assert.match(campaign.caveat_en, /Complete 500-task B0 campaign/);
    const publicText = `${SOURCE}\n${fs.readFileSync(DATA_PATH, 'utf8')}`;
    for (const staleMarker of ['1 / 500', '1/500', 'remaining 499', '其余 499', 'single-case qualification']) {
        assert.ok(!publicText.includes(staleMarker), staleMarker);
    }
});

test('results contract rejects resolved counts above executed counts', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalize({
        contract_version: 'agent-dataset-results-v1',
        campaigns: [{ id: 'bad', executed_tasks: 1, total_tasks: 1, resolved_tasks: 2, resolution_rate: 2 }],
    }), /Invalid resolved task count/);
});

test('campaign rows must cover the declared denominator', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalize({
        contract_version: 'agent-dataset-results-v1',
        campaigns: [{ id: 'partial', executed_tasks: 499, total_tasks: 500, resolved_tasks: 232, resolution_rate: 232 / 499 }],
    }), /Incomplete campaign result/);
});

test('tool and agent results belong to the benchmark settings view only', () => {
    const frontierPage = fs.readFileSync(FRONTIER_PAGE_PATH, 'utf8');
    const datasetPage = fs.readFileSync(DATASET_PAGE_PATH, 'utf8');

    assert.match(frontierPage, /id="frontier-agent-qualifications"/);
    assert.match(frontierPage, /agent-dataset-results\.js/);
    assert.doesNotMatch(datasetPage, /id="frontier-agent-qualifications"/);
    assert.doesNotMatch(datasetPage, /agent-dataset-results\.js/);
});
