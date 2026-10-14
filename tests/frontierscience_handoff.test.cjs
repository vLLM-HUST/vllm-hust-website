'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const base = path.join(root, 'data/frontierscience-20261013');
const data = Object.fromEntries(['manifest', 'report', 'runtime'].map((key) => [key, JSON.parse(fs.readFileSync(path.join(base, key + '.json')))]));
const source = fs.readFileSync(path.join(root, 'assets/frontierscience-handoff.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.api = { validate, render }; })();');
const sandbox = { window: {}, document: { addEventListener() {} } };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { validate, render } = sandbox.window.api;
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('published files and exact original table/manifest bind to the original run', () => {
    for (const [name, item] of Object.entries(data.manifest.files)) assert.equal(sha(fs.readFileSync(path.join(base, name))), item.published_sha256);
    assert.equal(sha(gunzipSync(fs.readFileSync(path.join(base, 'result-table.md.gz')))), data.manifest.original_binding.table_sha256);
    const original = gunzipSync(fs.readFileSync(path.join(base, 'original-manifest.json.gz')));
    assert.equal(sha(original), data.manifest.original_binding.manifest_sha256);
    assert.equal(JSON.parse(original).evidence_bundle_sha256, data.manifest.original_binding.evidence_bundle_sha256);
    assert.equal(validate(data).report.summary.tracks.olympiad.successes, 57);
    assert.equal(data.report.summary.tracks.research.successes, 5);
});

test('rejects mixed protocol, subject totals, distributions and runtime values', () => {
    for (const mutate of [
        d => { d.report.formal_acceptance = true; },
        d => { d.report.summary.subjects['research/biology'].total++; },
        d => { d.report.research_score_distribution[0].count++; },
        d => { d.runtime.fields.dtype.status = 'argv_only'; },
        d => { d.runtime.startup_log_sha256 = 'bad'; },
        d => { d.report.original_binding.table_sha256 = 'bad'; },
    ]) {
        const bad = structuredClone(data);
        mutate(bad);
        assert.throws(() => validate(bad));
    }
});

test('both locales show separate science tracks, bench and prominent actual runtime', () => {
    for (const lang of ['en', 'zh']) {
        const html = render(data, lang);
        for (const text of ['57.00%', '8.33%', '2.53 / 10', '555.66 tok/s', '33.95 s', '26.66 ms', '16384', '8192', 'FULL_DECODE_ONLY', 'V5.5']) assert.ok(html.includes(text), text);
        const panel = html.slice(html.indexOf('<section class="fs-runtime"'), html.indexOf('</section>'));
        assert.equal((panel.match(/<dt>/g) || []).length, 18);
        assert.doesNotMatch(panel, /<details/);
        assert.doesNotMatch(html, /undefined|NaN|79.86%|442.82|14 subjects/);
        for (const match of html.matchAll(/href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])));
    }
    assert.doesNotMatch(JSON.stringify(data.runtime), /expected|argv|log_snippet|\/root\//);
});

test('metadata is escaped', () => {
    const input = structuredClone(data);
    input.report.model = '<img src=x onerror=alert(1)>';
    assert.doesNotMatch(render(input, 'en'), /<img/);
    assert.match(render(input, 'en'), /&lt;img/);
});

test('load failure preserves provenance link and language switching', async () => {
    const element = { innerHTML: '' };
    let init, changeLanguage, locale = 'en';
    const context = {
        document: { addEventListener: (_, fn) => { init = fn; }, getElementById: () => element },
        window: { vllmHustSite: { getCurrentLang: () => locale }, addEventListener: (_, fn) => { changeLanguage = fn; } },
        fetch: async () => ({ ok: false }), console: { error() {} },
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    await init();
    assert.match(element.innerHTML, /unavailable/);
    assert.match(element.innerHTML, /manifest.json/);
    locale = 'zh';
    changeLanguage();
    assert.match(element.innerHTML, /无法加载/);
});
