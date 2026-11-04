const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/b0-b1.js'), 'utf8');
const start = source.indexOf('  function controllerDiscoverySection()');
const end = source.indexOf('  function validateQualifiedPair', start);

test('discovery rendering derives gains and preserves distinct evidence scopes', () => {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data/controller-b1-discovery-20261104.json')));
  const context = {controllerDiscovery:d, t:cn=>cn, escape:String, number:n=>n.toFixed(4), source:p=>p, table:(h,r)=>JSON.stringify({h,r})};
  vm.createContext(context);
  vm.runInContext(source.slice(start,end), context);
  const html = vm.runInContext('controllerDiscoverySection()', context);
  for (const text of ['不是B0','没有匹配B0','23.45%','45.59%','28.93%','尚未重复验证','诊断仍失败','不采用','非完整代码Agent任务']) assert.ok(html.includes(text),text);
  d.arms.C.makespan_seconds=d.arms.B.makespan_seconds;
  const equal=vm.runInContext('controllerDiscoverySection()',context);
  assert.ok(equal.includes('再减少0.00%'));
  assert.ok(!equal.includes('23.45%'));
});
