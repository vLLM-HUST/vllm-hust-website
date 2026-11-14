(() => {
  'use strict';
  // Update this committed source path only after the new benchmark report is audited.
  const summaryPath = 'data/five-datasets-standard-20261113/summary-public-v2.json';
  const root = document.getElementById('five-dataset-comparison');
  if (!root) return;
  let data, manifest;
  const t = (zh, en) => window.vllmHustSite.getCurrentLang() === 'zh' ? zh : en;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '—';
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b));
  const table = (heads, rows) => `<div class="focus-table" tabindex="0" role="region" aria-label="${esc(heads.join(' / '))}"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<${i?'td':'th scope="row"'}>${esc(v)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const required = ['3.4.1','3.4.2','3.4.3','3.4.4'];
  const milestoneStatus = (id, goal) => goal.status === 'current_workload_reference_not_measured'
    ? t('本轮未验证','Current workload unverified')
    : id === '3.4.1' && goal.accepted && goal.accepted_scope?.startsWith('Existing qualified M01')
      ? t('归档工况达标','Historical workload met')
      : goal.accepted ? t('达标','Met') : t('未通过','Not passed');
  const names = () => t(['有效算力','吞吐与时延','上下文稳定性','成本与利用率'], ['Effective compute','Throughput and latency','Context stability','Cost and utilization']);

  function validate(d) {
    const fail = () => { throw Error('Incomplete or inconsistent five-profile publication'); };
    if (d.schema !== 'sealed-five-dataset-comparison/v1' || d.execution_complete !== true ||
        d.scope !== 'all_five_frozen_profiles_not_all_upstream_items' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.report_date) || !/^[a-f0-9]{40}$/.test(d.aggregation_engine_commit) ||
        !Number.isInteger(d.reused_stages) || !Number.isInteger(d.new_inference_stages) ||
        d.reused_stages < 0 || d.new_inference_stages < 0 || d.reused_stages + d.new_inference_stages !== 15 ||
        d.datasets?.length !== 5 || d.source_provenance?.stages?.length !== 15) fail();
    const ids = ['mmlu','hle','frontier','swe','terminal'], counts = [200,200,160,64,48];
    d.datasets.forEach((row,i) => {
      if (row.id !== ids[i] || row.mode !== (i<3?'quality_and_inference':'inference_only')) fail();
      for (const role of ['B0','B1']) {
        const a = row.arms?.[role];
        if (!a || a.planned !== counts[i] || a.recorded !== counts[i] || a.successful !== counts[i] ||
            a.failed !== 0 || a.unreturned !== 0 || ![a.duration_seconds,a.successful_output_tokens,a.output_tokens_per_second,a.mean_ttft_ms,a.mean_tpot_ms,a.estimated_cny_per_million_output_tokens].every(v=>Number.isFinite(v)&&v>0) ||
            !close(a.successful_output_tokens/a.duration_seconds,a.output_tokens_per_second)) fail();
        if (i<3) {
          const q = row.quality?.[role];
          const count = i===0 ? q?.planned_denominator : Object.values(q?.tracks || {}).reduce((s,x)=>s+x.total,0);
          if (count !== counts[i]) fail();
        } else if (row.quality !== null) fail();
      }
      for (const key of ['output_tokens_per_second','mean_ttft_ms','mean_tpot_ms']) {
        if (!close(row.changes_percent?.[key],100*(row.arms.B1[key]/row.arms.B0[key]-1))) fail();
      }
      if (!close(row.changes_percent?.unit_cost_change_percent,100*(row.arms.B1.estimated_cny_per_million_output_tokens/row.arms.B0.estimated_cny_per_million_output_tokens-1))) fail();
    });
    for (const id of required) {
      if (typeof d.formal_targets?.[id]?.accepted !== 'boolean' ||
          !['demonstrated','not_demonstrated'].includes(d.project_final_assessment?.targets?.[id]?.attainment)) fail();
    }
  }

  function qualityRows() {
    return data.datasets.slice(0,3).flatMap(row=>['B0','B1'].map(role=>{
      const q = row.quality[role], tracks = Object.entries(q.tracks || {});
      if (row.id === 'mmlu') return [row.name,role,`${q.correct}/${q.planned_denominator}`,q.truncated_recorded,q.unparsed_recorded,'—','—',q.unreturned];
      return [row.name,role,tracks.map(([name,x])=>`${name}: ${x.successes}/${x.total}`).join('; '),
        tracks.reduce((s,[,x])=>s+x.solver_truncated,0),
        '—',
        tracks.reduce((s,[,x])=>s+(x.unresolved ?? x.judge_unresolved),0),
        tracks.reduce((s,[,x])=>s+x.judge_truncated,0),row.arms[role].unreturned];
    }));
  }

  function render() {
    if (!data) return;
    const final = data.project_final_assessment.targets;
    const source = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${manifest.commit}/website-publication/${summaryPath}`;
    const metric = (field, divisor=1) => table(t(['固定数据集','B0','B1','B1变化（%）'],['Frozen dataset','B0','B1','B1 change (%)']),data.datasets.map(row=>[row.name,n(row.arms.B0[field]/divisor),n(row.arms.B1[field]/divisor),n(row.changes_percent[field])]));
    const milestoneRequirements = t(
      ['同工况参考效率 ≥50%','吞吐 ≥10%；TTFT/TPOT 各改善 ≥5%','16K 相对4K吞吐同量级，P95/P99无异常陡升','单位token成本降低 ≥10%；高负载利用率改善'],
      ['Workload-reference efficiency ≥50%','Throughput +10%; TTFT/TPOT each reduced ≥5%','16K vs4K throughput in the same order; no abnormal P95/P99 spike','Unit token cost reduced ≥10%; improved utilization at high load']);
    const goals = required.map((id,i)=>[`${id} ${names()[i]}`,milestoneRequirements[i],t(data.formal_targets[id].display_value,data.formal_targets[id].display_value_en || data.formal_targets[id].display_value),
      milestoneStatus(id,data.formal_targets[id]),
      t(final[id].requirement,final[id].requirement_en),
      final[id].attainment==='demonstrated'?t('达标','Met'):t('未证明达标','Not demonstrated')]);
    root.innerHTML = `<section class="five-dataset-panel"><h2>${t('固定五数据集 B0/B1 实测','Frozen five-dataset B0/B1 measurements')}</h2>
      <p>${esc(data.report_date)} · ${esc(data.run_id)} · ${esc(data.runtime.engine_release || t('历史 r4 组合','Historical r4 profile'))}</p>
      <p>${esc(t(`全量指固定的五个子集：MMLU200、HLE200、Frontier160、SWE trace32（64请求）、Terminal trace32（48请求）。两臂均完成；复用${data.reused_stages}个已封存阶段，新执行${data.new_inference_stages}个阶段。`,`Full means the five frozen subsets: MMLU200, HLE200, Frontier160, SWE trace32 (64 requests), Terminal trace32 (48 requests). Both arms completed; ${data.reused_stages} sealed stages reused, ${data.new_inference_stages} stages newly executed.`))}</p>
      <p>${esc(`${data.hardware.model} · ${data.hardware.dtype} · ${data.hardware.accelerator} × ${data.hardware.cards} · ${data.hardware.parallelism}`)}</p>
      <h3>${t('四项目标：里程碑与项目最终要求','Four goals: milestone and project-final requirements')}</h3>
      ${table(t(['目标','里程碑要求','里程碑观测','里程碑结论','项目最终要求','最终结论'],['Goal','Milestone requirement','Milestone observation','Milestone result','Project-final requirement','Final result']),goals)}
      ${required.map((id,i)=>`<details><summary>${esc(names()[i])} · ${t('依据与限制','Evidence and limits')}</summary><p>${esc(t(data.formal_targets[id].reason,data.formal_targets[id].reason_en || data.formal_targets[id].accepted_scope || data.formal_targets[id].status))}</p><p>${esc(t(final[id].reason,final[id].evidence_summary_en))}</p></details>`).join('')}
      <h3>${t('输出吞吐（token/s，越高越好）','Output throughput (token/s, higher is better)')}</h3>${metric('output_tokens_per_second')}
      <h3>${t('平均 TTFT（秒，越低越好）','Mean TTFT (seconds, lower is better)')}</h3>${metric('mean_ttft_ms',1000)}
      <h3>${t('平均 TPOT（毫秒，越低越好）','Mean TPOT (ms, lower is better)')}</h3>${metric('mean_tpot_ms')}
      <p>${t('TTFT 包含本批请求的排队等待；预热及编译边界以对应版本的原始回执为准。性能结果不证明答案正确或统计质量等价。','TTFT includes request queueing within the batch; warmup and compilation boundaries follow each version’s original receipts. Performance does not establish correct answers or statistical quality equivalence.')}</p>
      <h3>${t('任务质量与未决数','Task quality and unresolved cases')}</h3>
      <p class="judge-disclosure">${t('参考Engine的HLE/Frontier评分复用同一份35B权重，由脚本单独启动固定B1阶段，无需另备模型或外部裁判服务。评分增加总耗时，其流量不计solver性能和单位token成本。同模型辅助评分不构成独立模型验证；裁判未决单列，不等同引擎请求失败。MMLU200使用规则评分。','The reference Engine reuses the same 35B weights in separate fixed-B1 HLE/Frontier scoring stages; no additional model or external judge service is required. Scoring adds total runtime and is excluded from solver performance and unit-token cost. Same-model auxiliary scores are not independent-model validation; unresolved judgments are listed separately from engine request failures. MMLU200 uses rule scoring.')}</p>
      ${table(t(['固定数据集','配置','正确/原计划分母','回答截断','无法解析','裁判未决','裁判截断','未返回'],['Frozen dataset','Arm','Correct / planned denominator','Solver truncated','Unparsed','Judge unresolved','Judge truncated','Unreturned']),qualityRows())}
      <p>${t('未决项保留在分母内并计为非成功；HLE/Frontier 使用另行披露的替代裁判。SWE 与 Terminal 只回放公开 trace 测推理性能，不提供任务解决率。','Unresolved cases remain in the planned denominator as nonsuccess. HLE/Frontier use the disclosed substitute judge. SWE and Terminal replay public traces for inference performance and provide no task solve rate.')}</p>
      <h3>${t('单位输出 token 成本估算','Estimated cost per output token')}</h3>
      ${table(t(['固定数据集','B0 元/百万token','B1 元/百万token','变化（%）'],['Frozen dataset','B0 CNY/million tokens','B1 CNY/million tokens','Change (%)']),data.datasets.map(row=>[row.name,n(row.arms.B0.estimated_cny_per_million_output_tokens),n(row.arms.B1.estimated_cny_per_million_output_tokens),n(row.changes_percent.unit_cost_change_percent)]))}
      <p>${esc(t(`费用采用${data.price_basis.checked_date}历史公开报价，两臂同费率折算；不是实际账单。`, `Both arms use the same historical public rate checked ${data.price_basis.checked_date}; these estimates are not actual invoices.`))}</p>
      <p class="focus-source"><a href="${esc(source)}">${t('完整数据、原始来源与校验清单','Full metrics, original provenance and checksums')}</a> · ${t('发布源提交','Published source commit')}: ${esc(manifest.commit.slice(0,12))}</p>
      <p>${t('下方为历史 V1.03 专项结果，保留原有版本和工况。','The V1.03 sections below retain their historical versions and workloads.')}</p>
    </section>`;
    root.dataset.loaded = data.run_id;
    root.setAttribute('aria-busy','false');
  }

  async function load() {
    const response = await fetch('./data/benchmark-source-manifest.json',{cache:'no-cache'});
    if (!response.ok) throw Error('Unavailable publication manifest');
    const m = await response.json();
    if (m.repository !== 'vLLM-HUST/vllm-hust-benchmark' || m.status !== 'published-source' || !/^[a-f0-9]{40}$/.test(m.commit)) throw Error('Invalid publication identity');
    const entries = m.files.filter(f=>f.website_path===summaryPath);
    if (entries.length !== 1) throw Error('Unpublished or ambiguous five-profile source');
    const result = await fetch('./'+summaryPath,{cache:'no-cache'});
    if (!result.ok) throw Error('Unavailable five-profile source');
    const raw = await result.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if (hash !== entries[0].sha256 || raw.byteLength !== entries[0].bytes) throw Error('Five-profile publication hash mismatch');
    const value = JSON.parse(new TextDecoder().decode(raw));
    validate(value); data=value; manifest=m; render();
  }
  window.addEventListener('vllm-hust:langchange',render);
  load().catch(error=>{
    console.error('Five-profile publication rejected',error);
    root.dataset.error = 'publication-rejected';
    root.setAttribute('aria-busy','false');
    root.textContent=t('五数据集结果加载或校验失败，请查看发布源。','Five-dataset results unavailable or verification failed; check the publication source.');
  });
})();
