const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../assets/plugin-performance.js');
const data = JSON.parse(fs.readFileSync('data/plugin-performance.json'));
const frontier = JSON.parse(fs.readFileSync('data/leaderboard_frontier.json'));
test('all Frontier rankings use complete five-point paired measurements', () => {
  const result = M.summarize(data, frontier);
  for (const row of data.entries.filter(row => row.pairs)) {
    assert.equal(row.pairs.length, 5);
    assert.equal(new Set(row.pairs.map(pair => pair.candidate)).size, 5);
    for (const pair of row.pairs) {
      const a = frontier.points.find(p => p.id === pair.candidate);
      const b = frontier.points.find(p => p.id === pair.native);
      assert.equal(a.configuration.parameters.source_capsule, b.configuration.parameters.source_capsule);
      assert.equal(a.evidence.measurement_seconds, b.evidence.measurement_seconds);
      assert.deepEqual(a.configuration.parameters.runtime_base_commits, b.configuration.parameters.runtime_base_commits);
    }
    assert.ok(Number.isFinite(result.get(row.id).gain));
  }
  assert.ok(result.get('mooncake-vllm-connectors').gain < 0);
  assert.ok(result.get('kv-tiering-migration').gain < result.get('mooncake-vllm-connectors').gain);
});
test('sorts measured entries first, preserves negative results and separates configurations', () => {
  const result = M.summarize(data, frontier);
  const sorted = [{id:'unmeasured'}, ...data.entries].sort((a,b) => M.compare(a,b,result));
  assert.equal(sorted.at(-1).id, 'unmeasured');
  assert.deepEqual(sorted.slice(0,4).map(row => row.id), ['bidkv','dla','mooncake-vllm-connectors','kv-tiering-migration']);
  assert.ok(sorted.findIndex(row => row.id === 'vspec') < sorted.findIndex(row => row.id === 'betterscale'));
  assert.equal(result.get('diffspec').gain, null);
});
test('rejects missing or cross-concurrency controls rather than inventing scores', () => {
  const broken = structuredClone(data);
  broken.entries[0].pairs[0].native = broken.entries[0].pairs[1].native;
  assert.throws(() => M.summarize(broken, frontier), /Invalid performance pair/);
  broken.entries[0].pairs[0].native = 'absent';
  assert.throws(() => M.summarize(broken, frontier), /Invalid performance pair/);
});
