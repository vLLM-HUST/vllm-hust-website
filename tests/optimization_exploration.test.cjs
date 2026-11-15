const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validate} = require('../assets/optimization-exploration.js');

function fixture() {
  const row = {id:'synthetic-complete', family:'Synthetic', state:'sealed-complete', planned:200,
    recorded:200, successful:200, unreturned:0, timing_eligible:true, seal_sha256:'a'.repeat(64),
    output_tokens:1000, duration_seconds:10, output_tokens_per_second:100, mean_tpot_ms:20,
    mean_ttft_ms:100, ttft_p95_ms:200, tpot_p95_ms:30, correct:100, truncated:5, unparsed:2};
  const failure = {...row, id:'synthetic-failed', state:'sealed-failed', timing_eligible:false,
    output_tokens_per_second:null, mean_ttft_ms:null, mean_tpot_ms:null, correct:null, truncated:null};
  return {schema:'vllm-hust-tradeoff-evidence/v1', rows:[row, failure], catalog_sha256:'b'.repeat(64),
    physical_trials:2, admitted_trials:1, source_row_references:2,
    sources:[{sha256:'c'.repeat(64), trial_ids:[row.id, failure.id]}],
    observed_performance_nondominated:[row.id], quality_qualified:false,
    stability_qualified:false, candidate_promoted:false};
}
test('retains startup failures as unmeasured and admits full-budget measurements', () => {
  const data = fixture(); assert.equal(validate(data), data);
});
test('rejects incomplete, inconsistent, duplicated or promoted measurements', () => {
  for (const change of [d=>d.rows[0].recorded--, d=>d.rows[0].output_tokens_per_second++,
    d=>d.rows[0].seal_sha256=null, d=>d.rows[0].correct=201,
    d=>d.rows[1].correct=0, d=>d.rows[1].id=d.rows[0].id,
    d=>d.admitted_trials++, d=>d.source_row_references++, d=>d.quality_qualified=true,
    d=>d.candidate_promoted=true]) {
    const data=fixture(); change(data); assert.throws(()=>validate(data));
  }
});
