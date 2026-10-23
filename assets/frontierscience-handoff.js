(() => {
    'use strict';
    const BASE = './data/frontierscience-20261013/';
    const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const num = (n, digits = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    const pct = (n, total) => num(100 * n / total) + '%';

    function validate(data) {
        const { report: r, runtime, manifest: m } = data;
        if (r.schema !== 1 || r.formal_acceptance !== false || r.paired_b1 !== null || r.trial_count !== 1 ||
            r.run_id !== m.run_id || runtime.run_id !== r.run_id ||
            r.summary.scope !== 'full_gold' || r.summary.scoring_policy !== 'mmlu_extract_first' ||
            r.summary.denominator_policy !== 'all_cases_invalid_as_nonsuccess') throw new Error('Invalid protocol boundary');
        for (const track of ['olympiad', 'research']) {
            const s = r.summary.tracks[track];
            if (!Number.isInteger(s.total) || s.total <= 0 || !Number.isInteger(s.successes) ||
                s.successes < 0 || s.successes > s.graded || s.graded + s.judge_unresolved !== s.total ||
                Math.abs(s.success_rate - s.successes / s.total) > 1e-12) throw new Error('Invalid track totals');
            const subjects = Object.entries(r.summary.subjects).filter(([k]) => k.startsWith(track + '/')).map(([, v]) => v);
            for (const key of ['total', 'graded', 'successes', 'solver_truncated', 'judge_truncated', 'judge_invalid']) {
                if (subjects.reduce((n, x) => n + x[key], 0) !== s[key]) throw new Error('Subject totals disagree');
            }
        }
        if (r.research_score_distribution.reduce((n, x) => n + x.count, 0) !== r.summary.tracks.research.graded) throw new Error('Invalid score distribution');
        const p = r.performance;
        if (p.num_prompts !== p.completed + p.failed ||
            ![p.output_throughput, p.mean_ttft_ms, p.mean_tpot_ms].every((x) => Number.isFinite(x) && x >= 0)) throw new Error('Invalid performance summary');
        if (Object.keys(runtime.fields).length !== 18 || Object.values(runtime.fields).some((v) => v.status !== 'verified' || !Object.hasOwn(v, 'value')) ||
            runtime.effective_sha256 !== m.original_binding.effective_json_sha256 ||
            runtime.startup_log_sha256 !== m.original_binding.startup_log_sha256) throw new Error('Invalid runtime evidence');
        if (JSON.stringify(r.original_binding) !== JSON.stringify(m.original_binding)) throw new Error('Invalid evidence binding');
        return data;
    }

    function render(data, language) {
        const zh = language === 'zh';
        const t = (cn, en) => zh ? cn : en;
        const { report: r, runtime, manifest: m } = data;
        const o = r.summary.tracks.olympiad, s = r.summary.tracks.research, p = r.performance;
        const card = (title, value, note) => '<div class="fs-card"><span>' + title + '</span><strong>' + value + '</strong><small>' + note + '</small></div>';
        const row = (label, values) => '<tr><th scope="row">' + label + '</th>' + values.map((v) => '<td>' + escape(v) + '</td>').join('') + '</tr>';
        const table = (heads, body) => '<div class="fs-table-wrap"><table><thead><tr>' + heads.map((h) => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
        const quality = table([t('诊断指标', 'Diagnostic'), 'Olympiad', 'Research'], [
            row(t('作答截断', 'Solver truncated'), [o.solver_truncated, s.solver_truncated]),
            row(t('Judge 截断', 'Judge truncated'), [o.judge_truncated, s.judge_truncated]),
            row(t('截断中提取到判定', 'Truncated with a grade'), [o.judge_truncated_with_grade, s.judge_truncated_with_grade]),
            row(t('无效 / 未解决判定', 'Invalid / unresolved grade'), [o.judge_invalid, s.judge_invalid]),
            row(t('复核标记（题数）', 'Audit flagged cases'), [o.judge_audit_flagged, s.judge_audit_flagged]),
            row(t('作答 / Judge 传输失败', 'Solver / judge transport failures'), [o.solver_failures + ' / ' + o.judge_transport_failures, s.solver_failures + ' / ' + s.judge_transport_failures]),
        ].join(''));
        const subjects = table([t('轨道 / 学科', 'Track / subject'), t('成功 / 总数', 'Success / total'), t('成功率', 'Success rate'), t('有效 Research 均分', 'Valid Research mean')],
            Object.entries(r.summary.subjects).map(([key, v]) => row(escape(key), [v.successes + ' / ' + v.total, pct(v.successes, v.total), v.mean_research_score_valid_only === null ? '—' : num(v.mean_research_score_valid_only)])).join(''));
        const distribution = table([t('分数区间', 'Score interval'), t('题数', 'Cases')], r.research_score_distribution.map((b) => row(b.lower === 10 ? '10' : '[' + b.lower + ', ' + b.upper + ')', [b.count])).join(''));
        const format = (v) => v === null ? 'None' : Array.isArray(v) ? v.join(', ') : String(v);
        const runtimePanel = '<section class="fs-runtime" aria-labelledby="fs-runtime-title"><div class="fs-runtime-heading"><h3 id="fs-runtime-title">' +
            t('已确认运行配置 · 18/18', 'Confirmed runtime configuration · 18/18') +
            '</h3><a href="' + BASE + 'runtime.json" download>runtime.json ↓</a></div><p>' +
            t('来自保存的真实启动日志，并在全量测试前核对当前进程参数。沿用 smoke 后持续运行的服务，本轮未重新启动。仅展示回执中 verified 的实际值。',
              'From the saved actual startup log, with current process arguments checked before the full run. The service continued after smoke; this run did not restart it. Only verified actual values are shown.') +
            '</p><dl class="fs-runtime-grid">' + Object.entries(runtime.fields).map(([key, v]) => '<div><dt>' + escape(key) + '</dt><dd>' + escape(format(v.value)) + '</dd></div>').join('') + '</dl></section>';
        return '<span class="eyebrow">' + t('指定数据集 · 全量实测', 'Designated dataset · Full measurement') + '</span>' +
            '<h2>FrontierScience · ' + escape(r.measurement_date_utc) + ' UTC</h2><p>' + escape(r.model) + ' · Native · 100 Olympiad + 60 Research</p>' +
            '<p class="fs-boundary">' + t('开发验证结果，非官方排行榜复现，未通过 V5.5 正式验收。采用官方 Appendix B 提示词、同一 Qwen 模型作答与评分、单次测评和本地判定提取。部分判定待人工复核；暂无 B1 或提升幅度。',
            'Development evaluation, not official leaderboard replication or V5.5 acceptance. Uses official Appendix B prompts, the same Qwen model for solving and judging, one trial and local verdict extraction. Some grades require human review; no B1 or improvement claim.') + '</p>' +
            '<div class="fs-cards">' +
            card(t('Olympiad 正确率', 'Olympiad accuracy'), pct(o.successes, o.total), o.successes + ' / ' + o.total) +
            card(t('Research 成功率（≥7）', 'Research success rate (≥7)'), pct(s.successes, s.total), s.successes + ' / ' + s.total) +
            card(t('Research 有效评分均值', 'Research valid-score mean'), num(s.mean_research_score_valid_only) + ' / 10', s.graded + t(' 个有效评分；其余未赋零分', ' valid grades; missing grades are not numeric zeros')) +
            card(t('输出吞吐 · 独立 bench', 'Output throughput · separate bench'), num(p.output_throughput) + ' tok/s', p.completed + '/' + p.num_prompts + t(' 请求完成', ' requests completed')) +
            '</div>' + runtimePanel +
            '<h3>' + t('评分口径与输出质量', 'Scoring and output quality') + '</h3><p>' +
            t('提取首个完整、独立一行的 VERDICT，截断输出也尝试提取；无有效判定的题目保留在总分母中计为未成功，不代表作答已被科学地判错。多个判定有分歧或触发规则时另标复核，不自动改分。复核规则并不穷尽所有矛盾。',
              'Extract the first complete standalone VERDICT, including truncated replies. Unresolved grades remain in the full denominator as nonsuccess, not as proof of a scientifically wrong answer. Conflicting verdicts and heuristic flags require review without changing scores. The audit is not exhaustive.') + '</p>' + quality +
            '<details><summary>' + t('三个学科的分项成绩', 'Results by the three science subjects') + '</summary>' + subjects + '</details>' +
            '<details><summary>' + t('Research 评分分布（仅有效评分）', 'Research score distribution (valid grades only)') + '</summary>' + distribution + '</details>' +
            '<h3>' + t('独立性能压测', 'Separate load test') + '</h3><div class="fs-cards">' +
            card('TTFT', num(p.mean_ttft_ms / 1000) + ' s', t('均值，包含排队影响', 'Mean, including queue effects')) +
            card('TPOT', num(p.mean_tpot_ms) + ' ms', t('平均每输出 token 时间', 'Mean time per output token')) +
            card(t('请求吞吐', 'Request throughput'), num(p.request_throughput) + ' req/s', t('160 条科学问题请求', '160 science prompts')) +
            card(t('持续时间', 'Duration'), num(p.duration) + ' s', 'failed = ' + p.failed) + '</div><p class="fs-muted">' +
            t('bench：输出上限 256、request-rate inf、temperature 0、seed 0、服务默认 chat template。该 TTFT 不代表串行作答延迟，也不能与准确率阶段混用。',
              'Bench: output cap 256, request-rate inf, temperature 0, seed 0, server-default chat template. Its TTFT is not serial solver latency and must not be mixed with the accuracy run.') +
            '</p><p>Solver: concurrency 1 · max_tokens 16384. Judge: concurrency 1 · max_tokens 8192. Both: temperature 0 · seed 17 · thinking off.</p>' +
            '<details><summary>' + t('执行证据与结果表绑定', 'Execution evidence and result-table binding') + '</summary><p><code>' + escape(r.run_id) + '</code></p><p>' +
            t('完整权重未计算哈希，仅核对 11 个模型小文件；镜像摘要未记录。SHA-256 用于一致性校验，不是签名。压缩文件保留原始结果表和封存清单的精确字节。',
              'Full weights were not hashed; only 11 small model files were checked. Image digest was not recorded. SHA-256 checks integrity, not a signature. Compressed downloads preserve the exact original result table and seal manifest.') +
            '</p><dl class="fs-hashes">' + ['table_sha256', 'evidence_bundle_sha256', 'manifest_sha256', 'contract_sha256'].map((key) => '<dt>' + key + '</dt><dd><code>' + escape(m.original_binding[key]) + '</code></dd>').join('') +
            '</dl><div class="fs-links">' + ['report.json', 'runtime.json', 'manifest.json', 'result-table.md.gz', 'original-manifest.json.gz'].map((name) => '<a href="' + BASE + name + '" download>' + name + ' ↓</a>').join('') + '</div></details>';
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const root = document.getElementById('frontierscience-handoff');
        if (!root) return;
        let data, failed = false;
        const update = () => {
            const lang = window.vllmHustSite?.getCurrentLang() || 'en';
            if (data) root.innerHTML = render(data, lang);
            else if (failed) root.innerHTML = '<h2>FrontierScience · 2026-10-13</h2><p>' + (lang === 'zh' ? '实测结果暂时无法加载。' : 'Measurement results are unavailable.') + '</p><a href="' + BASE + 'manifest.json">manifest.json</a>';
        };
        window.addEventListener('vllm-hust:langchange', update);
        try {
            const entries = await Promise.all(['report', 'runtime', 'manifest'].map(async (key) => {
                const response = await fetch(BASE + key + '.json');
                if (!response.ok) throw new Error('Cannot load ' + key);
                return [key, await response.json()];
            }));
            data = validate(Object.fromEntries(entries));
        } catch (error) {
            failed = true;
            console.error('FrontierScience handoff:', error);
        }
        update();
    });
})();
