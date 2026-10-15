(() => {
    'use strict';
    const BASE = './data/hle-verified-20261015/';
    const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const num = n => Number(n).toFixed(2);
    function validate(data) {
        const { report: r, runtime, manifest: m } = data;
        if (r.schema !== 1 || r.formal_acceptance !== false || r.paired_b1 !== null || r.trial_count !== 1 || r.run_id !== m.run_id ||
            JSON.stringify(r.bindings) !== JSON.stringify(m.bindings) || JSON.stringify(r.runtime) !== JSON.stringify(runtime)) throw new Error('Invalid evidence binding');
        for (const [track, count] of [['gold', 668], ['revision', 1143]]) {
            const s = r.summaries[track], t = s.tracks[track];
            if (s.scope !== 'complete_selected_plan' || s.scoring_policy !== 'strict_json' || t.total !== count || t.graded + t.unresolved !== count ||
                !Number.isInteger(t.successes) || t.successes < 0 || t.successes > t.graded || Math.abs(t.accuracy - t.successes / count) > 1e-12) throw new Error('Invalid accuracy');
            for (const k of ['total', 'graded', 'successes', 'unresolved', 'solver_truncated', 'judge_truncated']) {
                if (Object.values(s.groups).reduce((n, v) => n + v[k], 0) !== t[k] || Object.values(s.subjects).reduce((n, v) => n + v[k], 0) !== t[k]) throw new Error('Breakdown mismatch');
            }
        }
        for (const [group, count] of [['gold-text', 200], ['revision-text', 200], ['gold-image', 93], ['revision-image', 118]]) {
            const p = r.performance[group];
            if (p.n !== count || p.completed + p.failed !== count || p.input_tokens_verified !== true ||
                ![p.output_throughput, p.mean_ttft_ms, p.mean_tpot_ms].every(x => Number.isFinite(x) && x >= 0)) throw new Error('Invalid bench');
        }
        if (Object.keys(runtime.fields).length !== 20 || Object.values(runtime.fields).some(v => v.status !== 'verified') ||
            runtime.effective_sha256 !== r.bindings.bench.effective_json_sha256 || runtime.startup_log_sha256 !== r.bindings.bench.startup_log_sha256) throw new Error('Invalid runtime');
        return data;
    }
    function render(data, language) {
        const zh = language === 'zh', t = (cn, en) => zh ? cn : en;
        const { report: r, runtime } = data;
        const table = (heads, rows) => '<div class="hle-table-wrap" tabindex="0"><table><thead><tr>' + heads.map(v => '<th scope="col">' + escape(v) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map((v, i) => (i ? '<td>' : '<th scope="row">') + escape(v) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</tbody></table></div>';
        const accuracy = table([t('子集', 'Subset'), t('判对 / 总数', 'Correct / selected'), t('正确率', 'Accuracy'), t('未判定', 'Unresolved'), t('作答截断', 'Solver length'), t('Judge 截断', 'Judge length')], ['gold', 'revision'].map(k => {
            const s = r.summaries[k].tracks[k];
            return [k, s.successes + '/' + s.total, num(s.accuracy * 100) + '%', s.unresolved, s.solver_truncated, s.judge_truncated];
        }));
        const performance = table([t('压测组', 'Bench group'), t('成功 / 请求', 'Completed / requests'), t('失败', 'Failed'), t('输出 token/s', 'Output token/s'), 'TTFT (s)', 'TPOT (ms)'], Object.entries(r.performance).map(([k, p]) => [k, p.completed + '/' + p.n, p.failed, num(p.output_throughput), num(p.mean_ttft_ms / 1000), num(p.mean_tpot_ms)]));
        const breakdown = table([t('子集 / 模态', 'Subset / modality'), t('判对 / 总数', 'Correct / selected'), t('正确率', 'Accuracy'), t('未判定', 'Unresolved')], Object.values(r.summaries).flatMap(s => Object.entries(s.groups).map(([k, v]) => [k, v.successes + '/' + v.total, num(v.accuracy * 100) + '%', v.unresolved])));
        const subjects = table([t('子集 / 学科', 'Subset / subject'), t('判对 / 总数', 'Correct / selected'), t('正确率', 'Accuracy'), t('未判定', 'Unresolved')], Object.values(r.summaries).flatMap(s => Object.entries(s.subjects).map(([k, v]) => [k, v.successes + '/' + v.total, num(v.accuracy * 100) + '%', v.unresolved])));
        return '<span class="eyebrow">HLE-Verified · 2026-10-14/15 UTC</span><h2>HLE-Verified · ' + escape(r.model) + '</h2>' +
            '<p class="hle-boundary">' + t('开发验证，非官方排行榜复现或 V5.5 正式验收。使用作者发布的 Gold 668 + Revision 1143，未纳入 Uncertain 689；Gold、Revision 分别报告。采用原 HLE 提示词与 JSON 评分结构，由同一 Qwen 模型作答和代替官方 Judge，单次测评。', 'Development evaluation, not official leaderboard replication or V5.5 acceptance. Author-published Gold 668 + Revision 1143; Uncertain 689 excluded. Tracks are reported separately. Original HLE prompts and JSON grading schema, same Qwen solver and substitute judge, one trial.') + '</p><p class="hle-scroll-hint">' + t('表格可横向滑动查看全部指标。', 'Scroll tables horizontally to see all metrics.') + '</p>' + accuracy +
            '<p class="hle-boundary">' + t('72 道 Judge 截断题未判定，仍保留在总分母中，不等于已确认答错。严格 JSON 判分要求正常结束，不抢救半截 JSON、不重试。作答截断 1071/1811，仍交给 Judge 判分，不直接判错；截断比例较高，成绩需结合该限制解读。', '72 length-ended judge replies remain unresolved in the full denominator, not confirmed wrong. Strict JSON requires normal completion; no partial-JSON rescue or retries. Solver truncations: 1071/1811; these outputs were judged, not automatically marked incorrect. High truncation materially limits interpretation.') + '</p>' +
            '<p>Solver / Judge: concurrency 16 / 16 · max_tokens 16384 / 8192 · temperature 0 · seed 17 · thinking off.</p>' +
            '<details><summary>' + t('文本 / 图片与学科分项', 'Text / image and subject breakdowns') + '</summary>' + breakdown + subjects + '</details>' +
            '<h3>' + t('四组独立性能压测', 'Four separate load tests') + '</h3>' + performance +
            '<p>' + t('文本从冻结顺序等间隔抽取各 200 题；图片全量 93/118 题，保留原题与真实图片、不重复补足。输出上限 256，temperature=0、seed=0、thinking=false，允许 EOS 提前结束。request-rate=inf，客户端没有并发上限；max_num_seqs=16 是服务端设置。TTFT 包含排队，不能当作单请求延迟。', 'Text: 200 evenly spaced cases per frozen track; images: all 93/118 with original text and real images, no repetition. Output cap256, temperature0, seed0, thinking=false, EOS allowed. request-rate=inf, no client concurrency cap; max_num_seqs16 is a server setting. TTFT includes queueing, not isolated request latency.') + '</p><p>' +
            t('压测没有准确率阶段的 system prompt，服务端只套一次模板；不是准确率请求重放。611 题输入 token 数与服务端逐题核验一致（包括图片），不另行声称视觉 token 数。复用已运行的服务，经预检和 smoke，不是冷缓存测试。', 'Bench omits the accuracy system prompt and applies the server template once; it is not an accuracy replay. All 611 input lengths match same-server tokenization including images; no separate visual-token count is claimed. Reused service after preflight/smoke, not a cold-cache test.') + '</p>' +
            '<section class="hle-runtime"><h3>' + t('已核验实际运行配置 · 20/20', 'Verified actual runtime · 20/20') + '</h3><dl class="hle-runtime-grid">' + Object.entries(runtime.fields).map(([k, v]) => '<div><dt>' + escape(k) + '</dt><dd>' + escape(v.value === null ? 'None' : Array.isArray(v.value) ? v.value.join(', ') : v.value) + '</dd></div>').join('') + '</dl></section>' +
            '<details><summary>' + t('三份封存结果与 SHA-256 绑定', 'Three sealed results and SHA-256 bindings') + '</summary><p>' + t('模型小文件已哈希，权重只列清单，完整权重、镜像摘要和本地模型 revision 未验证。SHA-256 是一致性校验，不是签名。公开包不含题目、图片、答案和环境转储，不能据此重新判分。', 'Small model files hashed, weights inventoried only. Full weights, image digest and local model revision unverified. SHA-256 provides integrity, not a signature. Public package excludes question/image/answer payloads and environment dumps; independent regrading is unavailable.') + '</p>' +
            Object.entries(r.bindings).map(([k, v]) => '<h4>' + escape(k) + '</h4><dl class="hle-hashes">' + ['table_sha256', 'evidence_bundle_sha256', 'manifest_sha256'].map(key => '<dt>' + key + '</dt><dd><code>' + escape(v[key]) + '</code></dd>').join('') + '</dl><p><a href="' + BASE + k + '-table.md.gz" download>result table ↓</a> · <a href="' + BASE + k + '-manifest.json.gz" download>original manifest ↓</a></p>').join('') +
            '<div class="hle-links">' + ['report.json', 'runtime.json', 'manifest.json'].map(n => '<a href="' + BASE + n + '" download>' + n + ' ↓</a>').join('') + '</div></details>';
    }
    document.addEventListener('DOMContentLoaded', async () => {
        const root = document.getElementById('hle-verified-handoff');
        if (!root) return;
        let data, failed = false;
        const update = () => {
            const lang = window.vllmHustSite?.getCurrentLang() || 'en';
            if (data) root.innerHTML = render(data, lang);
            else if (failed) root.innerHTML = '<h2>HLE-Verified</h2><p>' + (lang === 'zh' ? '实测结果暂时无法加载。' : 'Measurement results are unavailable.') + '</p><a href="' + BASE + 'manifest.json">manifest.json</a>';
        };
        window.addEventListener('vllm-hust:langchange', update);
        try {
            data = validate(Object.fromEntries(await Promise.all(['report', 'runtime', 'manifest'].map(async k => {
                const response = await fetch(BASE + k + '.json');
                if (!response.ok) throw new Error('Cannot load ' + k);
                return [k, await response.json()];
            }))));
        } catch (error) { failed = true; console.error('HLE-Verified handoff:', error); }
        update();
    });
})();
