'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'agent-dataset-qualifications.js');
const DATA_PATH = path.join(__dirname, '..', 'data', 'agent_dataset_qualifications.json');
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

test('published qualification is bounded to one of 500 tasks', () => {
    const api = loadTestApi();
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const normalized = api.normalize(data);
    const item = normalized.qualifications[0];

    assert.strictEqual(item.dataset, 'SZYN-OPENCODE-SWEBENCH-VERIFIED-500');
    assert.strictEqual(item.owner_zh, '中国移动苏州（苏州云能）');
    assert.strictEqual(item.executed_tasks, 1);
    assert.strictEqual(item.total_tasks, 500);
    assert.strictEqual(item.resolved_tasks, 1);
    assert.match(item.caveat_en, /remaining 499 tasks have not run/);
});

test('qualification contract rejects resolved counts above executed counts', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalize({
        contract_version: 'agent-dataset-qualification-v1',
        qualifications: [{ id: 'bad', executed_tasks: 1, total_tasks: 500, resolved_tasks: 2 }],
    }), /Invalid resolved task count/);
});
