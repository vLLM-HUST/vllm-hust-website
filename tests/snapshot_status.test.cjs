'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/snapshot-status.js'), 'utf8'), sandbox);
const snapshot = sandbox.vllmHustSnapshot;
const now = Date.parse('2026-09-03T06:00:00Z');
test('freshness rejects missing, invalid, future and stale timestamps', () => {
    for (const value of [undefined, '', 'invalid', '2026-08-01', '2026-10-01']) {
        assert.equal(snapshot.describe(value, 'en', now).stale, true);
    }
    assert.equal(snapshot.describe('2026-09-03T00:00:00Z', 'en', now).stale, false);
    assert.equal(snapshot.describe('2026-08-27T06:00:00Z', 'en', now).stale, false);
    assert.equal(snapshot.describe('2026-08-27T05:59:59Z', 'en', now).stale, true);
});
test('fresh and stale copy both distinguish a snapshot from live status', () => {
    assert.match(snapshot.describe('2026-09-03', 'en', now).text, /not live/);
    assert.match(snapshot.describe('2026-09-03', 'zh', now).text, /不是实时/);
    assert.match(snapshot.describe('2026-08-01', 'en', now).text, /out of date/);
    assert.match(snapshot.describe('2026-08-01', 'zh', now).text, /已过期/);
});
