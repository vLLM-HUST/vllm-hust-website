const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/project-milestones.js'), 'utf8'), {window});
const api = window.vllmHustProjectMilestones;
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/five-datasets-r6-20261114/summary-public-v3.json')));

test('project achievement retains its certified scope without inventing current efficiency', () => {
  const data = structuredClone(source);
  const before = JSON.stringify(data);
  assert.equal(data.formal_targets['3.4.1'].accepted, false);
  assert.equal(data.formal_targets['3.4.1'].measured_value, null);
  assert.equal(api.select(data, '3.4.1').accepted, true);
  assert.match(api.select(data, '3.4.1').accepted_scope, /fixed200\/out256/);
  assert.equal(data.project_final_assessment.targets['3.4.1'].attainment, 'not_demonstrated');
  assert.equal(JSON.stringify(data), before);
  for (const id of ['3.4.2','3.4.3','3.4.4']) assert.equal(api.select(data,id),data.formal_targets[id]);
});

for (const [name, mutate] of [
  ['below-threshold historical claim', d => d.formal_targets['3.4.1'].historical_evidence.measured_value = 49],
  ['missing scope', d => delete d.formal_targets['3.4.1'].historical_evidence.accepted_scope],
  ['wrong source', d => d.formal_targets['3.4.1'].historical_evidence.source_url = 'https://example.com'],
  ['missing raw evidence digest', d => delete d.formal_targets['3.4.1'].source_summary_sha256],
]) test(`reject ${name}`, () => {
  const data = structuredClone(source);
  mutate(data);
  assert.throws(() => api.select(data,'3.4.1'));
});
