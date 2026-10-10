'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'agent-dataset-qualifications.js');
const DATA_PATH = path.join(__dirname, '..', 'data', 'agent_dataset_qualifications.json');
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
    vm.runInContext(SOURCE, sandbox, { filename: 'agent-dataset-qualifications.js' });
    return sandbox.window.__agentDatasetQualificationsTest;
}

test('complete SZYN campaign is primary and the one-case qualification is retained separately', () => {
    const api = loadTestApi();
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const normalized = api.normalize(data);
    const campaign = normalized.results[0];
    const qualification = normalized.results[1];

    assert.strictEqual(campaign.dataset, 'SZYN-OPENCODE-SWEBENCH-VERIFIED-500');
    assert.strictEqual(campaign.owner_zh, '中国移动苏州（苏州云能）');
    assert.strictEqual(campaign.record_kind, 'campaign');
    assert.strictEqual(campaign.executed_tasks, 500);
    assert.strictEqual(campaign.total_tasks, 500);
    assert.strictEqual(campaign.resolved_tasks, 232);
    assert.strictEqual(campaign.resolution_rate, 0.464);
    assert.match(campaign.caveat_en, /Complete 500-task B0 campaign/);
    assert.strictEqual(qualification.record_kind, 'qualification');
    assert.strictEqual(qualification.executed_tasks, 1);
    assert.strictEqual(qualification.superseded_by, campaign.id);
    assert.match(qualification.caveat_en, /not the current campaign progress/);
});

test('qualification contract rejects resolved counts above executed counts', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalize({
        contract_version: 'agent-dataset-results-v2',
        results: [{ id: 'bad', record_kind: 'qualification', executed_tasks: 1, total_tasks: 500, resolved_tasks: 2, resolution_rate: 2 }],
    }), /Invalid resolved task count/);
});

test('campaign rows must cover the declared denominator', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalize({
        contract_version: 'agent-dataset-results-v2',
        results: [{ id: 'partial', record_kind: 'campaign', executed_tasks: 499, total_tasks: 500, resolved_tasks: 232, resolution_rate: 232 / 499 }],
    }), /Incomplete campaign result/);
});

test('tool and agent qualifications belong to the Frontier settings view only', () => {
    const frontierPage = fs.readFileSync(FRONTIER_PAGE_PATH, 'utf8');
    const datasetPage = fs.readFileSync(DATASET_PAGE_PATH, 'utf8');

    assert.match(frontierPage, /id="frontier-agent-qualifications"/);
    assert.match(frontierPage, /agent-dataset-qualifications\.js/);
    assert.doesNotMatch(datasetPage, /id="frontier-agent-qualifications"/);
    assert.doesNotMatch(datasetPage, /agent-dataset-qualifications\.js/);
});
