(() => {
    'use strict';
    const BASE = './data/mmlu-pro-20261012/';
    const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const pct = (n, total) => `${(100 * n / total).toFixed(2)}%`;
    const num = (value, digits = 2) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    const count = (value) => num(value, 0);

    function renderRuntime(runtime, language) {
        const zh = language === 'zh';
        const labels = {
            dtype: ['计算精度', 'Compute precision'],
            tensor_parallel_size: ['张量并行 TP', 'Tensor parallel TP'],
            pipeline_parallel_size: ['流水线并行 PP', 'Pipeline parallel PP'],
            data_parallel_size: ['数据并行 DP', 'Data parallel DP'],
            enable_expert_parallel: ['专家并行 EP', 'Expert parallel EP'],
            decode_context_parallel_size: ['解码上下文并行 DCP', 'Decode context parallel DCP'],
            max_model_len: ['上下文上限', 'Context limit'],
            max_num_seqs: ['最大并发序列数', 'Maximum sequences'],
            max_num_batched_tokens: ['每批 token 上限', 'Maximum batched tokens'],
            gpu_memory_utilization: ['显存使用比例', 'Memory utilization'],
            enable_prefix_caching: ['前缀缓存 APC', 'Prefix caching APC'],
            enable_chunked_prefill: ['分块预填充', 'Chunked prefill'],
            compilation_mode: ['编译模式', 'Compilation mode'],
            cudagraph_mode: ['图执行模式', 'Graph execution mode'],
            cudagraph_capture_sizes: ['图捕获尺寸', 'Graph capture sizes'],
            enforce_eager: ['强制 Eager', 'Enforce eager'],
            disable_custom_all_reduce: ['禁用自定义 All-reduce', 'Disable custom all-reduce'],
            speculative_config: ['推测解码配置', 'Speculative decoding config'],
        };
        const fields = Object.entries(labels).filter(([key]) => runtime.fields[key]?.status === 'verified');
        const format = (value) => {
            if (value === null) return zh ? '无 (None)' : 'None';
            if (typeof value === 'boolean') return value ? (zh ? '是 / true' : 'Yes / true') : (zh ? '否 / false' : 'No / false');
            return escape(Array.isArray(value) ? value.join(', ') : value);
        };
        return `<section class="mmlu-runtime" aria-labelledby="mmlu-runtime-title">
          <div class="mmlu-runtime-heading"><div><span class="mmlu-runtime-badge">${zh ? '运行回执已确认' : 'Confirmed by runtime receipt'}</span><h3 id="mmlu-runtime-title">${zh ? '已确认运行配置' : 'Confirmed runtime configuration'}</h3></div><a href="${BASE}runtime.json" download>${zh ? '下载配置 JSON ↓' : 'Download configuration JSON ↓'}</a></div>
          <p>${zh ? '以下为本次 Native 启动日志中确认的实际值；由保存的启动回执事后重新解析，仅展示 verified 字段。' : 'Actual values confirmed in this Native startup log, obtained by a later reparse of the saved receipt. Only verified fields are shown.'}</p>
          <dl class="mmlu-runtime-grid">${fields.map(([key, label]) => `<div><dt>${label[zh ? 0 : 1]}</dt><dd>${format(runtime.fields[key].value)}</dd><small>${key}</small></div>`).join('')}</dl>
        </section>`;
    }

    function validate(data) {
        const { accuracy: a, performance: p, report: r, manifest: m } = data;
        if (m.source_kind !== 'operator-supplied-summary-handoff' || m.formal_acceptance !== false || m.paired_b1 !== null) throw new Error('Invalid handoff boundary');
        if (!Number.isInteger(a.cases) || a.cases <= 0 || a.correct < 0 || a.correct > a.cases || Math.abs(a.accuracy - a.correct / a.cases) > 1e-12) throw new Error('Invalid accuracy totals');
        const categories = Object.values(r.per_category);
        if (categories.reduce((s, c) => s + c.n, 0) !== a.cases || categories.reduce((s, c) => s + c.correct, 0) !== a.correct || r.accuracy.correct !== a.correct) throw new Error('Category totals disagree');
        if (p.num_prompts !== p.completed + p.failed || ![p.output_throughput, p.mean_ttft_ms, p.mean_tpot_ms].every((x) => Number.isFinite(x) && x >= 0)) throw new Error('Invalid performance summary');
        if (!data.runtime || data.runtime.run_id !== m.run_id || !data.runtime.fields || Object.values(data.runtime.fields).some((field) => field.status !== 'verified' || !Object.hasOwn(field, 'value'))) throw new Error('Invalid confirmed runtime receipt');
        return data;
    }

    function render(data, language) {
        const { accuracy: a, performance: p, report: r, manifest: m } = data;
        const zh = language === 'zh';
        const t = (cn, en) => zh ? cn : en;
        const card = (label, value, note) => `<div class="mmlu-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
        const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`;
        const categoryRows = Object.entries(r.per_category).sort((x, y) => y[1].accuracy - x[1].accuracy).map(([name, c]) => `<tr><th scope="row">${escape(name)}</th><td><meter min="0" max="1" value="${c.correct / c.n}" aria-label="${escape(name)}">${pct(c.correct, c.n)}</meter></td><td>${pct(c.correct, c.n)}</td><td>${count(c.correct)} / ${count(c.n)}</td></tr>`).join('');
        const normal = r.by_termination.finished_normally;
        const limited = r.by_termination.length_limited;
        return `<span class="eyebrow">${t('指定数据集 · 新增实测', 'Designated dataset · New measurement')}</span>
          <h2>MMLU-Pro · ${escape(m.measurement_date)}</h2>
          <p>${escape(m.model)} · Native · ${t('全量测试集 / 单次运行 / B1 待测', 'Full test split / Single lifecycle / B1 not measured')}</p>
          <p class="mmlu-boundary">${t('非官方评测口径，未通过 V5.5 正式验收。此处为操作者提供的运行摘要，独立于下方验证服务矩阵；使用 legacy plan，运行并发 16 与合同并发 1 不同，未绑定评分器哈希。', 'Non-official evaluation; not V5.5 acceptance. These operator-supplied summaries are separate from the validation-service matrix below. Legacy plan; runtime concurrency 16 differs from contract concurrency 1; scorer hash was not bound.')}</p>
          <div class="mmlu-cards">
            ${card(t('全量准确率', 'Full-test accuracy'), pct(a.correct, a.cases), `${count(a.correct)} / ${count(a.cases)} ${t('题', 'questions')}`)}
            ${card(t('输出吞吐 · 性能压测', 'Output throughput · load test'), `${num(p.output_throughput)} tok/s`, `${p.num_prompts} ${t('条请求 · 输出长度 256', 'requests · output length 256')}`)}
            ${card(t('平均 TTFT · 性能压测', 'Mean TTFT · load test'), `${num(p.mean_ttft_ms / 1000)} s`, 'request-rate = inf')}
            ${card(t('平均 TPOT · 性能压测', 'Mean TPOT · load test'), `${num(p.mean_tpot_ms)} ms`, `${p.completed}/${p.num_prompts} ${t('请求成功', 'requests completed')}`)}
          </div>
          ${renderRuntime(data.runtime, language)}
          <p class="mmlu-muted">${t('准确率与性能来自两次独立测试；性能压测的 53 秒 TTFT 不能与准确率客户端的 0.593 秒混用。暂无 B1 和重复运行统计，提升幅度不适用。', 'Accuracy and performance come from separate tests: the load-test 53-second TTFT is not interchangeable with the accuracy-client 0.593-second TTFT. No B1 or repeat statistics; improvement is unavailable.')}</p>
          <details><summary>${t('14 个学科的准确率', 'Accuracy across 14 subjects')}</summary><p class="mmlu-muted">${t('按准确率排序；总准确率按题数加权。', 'Sorted by accuracy; the overall score is weighted by question count.')}</p><div class="mmlu-table-wrap"><table><thead><tr><th>${t('学科', 'Subject')}</th><th>${t('分布', 'Distribution')}</th><th>${t('准确率', 'Accuracy')}</th><th>${t('正确 / 总数', 'Correct / Total')}</th></tr></thead><tbody>${categoryRows}</tbody></table></div></details>
          <details><summary>${t('输出质量与测试条件', 'Output quality and test conditions')}</summary><div class="mmlu-table-wrap"><table><tbody>
            ${row(t('传输失败 / 无法解析答案', 'Transport failures / Invalid answers'), `${a.transport_failures} / ${a.invalid_answers}`)}
            ${row(t('长度受限输出', 'Length-limited outputs'), `${count(a.length_limited)} / ${count(a.cases)} (${pct(a.length_limited, a.cases)})`)}
            ${row(t('正常结束子集准确率', 'Normally finished subset accuracy'), `${pct(normal.correct, normal.n)} (${count(normal.correct)} / ${count(normal.n)})`)}
            ${row(t('长度受限子集准确率', 'Length-limited subset accuracy'), `${pct(limited.correct, limited.n)} (${count(limited.correct)} / ${count(limited.n)})`)}
            ${row(t('准确率评测', 'Accuracy evaluation'), '/v1/completions · frozen token IDs · 5-shot · thinking off · temperature 0 · seed 17 · concurrency 16 · max_tokens 2048')}
            ${row(t('准确率客户端平均 TTFT / E2E', 'Accuracy-client mean TTFT / E2E'), `${num(a.mean_ttft_s, 3)} s / ${num(a.mean_e2e_s)} s`)}
            ${row(t('性能压测', 'Load test'), '/v1/chat/completions · 200 requests · request-rate inf · output length 256 · temperature 0 · seed 0')}
          </tbody></table></div><p class="mmlu-muted">${t('截断输出中有 1,287 条使用末尾独立 A–J 字母回退提取，可能把正文误判为答案。所有题目保留在总分母中；子集准确率仅用于诊断。', '1,287 truncated outputs used the last standalone A–J fallback, which can mistake prose for an answer. All questions remain in the overall denominator; subset scores are diagnostic only.')}</p></details>
          <details><summary>${t('数据来源与校验', 'Sources and checksums')}</summary><p><code>${escape(m.run_id)}</code></p><p class="mmlu-muted">${t('摘要报告生成在性能压测之前，其 bench 字段仍为 not run yet；性能值取自后续 performance.json。SHA-256 用于文件一致性校验，不代表签名或验收。', 'The report predates the load test and still says bench: not run yet; performance values use the later performance.json. SHA-256 checks file integrity, not signing or acceptance.')}</p><div class="mmlu-links">${['manifest', 'accuracy', 'performance', 'report'].map((name) => `<a href="${BASE}${name}.json" download>${name}.json ↓</a>`).join('')}</div></details>`;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const root = document.getElementById('mmlu-pro-handoff');
        if (!root) return;
        let data;
        let failed = false;
        const update = () => {
            const language = window.vllmHustSite?.getCurrentLang() || 'en';
            if (data) root.innerHTML = render(data, language);
            else if (failed) root.innerHTML = `<h2>MMLU-Pro · Native · 2026-10-12</h2><p>${language === 'zh' ? '实测摘要暂时无法加载。' : 'Measurement summaries are unavailable.'}</p><a href="${BASE}manifest.json">manifest.json</a>`;
        };
        window.addEventListener('vllm-hust:langchange', update);
        try {
            const entries = await Promise.all(['manifest', 'accuracy', 'performance', 'report', 'runtime'].map(async (key) => {
                const response = await fetch(`${BASE}${key}.json`);
                if (!response.ok) throw new Error(`Cannot load ${key}`);
                return [key, await response.json()];
            }));
            data = validate(Object.fromEntries(entries));
        } catch (error) {
            failed = true;
            console.error('MMLU-Pro handoff:', error);
        }
        update();
    });
})();
