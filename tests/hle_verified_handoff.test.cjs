'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const base = path.join(root, 'data/hle-verified-20261015');
const data = Object.fromEntries(['manifest', 'report', 'runtime'].map(k => [k, JSON.parse(fs.readFileSync(path.join(base, k + '.json')))]));
const source = fs.readFileSync(path.join(root, 'assets/hle-verified-handoff.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.api = { validate, render }; })();');
const sandbox = { window: {}, document: { addEventListener() {} } };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const { validate, render } = sandbox.window.api;
const sha = b => createHash('sha256').update(b).digest('hex');

test('all downloadable bytes bind to three distinct original seals', () => {
    for (const [name, item] of Object.entries(data.manifest.files)) assert.equal(sha(fs.readFileSync(path.join(base, name))), item.sha256);
    for (const [name, binding] of Object.entries(data.report.bindings)) {
        const original = gunzipSync(fs.readFileSync(path.join(base, name + '-manifest.json.gz')));
        assert.equal(sha(original), binding.manifest_sha256);
        assert.equal(JSON.parse(original).evidence_bundle_sha256, binding.evidence_bundle_sha256);
        assert.equal(sha(gunzipSync(fs.readFileSync(path.join(base, name + '-table.md.gz')))), binding.table_sha256);
    }
    assert.equal(validate(data).report.summaries.gold.tracks.gold.successes, 156);
    assert.equal(data.report.summaries.revision.tracks.revision.successes, 313);
});
test('reject invalid denominators, mixed protocols, missing images and unverified runtime', () => {
    for (const mutate of [
        d => { d.report.formal_acceptance = true; },
        d => { d.report.summaries.gold.tracks.gold.unresolved = 0; },
        d => { d.report.summaries.gold.scoring_policy = 'mmlu_extract_first'; },
        d => { d.report.summaries.revision.groups['revision/image'].total++; },
        d => { d.report.performance['gold-image'].n = 200; },
        d => { d.report.performance['revision-image'].input_tokens_verified = false; },
        d => { d.runtime.fields.dtype.status = 'argv_only'; },
        d => { d.report.bindings.gold.table_sha256 = 'bad'; },
    ]) {
        const bad = structuredClone(data); mutate(bad); assert.throws(() => validate(bad));
    }
});
test('both languages expose limits, separate image/text bench and all 20 runtime fields', () => {
    for (const lang of ['en', 'zh']) {
        const html = render(data, lang);
        for (const text of ['23.35%', '27.38%', '1071/1811', '72', '689', '381.32', '422.90', '314.48', '330.82', '57.85', '52.61', '16384', '8192', 'V5.5']) assert.ok(html.includes(text), text);
        const panel = html.slice(html.indexOf('<section class="hle-runtime"'), html.indexOf('</section>'));
        assert.equal((panel.match(/<dt>/g) || []).length, 20);
        assert.doesNotMatch(panel, /<details/);
        assert.doesNotMatch(html, /undefined|NaN|57.00%|8.33%/);
        for (const match of html.matchAll(/href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])));
    }
});
test('escape metadata and retain download link on load failure', async () => {
    const bad = structuredClone(data); bad.report.model = '<img src=x onerror=alert(1)>';
    assert.doesNotMatch(render(bad, 'en'), /<img/);
    const element = { innerHTML: '' }; let init, switchLang, lang = 'en';
    const context = { document: { addEventListener: (_, fn) => { init = fn; }, getElementById: () => element },
        window: { vllmHustSite: { getCurrentLang: () => lang }, addEventListener: (_, fn) => { switchLang = fn; } },
        fetch: async () => ({ ok: false }), console: { error() {} } };
    vm.createContext(context); vm.runInContext(source, context); await init();
    assert.match(element.innerHTML, /unavailable/); assert.match(element.innerHTML, /manifest.json/);
    lang = 'zh'; switchLang(); assert.match(element.innerHTML, /无法加载/);
});
