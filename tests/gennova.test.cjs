const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validate} = require('../assets/gennova.js');
// Synthetic validator input; historical measurements remain in benchmark custody.
const evidenceCommit = '2'.repeat(40);
const prefix = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${evidenceCommit}/reports/gennova-mmlu-pro-20261023/`;
const data = {
    schema: 'gennova-independent-validation/v1', kind: 'independent-engine',
    b1_replacement_approved: false, full_dataset_quality_score: null, http_comparable: false,
    source_commit: '1'.repeat(40), benchmark_evidence_commit: evidenceCommit,
    metrics: {completed_requests: 200, total_output_tokens: 51200, seconds: 512,
        output_tokens_per_second: 100, rank_output_agreement: true, exit_code: 0,
        all_devices_released: true},
    evidence: Object.fromEntries(['report', 'manifest', 'raw_run', 'protocol'].map(key => [key, `${prefix}${key}.json`]))
};
test('standalone validation is not a MOD or a B1 replacement', () => {
    assert.equal(validate(data), data);
    assert.equal(data.metrics.output_tokens_per_second.toFixed(2), '100.00');
    for (const patch of [{kind:'runtime-mod'}, {b1_replacement_approved:true}, {full_dataset_quality_score:1}, {http_comparable:true}]) {
        assert.throws(() => validate({...data, ...patch}));
    }
});
test('reject inconsistent metrics and unpinned evidence', () => {
    assert.throws(() => validate({...data, metrics:{...data.metrics, seconds:0}}));
    assert.throws(() => validate({...data, evidence:{...data.evidence, report:'https://example.com'}}));
});
