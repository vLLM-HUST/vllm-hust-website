'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const base = path.join(root, 'data/mmlu-pro-20261012');
const data = Object.fromEntries(['manifest', 'accuracy', 'performance', 'report', 'runtime'].map((key) => [key, JSON.parse(fs.readFileSync(path.join(base, `${key}.json`), 'utf8'))]));
const source = fs.readFileSync(path.join(root, 'assets/mmlu-pro-handoff.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.api = { validate, render }; })();');
const sandbox = { window: {}, document: { addEventListener() {} } };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { validate, render } = sandbox.window.api;

test('runtime panel is expanded, bilingual and contains only confirmed actual values', () => {
    assert.equal(data.runtime.fields.max_model_len.value, 32768);
    assert.equal(data.runtime.fields.tensor_parallel_size.value, 2);
    assert.equal(data.runtime.fields.enable_prefix_caching.value, false);
    assert.equal(data.runtime.fields.speculative_config.value, null);
    assert.doesNotMatch(JSON.stringify(data.runtime), /expected|argv|log_snippet/);
    for (const locale of ['en', 'zh']) {
        const html = render(data, locale);
        const start = html.indexOf('<section class="mmlu-runtime"');
        const end = html.indexOf('</section>', start);
        const panel = html.slice(start, end);
        assert.ok(start > 0 && start < html.indexOf('<details>'));
        assert.doesNotMatch(panel, /<details|<summary/);
        for (const value of ['bfloat16', '32768', '8192', 'FULL_DECODE_ONLY', '1, 2, 4, 8, 16']) assert.ok(panel.includes(value));
        assert.equal((panel.match(/<dt>/g) || []).length, 18);
    }
    const invalid = structuredClone(data);
    invalid.runtime.fields.dtype.status = 'argv_only';
    assert.throws(() => validate(invalid), /Invalid confirmed runtime receipt/);
});

test('published summaries match the manifest and full-test category totals', () => {
    for (const [name, evidence] of Object.entries(data.manifest.files)) {
        assert.equal(createHash('sha256').update(fs.readFileSync(path.join(base, name))).digest('hex'), evidence.published_sha256);
        assert.match(evidence.source_sha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(validate(data).accuracy.correct, 9609);
    assert.equal(data.accuracy.cases, 12032);
    assert.equal(Object.keys(data.report.per_category).length, 14);
    const bad = structuredClone(data);
    bad.report.per_category.biology.n++;
    assert.throws(() => validate(bad), /Category totals disagree/);
    bad.manifest.formal_acceptance = true;
    assert.throws(() => validate(bad), /Invalid handoff boundary/);
});

test('both languages keep independent measurement definitions and acceptance limits', () => {
    for (const locale of ['en', 'zh']) {
        const html = render(data, locale);
        for (const number of ['79.86%', '442.82 tok/s', '53.48 s', '31.92 ms', '0.593 s', '9,609 / 12,032']) assert.ok(html.includes(number), number);
        assert.match(html, /legacy plan/i);
        assert.match(html, /V5.5/);
        assert.match(html, /1,287/);
        assert.match(html, /max_tokens 2048/);
        assert.match(html, /output length 256/);
        assert.equal((html.match(/<meter /g) || []).length, 14);
        assert.doesNotMatch(html, /undefined|NaN/);
    }
});

test('handoff escapes display metadata and links only to bundled summaries', () => {
    const input = structuredClone(data);
    input.manifest.model = '<img src=x onerror=alert(1)>';
    const html = render(input, 'en');
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
        assert.ok(fs.existsSync(path.join(root, match[1])));
    }
});

test('summary load failure retains a source link and responds to locale changes', async () => {
    const element = { innerHTML: '' };
    let init;
    let changeLanguage;
    let locale = 'en';
    const context = {
        document: { addEventListener: (_, fn) => { init = fn; }, getElementById: () => element },
        window: { vllmHustSite: { getCurrentLang: () => locale }, addEventListener: (_, fn) => { changeLanguage = fn; } },
        fetch: async () => ({ ok: false }),
        console: { error() {} },
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
