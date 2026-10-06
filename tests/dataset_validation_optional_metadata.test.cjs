'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'dataset-validation.js');
const SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8').replace(
    /\}\)\(\);\s*$/,
    'window.__datasetValidationTest = { normalize, normalizeIndex, selectScenario, detailMetadata, provenanceHtml, detailNote };\n})();'
);

function loadTestApi(locale = 'en') {
    const sandbox = {
        window: { vllmHustSite: { getCurrentLang: () => locale } },
        document: { addEventListener() {} },
        console,
        URL,
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

test('report provenance and bilingual cell notes remain visible', () => {
    const cell = {
        note: 'Candidate timeout was adjudicated as unresolved.',
        note_zh: '候选补丁超时按未解决计。',
        provenance: {
            report_url: 'https://github.com/example/report.json',
            artifact: 'https://github.com/example/archive.tar.gz',
        },
    };
    const english = loadTestApi('en');
    const chinese = loadTestApi('zh');
    assert.equal(english.detailMetadata(cell, {}).provenance, cell.provenance.report_url);
    assert.equal(english.detailNote(cell), cell.note);
    assert.equal(chinese.detailNote(cell), cell.note_zh);
    assert.match(chinese.provenanceHtml(cell.provenance.report_url), /查看报告/);
    assert.match(english.provenanceHtml(cell.provenance.report_url), /rel="noopener noreferrer"/);
    assert.doesNotMatch(english.provenanceHtml('javascript:alert(1)'), /href=/);
});

test('model index selects requested scenarios and falls back to the declared default', () => {
    const api = loadTestApi();
    const index = api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        default_scenario_id: 'qwen25',
        scenarios: [
            { id: 'qwen25', label: 'Qwen2.5-14B', data_url: './qwen25.json' },
            { id: 'qwen35', label: 'Qwen3.5-35B', data_url: './qwen35.json' },
        ],
    });

    assert.equal(api.selectScenario(index, 'qwen35').id, 'qwen35');
    assert.equal(api.selectScenario(index, 'unknown').id, 'qwen25');
});

test('model index rejects duplicate scenarios and missing defaults', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        default_scenario_id: 'missing',
        scenarios: [{ id: 'qwen25', data_url: './qwen25.json' }],
    }), /Invalid default/);
    assert.throws(() => api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        default_scenario_id: 'qwen25',
        scenarios: [{ id: 'qwen25', data_url: './one.json' }, { id: 'qwen25', data_url: './two.json' }],
    }), /Invalid or duplicate/);
});
