const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('B1 legend and fallback describe measured project-level best', () => {
    const root = path.resolve(__dirname, '..');
    const js = fs.readFileSync(path.join(root, 'assets/dataset-validation.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'dataset-validation.html'), 'utf8');
    assert.ok(js.includes('当前已实测最优的vLLM-HUST优化方案'));
    assert.ok(js.includes('Currently best measured vLLM-HUST optimization solution'));
    assert.ok(html.includes('id="validation-legend-b1">Currently best measured vLLM-HUST optimization solution'));
    assert.ok(!js.includes("'优化后' : 'Optimized'"));
});

test('MMLU local-argmax screen is visible without replacing a better B1', () => {
    const root = path.resolve(__dirname, '..');
    const data = JSON.parse(fs.readFileSync(path.join(root,
        'data/dataset_validation_qwen35_mmlu_school028_inf_out256.json'), 'utf8'));
    for (const cell of data.results) {
        const candidate = cell.candidate_values.find(row => row.candidate_id === 'vspec-argmax-median');
        assert.ok(candidate);
        assert.equal(candidate.runtime_effectiveness, 'exercised');
        assert.notEqual(cell.selected_candidate_id, candidate.candidate_id);
        const values = cell.candidate_values.map(row => row.value);
        const select = cell.comparison.direction === 'higher_is_better' ? Math.max : Math.min;
        assert.equal(cell.value, select(...values));
        assert.ok(cell.note.includes('Task accuracy was not rescored'));
    }
});
