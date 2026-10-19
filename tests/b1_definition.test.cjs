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
