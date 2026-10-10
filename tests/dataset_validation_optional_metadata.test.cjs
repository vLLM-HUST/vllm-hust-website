'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'assets', 'dataset-validation.js');
const SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8').replace(
    /\}\)\(\);\s*$/,
    'window.__datasetValidationTest = { normalize, normalizeIndex, normalizeProgram, selectScenario, selectableScenarios, coverageSummary, detailMetadata, provenanceHtml, detailNote, candidateValuesHtml };\n})();'
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
        program_url: './dataset_program_v1.json',
        default_scenario_id: 'qwen25',
        scenarios: [
            { id: 'qwen25', label: 'Qwen2.5-14B', data_url: './qwen25.json' },
            { id: 'qwen35', label: 'Qwen3.5-35B', data_url: './qwen35.json' },
        ],
    });

    assert.equal(api.selectScenario(index, 'qwen35').id, 'qwen35');
    assert.equal(api.selectScenario(index, 'unknown').id, 'qwen25');
});

test('selector hides planning scenarios unless a legacy URL selects one directly', () => {
    const api = loadTestApi();
    const index = api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        program_url: './dataset_program_v1.json',
        default_scenario_id: 'results',
        scenarios: [
            { id: 'results', label: 'Paired B0/B1', data_url: './results.json' },
            { id: 'planning', label: 'Coverage planning', data_url: './planning.json', selector_visible: false },
        ],
    });

    assert.deepEqual(Array.from(api.selectableScenarios(index, 'results'), (scenario) => scenario.id), ['results']);
    assert.deepEqual(Array.from(api.selectableScenarios(index, 'planning'), (scenario) => scenario.id), ['results', 'planning']);
});

test('coverage summary does not count measured B0-only cells as pending', () => {
    const api = loadTestApi();
    const summary = api.coverageSummary([
        { status: 'baseline_only', baseline_value: 10, value: null },
        { status: 'passed', baseline_value: 10, value: 12 },
        { status: 'not_tested', baseline_value: null, value: null },
        { status: 'not_applicable', baseline_value: null, value: null },
        { status: 'failed', baseline_value: 10, value: null },
    ]);

    assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
        total: 5,
        baseline: 3,
        paired: 1,
        awaiting: 1,
        failed: 1,
        notApplicable: 1,
    });
});

test('model index rejects duplicate scenarios and missing defaults', () => {
    const api = loadTestApi();
    assert.throws(() => api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        program_url: './dataset_program_v1.json',
        default_scenario_id: 'missing',
        scenarios: [{ id: 'qwen25', data_url: './qwen25.json' }],
    }), /Invalid default/);
    assert.throws(() => api.normalizeIndex({
        contract_version: 'dataset-validation-index-v1',
        program_url: './dataset_program_v1.json',
        default_scenario_id: 'qwen25',
        scenarios: [{ id: 'qwen25', data_url: './one.json' }, { id: 'qwen25', data_url: './two.json' }],
    }), /Invalid or duplicate/);
});

test('dataset program accepts exactly the five primary datasets', () => {
    const api = loadTestApi();
    const program = api.normalizeProgram({
        contract_version: 'dataset-program-v1',
        test_plan: {
            test_plan_version: 'V5.4',
            contract_url: 'https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/main/docs/ACCEPTANCE_V5_4.md',
            mandatory_model: 'Qwen/Qwen3.5-35B-A3B',
            formal_precision: 'BF16',
            baseline_roles: ['B0', 'B1'],
            evidence_boundary: 'Existing BF16 evidence is supplementary.',
            evidence_boundary_zh: '现有 BF16 证据仅作补充材料。',
        },
        designation: {
            id: 'pujiang-specified-dataset-scope',
            scope_status: 'names-only',
        },
        primary_datasets: [
            'mmlu-pro',
            'hle-verified',
            'swe-bench-pro',
            'frontierscience',
            'terminal-bench-2.1',
        ].map((id) => ({ id, primary_metric_zh: '主指标', source_url: 'https://example.com', readiness: { status: 'asset-frozen' } })),
    });
    assert.equal(program.primary_datasets.length, 5);
    assert.equal(program.test_plan.test_plan_version, 'V5.4');
    assert.throws(() => api.normalizeProgram({
        contract_version: 'dataset-program-v1',
        primary_datasets: [{ id: 'mmlu-pro' }],
    }), /Unsupported dataset program/);
    const wrongDesignation = structuredClone(program);
    wrongDesignation.designation.id = 'generic-primary-datasets';
    assert.throws(() => api.normalizeProgram(wrongDesignation), /Pujiang designation/);
});

test('candidate sets are validated and rendered without hiding non-selected MODs', () => {
    const api = loadTestApi();
    const artifact = {
        contract_version: 'dataset-validation-v1',
        datasets: [{ id: 'swe-c1', label: 'SWE C1' }],
        metrics: [{ id: 'output', label: 'Output', unit: 'token/s' }],
        results: [{
            dataset_id: 'swe-c1',
            metric_id: 'output',
            status: 'passed',
            value: 12,
            selected_candidate_id: 'second',
            candidate_values: [
                { candidate_id: 'first', label: 'First MOD', value: 11, delta_pct: 10, runtime_effectiveness: 'not-recorded', provenance: { repository: 'org/first', report_url: 'https://example.com/first' } },
                { candidate_id: 'second', label: 'Second MOD', value: 12, delta_pct: 20, runtime_effectiveness: 'exercised', provenance: { repository: 'org/second', report_url: 'https://example.com/second' } },
            ],
        }],
    };
    const normalized = api.normalize(artifact);
    const cell = normalized.results.get('swe-c1:output');
    const html = api.candidateValuesHtml(cell, artifact.metrics[0]);
    assert.match(html, /First MOD/);
    assert.match(html, /Second MOD/);
    assert.match(html, /validation-candidate--selected/);
    assert.match(html, /Not recorded/);
    assert.match(html, /Exercised/);

    artifact.results[0].selected_candidate_id = 'missing';
    assert.throws(() => api.normalize(artifact), /Selected candidate mismatch/);
});
