'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'dataset-validation.js');
const SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8').replace(
    /\}\)\(\);\s*$/,
    'window.__datasetValidationTest = { normalize, detailMetadata };\n})();'
);

function loadTestApi() {
    const sandbox = {
        window: {},
        document: { addEventListener() {} },
        console,
    };
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'dataset-validation.js' });
    return sandbox.window.__datasetValidationTest;
}

test('accepted artifacts may omit scenario and source metadata', () => {
    const api = loadTestApi();
    const data = api.normalize({
        contract_version: 'dataset-validation-v1',
        datasets: [{ id: 'sharegpt', label: 'ShareGPT' }],
        metrics: [{ id: 'tpot', label: 'TPOT' }],
        results: [{ dataset_id: 'sharegpt', metric_id: 'tpot', status: 'passed' }],
    });
    const cell = data.results.get('sharegpt:tpot');

    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(api.detailMetadata(cell, data))),
        { model: 'Not provided', hardware: 'Not provided', provenance: 'Not provided' }
    );
});

test('cell metadata overrides optional scenario and source defaults', () => {
    const api = loadTestApi();
    const data = {
        scenario: { model: 'scenario-model', hardware: 'scenario-hardware' },
        source: { artifact_url: 'scenario-artifact' },
    };
    const cell = {
        model: 'cell-model',
        hardware: 'cell-hardware',
        provenance: { job_url: 'cell-job' },
    };

    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(api.detailMetadata(cell, data))),
        { model: 'cell-model', hardware: 'cell-hardware', provenance: 'cell-job' }
    );
});
