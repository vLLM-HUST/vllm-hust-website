const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {validate} = require('../assets/gennova.js');
const data = JSON.parse(fs.readFileSync('data/gennova-validation-v1.json', 'utf8'));
test('standalone validation is not a MOD or a B1 replacement', () => {
    assert.equal(validate(data), data);
    assert.equal(data.metrics.output_tokens_per_second.toFixed(2), '828.62');
    for (const patch of [{kind:'runtime-mod'}, {b1_replacement_approved:true}, {full_dataset_quality_score:1}, {http_comparable:true}]) {
        assert.throws(() => validate({...data, ...patch}));
    }
});
test('reject inconsistent metrics and unpinned evidence', () => {
    assert.throws(() => validate({...data, metrics:{...data.metrics, seconds:0}}));
    assert.throws(() => validate({...data, evidence:{...data.evidence, report:'https://example.com'}}));
});
