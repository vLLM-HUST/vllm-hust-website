/* Download an execution prompt only after both frozen inputs pass verification. */
(function () {
  'use strict';
  let payload;
  let downloadingScript = false;
  const button = document.getElementById('download-test-prompt');
  const scriptButton = document.getElementById('download-test-script');
  const status = document.getElementById('prompt-download-status');
  const bootstrap = {
    repository: 'vLLM-HUST/vllm-hust-benchmark',
    commit: '80e7efc9f7357bafb5ea502fe0838c340def5092', // pragma: allowlist secret
    path: 'scripts/third_party_self_run/engine_bootstrap.py',
    runner: '448362c7565597c8963c970dcfea0b235fd5fcf7', // pragma: allowlist secret
    sha256: 'f328b57ab5929f4e6b697ca076c4b81a4613d9fadb154ed7ef24fb70f8bb8c64', // pragma: allowlist secret
    bytes: 8716,
  };
  const language = () => (window.vllmHustSite?.getCurrentLang()
    || localStorage.getItem('vllm-hust_lang') || navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
  const copy = {
    zh: {button: '下载 AI 测试提示词 ↓', ready: '下载 TXT，含完整执行步骤与固定协议身份', loading: '标准与运行指南校验通过后可下载', done: '已生成 TXT 下载', failed: '下载失败，请重试', script: '下载一键测试脚本 ↓', scriptReady: 'Python 3.11+ 引导脚本；按指南配置模型、SDK、卡号与访问权限', scriptMismatch: '脚本与当前协议版本不匹配，暂不可下载', scriptLoading: '正在校验脚本…', scriptDone: '已生成 one_click.py 下载；请按指南配置本机参数', scriptFailed: '脚本下载或校验失败，请重试', hint: 'TXT 提示词 · Python 脚本，须配置本机环境'},
    en: {button: 'Download AI test prompt ↓', ready: 'Download TXT with execution steps and pinned protocol identities', loading: 'Available after standard and run-guide verification', done: 'TXT download generated', failed: 'Download failed. Please try again.', script: 'Download one-click script ↓', scriptReady: 'Python 3.11+ bootstrap; configure model, SDK, devices and source access using the guide', scriptMismatch: 'Script version does not match the current protocol', scriptLoading: 'Verifying the script…', scriptDone: 'one_click.py download generated; configure local parameters using the guide', scriptFailed: 'Script download or verification failed. Please retry.', hint: 'TXT prompt · Python script; local setup required'},
  };

  function command(guide, mode) {
    return guide.execution.command_template
      .replace(' --datasets', ' --b1-python /path/to/fixed-b1-sdk/bin/python --physical-devices 0,1 --datasets')
      .replace('{datasets}', mode.datasets_flag)
      .replace(/ --/g, ' \\\n  --');
  }

  function buildPrompt() {
    const {data, guide, source, entry, digest, guideSource, guideEntry, guideDigest} = payload;
    const zh = language() === 'zh';
    const field = (object, key) => object[`${key}_${zh ? 'zh' : 'en'}`];
    const full = guide.modes.find(mode => mode.id === 'full');
    const quick = guide.modes.find(mode => mode.id === 'quick');
    const engine = `https://github.com/${guide.execution.engine_repository}/blob/${guide.execution.verified_runner_commit}`;
    const identities = [
      `standard_id: ${data.standard_id}`,
      `standard_sha256: ${digest}`,
      `standard_source: https://github.com/${source.repository}/blob/${source.commit}/${entry.benchmark_path}`,
      `run_guide_id: ${guide.guide_id}`,
      `run_guide_sha256: ${guideDigest}`,
      `run_guide_source: https://github.com/${guideSource.repository}/blob/${guideSource.commit}/${guideEntry.benchmark_path}`,
      `reference_runner_commit: ${guide.execution.verified_runner_commit}`,
      `reference_runner: ${engine}/one_click.py`,
      `deployment_instructions: ${engine}/README.md`,
      `public_bootstrap_source: https://github.com/${data.execution.public_bootstrap_repository}/blob/${data.execution.public_bootstrap_commit}/${data.execution.public_bootstrap_path}/engine_bootstrap.py`,
      `downloaded_script_sha256: ${bootstrap.sha256}`,
    ].join('\n');
    const scope = data.datasets.map(dataset => {
      const purpose = dataset.mode === 'inference_only'
        ? (zh ? '仅轨迹回放推理性能；不测任务解决率' : 'Trace inference only; no task solve rate')
        : (zh ? '质量与推理性能' : 'Quality and inference');
      const settings = [
        `max_output_tokens=${dataset.max_output_tokens}`, `concurrency=${dataset.concurrency}`,
        `temperature=${dataset.temperature}`, `seed=${dataset.seed}`,
      ];
      if (dataset.judge_max_tokens) settings.push(`judge_max_tokens=${dataset.judge_max_tokens}`);
      return [
        `${dataset.id} | ${dataset.name}`,
        zh ? `固定任务 ${dataset.tasks} / 源任务 ${dataset.source_tasks}；solver 请求 ${dataset.requests_per_arm} / 臂；${purpose}。`
          : `${dataset.tasks} fixed / ${dataset.source_tasks} source tasks; ${dataset.requests_per_arm} solver requests per arm; ${purpose}.`,
        field(dataset, 'selection'), settings.join(', '),
      ].join('\n');
    }).join('\n\n');
    const metrics = Object.entries(data.metrics).map(([name, definition]) => `${name}: ${definition}`).join('\n');
    const invariants = data.invariants.map((value, index) => `${index + 1}. ${value}`).join('\n');
    const estimates = [full, quick].map(mode => `${field(mode, 'title')}: ${mode.hours[0]}–${mode.hours[1]} ${zh ? '小时' : 'hours'}`).join('; ');

    if (zh) return `# 标准测试 AI 提示词

请作为测试执行负责人，在已授权的测试环境中，按照以下冻结协议完成可复核的标准测试。不要只给计划；具备条件后实际执行、核对原始证据并交付报告。缺少环境、权限或输入时，明确列出缺项与实际停止阶段，不得把准备、CPU 检查或历史成绩当作本轮实测。

## 1. 固定本次测试身份
${identities}

先读取上述固定版本的 README、执行器和协议。使用独立目录准备该版本，不覆盖其他工作或静默升级到最新 main。核对标准与运行指南的版本绑定、SHA256 和附件校验；加载失败或不匹配时停止，不凭记忆补写标准。每轮另记实际 B0/B1、执行提交、模型、硬件、judge 身份。协议冻结本身不是测试完成。

## 2. 先确认范围
默认执行完整五项测试。只有用户明确要求联调/快速检查时才选 MMLU200，并明确它不能替代五项完整验收。“全量”是项目冻结的五项范围，不是五个上游数据集的原始全集。
${field(guide, 'scope')}

${scope}

两臂都使用同一份冻结样本、顺序、提示词和生成预算。不得重新抽题、按结果筛选、换题、复制请求或自动重试来补齐。MMLU 保留原 200 题与顺序；HLE 四层和 Frontier 两轨分别报告。SWE/Terminal 只回放公开请求，不执行历史工具命令，不生成完成率或解决率。

## 3. 准备环境与参数
- 确认 Python 3.11+、两张可独占的 Ascend 910B2、同源 Qwen3.5-35B-A3B BF16 权重、CANN 9.1/ATB、固定 B1 Torch 2.13 SDK。B0 按固定镜像恢复，不混用宿主临时环境。
- 确认私有 Engine、固定附件及原始数据的读取权限；使用已有安全凭据方式，不输出凭据。公开协议不授予软件、数据或再分发权。
- 确认模型路径、固定 B1 SDK 的 Python 绝对路径、两个物理卡号和全新输出目录。核对物理卡映射；示例的 0,1 须替换为实际可用卡号。为模型、附件、缓存和结果预留空间，并满足执行器对输出卷至少 4 GiB 启动余量的检查。
- 第一次在本机执行须重新取得 C8 资格。只有同机同配置的有效封存证据通过执行器校验后，才可显式用 --continuous-evidence 复用，不默认跳过。
- trace 的 tokenizer、模板与 16K 输入资格已冻结；两臂 /tokenize 须逐项匹配冻结 token ID 哈希，使用新 cache_salt 与零 KV 复用。更换模型或 tokenizer 须另立 profile，不能静默重算后继续使用原标准名。

## 4. 执行测试
使用固定 Engine 的 one_click.py，或从执行指南右上角下载同版本公开引导脚本 one_click.py；后者会校验并恢复私有 Engine 工具。下载文件须与上面的 downloaded_script_sha256 一致。把脚本放在独立目录，在 one_click.py 所在目录先替换模型/SDK/结果路径与物理卡号，再运行：

${command(guide, full)}

仅在用户明确选择快速检查时使用：

${command(guide, quick)}

执行顺序：恢复并校验两侧 SDK → 冻结任务、源码、评分配置并写出 execution-checklist.json → 本机连续 4K/16K C8 资格 → 所选范围的 B0/B1 配对 → 共同 judge 评分（HLE/Frontier）→ 退出清理、释放设备、封存原始记录 → 复算并生成报告。
保留原 60 秒预热/300 秒正式窗口及所有冻结生成预算；不能把有限批次 P95/P99 当成连续长稳。不要用 --prepare-only、--smoke-evaluators 或 --hle-profile full1811 代替本次正式标准。其他引擎使用各自执行器，但不得改变冻结范围或比较口径。

排期参考：${estimates}。${field(guide.timing, 'reference')} ${field(guide.timing, 'includes')} ${field(guide.timing, 'excludes')} ${field(guide.timing, 'basis')}

## 5. 核对完成情况、评分与统计
先核对所选范围的两臂计划数、实际执行数、成功数、失败数、截断数、未决评分数与未完成数。失败、未返回、非法答案、length stop 和未决 judge 均保留计划分母。HLE 四层、Frontier 两轨单列；两臂使用同一个固定 judge，其流量不计 solver 吞吐与成本。
严格使用以下原协议定义（保留原文以供逐项核对）：
${metrics}

以下执行约束同样适用：
${invariants}

## 6. 分开判断“执行完整”和“目标达标”
按大纲逐项核对：3.4.1 单芯片有效算力；3.4.2 吞吐与时延；3.4.3 数据集与长上下文稳定性；3.4.4 单位 token 成本。质量评分、连续 4K/16K C8、费用适用范围和利用率证据均须保留。不能因为进程退出成功或五项跑完就宣布四项目标通过。
验收口径入口：https://vllm-hust.sage.org.ai/b0-b1.html 。核对其大纲与固定来源，明确本轮采用的阶段门槛；缺少可比依据时标为未验证，不自行猜测或更改门槛。同费率成本估算须写明报价、费用范围和测量区间，不称为本机账单，也不新增必须发票的要求。

## 7. 交付
交付执行命令、环境/模型/B0/B1/judge/源码身份、冻结清单与校验结果、原始 SSE 和时间戳、评分、设备采样、失败与未执行阶段、退出清理记录、校验清单，以及执行器生成的 HTML/图表/机器可读摘要。
最终答复逐项列出：测试范围；两臂计划/执行/成功/失败/截断/未决/未完成数；质量与吞吐/TTFT/TPOT；连续 C8 结论；费用依据；四项目标各自结论；证据位置与限制。失败时保留全部记录并报告实际非零退出，不能删失败、改预算、补造数据或把未测记为零。原始题目、答案和对话不随公开协议再分发。

执行指南：https://vllm-hust.sage.org.ai/dataset-standard.html
`;

    return `# AI prompt for standard testing

Act as the test execution lead in an authorized environment. Perform, verify and report the frozen standard below; do not stop at a plan when prerequisites are available. If access, inputs or runtime requirements are missing, name the missing items and actual stopping stage. Preparation, CPU checks and historical measurements are not new model measurements.

## 1. Pin the identities
${identities}

Read the pinned README, runner and protocols first. Prepare an isolated checkout; preserve unrelated work and do not silently upgrade to main. Verify version bindings, SHA256 and protocol artifacts before execution. Stop on any mismatch. Record actual B0/B1, execution commit, model, hardware and judge independently for each campaign.

## 2. Choose the scope
Run all five profiles by default. Use MMLU200 alone only when the user explicitly requests a quick integration check; it cannot replace full acceptance. Full means the project-frozen scope, not all upstream items.
${field(guide, 'scope')}

${scope}

Use identical frozen inputs, order, prompts and generation budgets for both arms. No resampling, outcome filtering, task replacement, duplication or automatic retries to fill results. Report HLE strata and Frontier tracks separately. SWE/Terminal measure trace inference only; execute no historical tools and report no solve or completion rate.

## 3. Prepare the environment
- Python 3.11+, two exclusive Ascend 910B2 cards, Qwen3.5-35B-A3B BF16 weights from the same source, CANN 9.1/ATB and the fixed B1 Torch 2.13 SDK. B0 restores its pinned image environment instead of temporary host packages.
- Verify private Engine, pinned asset and original data access. Use existing secure credentials without printing them. Public protocols grant no software, data or redistribution rights.
- Confirm the model path, absolute B1 SDK Python path, two physical device IDs and a fresh output directory. Replace example device IDs 0,1 with actual available IDs. Reserve space for weights, assets, caches and results; meet the runner's 4 GiB output-filesystem startup reserve.
- On a new host, rerun local C8. Reuse --continuous-evidence only when sealed evidence for the same host/configuration passes runner checks.
- Trace tokenizer, template and 16K eligibility are frozen. Both arms must match frozen token ID hashes via /tokenize. Use fresh cache_salt and zero KV reuse. A changed model/tokenizer requires a new profile.

## 4. Execute
Use the pinned Engine entrypoint, or download the matching public one_click.py bootstrap using the button at the top right of the execution guide. The bootstrap verifies and restores private Engine tools. Verify the downloaded file against downloaded_script_sha256 above. Save it in an isolated directory, replace model/SDK/output paths and device IDs, then run from the directory containing one_click.py:

${command(guide, full)}

Only for an explicitly requested quick check:

${command(guide, quick)}

Order: restore and verify SDKs → freeze tasks/source/graders and write execution-checklist.json → local continuous 4K/16K C8 qualification → selected B0/B1 profiles → shared HLE/Frontier judge → process cleanup, device release and raw-record sealing → recompute reports.
Preserve the original 60-second warmup/300-second measurement windows and all frozen generation budgets. Finite-batch P95/P99 do not establish continuous stability. --prepare-only, --smoke-evaluators and --hle-profile full1811 do not represent this formal scope. Other engines use their own runners with unchanged workload and comparison contracts.

Planning estimates: ${estimates}. ${field(guide.timing, 'reference')} ${field(guide.timing, 'includes')} ${field(guide.timing, 'excludes')} ${field(guide.timing, 'basis')}

## 5. Verify completion, grading and metrics
For both arms, reconcile planned, executed, successful, failed, truncated, unresolved and unfinished counts. Retain failures, missing responses, invalid answers, length stops and unresolved judges in planned denominators. Report all four HLE strata and both Frontier tracks. Use one identical frozen judge for both arms; exclude judge traffic from solver performance and cost.
Use the exact protocol definitions:
${metrics}

Execution invariants:
${invariants}

## 6. Separate execution completeness from target acceptance
Assess each outline target: 3.4.1 effective compute per chip; 3.4.2 throughput and latency; 3.4.3 dataset and long-context stability; 3.4.4 cost per token. Retain quality scores, continuous 4K/16K C8 evidence, pricing scope and utilization evidence. A successful process or all five profiles completing does not establish all four targets.
Acceptance entry: https://vllm-hust.sage.org.ai/b0-b1.html . Verify its outline and pinned sources; state the applicable milestone thresholds. Mark missing comparable evidence as unverified rather than inventing thresholds. Identify equal-rate cost estimates, quotation, cost scope and interval; do not call estimates a local invoice or impose a new invoice requirement.

## 7. Deliver
Provide commands, actual environment/model/B0/B1/judge/source identities, frozen manifests and checks, raw SSE/timestamps, grading, device samples, failed and unexecuted stages, cleanup records, checksums and runner-generated HTML/figures/machine-readable summaries.
In the final response, list scope; both arms' planned/executed/success/failure/truncation/unresolved/unfinished counts; quality, throughput, TTFT and TPOT; continuous C8 conclusion; cost basis; each target verdict; evidence locations and limitations. On failure retain all records and the actual nonzero exit. Never remove failures, shorten budgets, fabricate data or report unmeasured items as zero. Do not redistribute raw questions, answers or conversations.

Execution guide: https://vllm-hust.sage.org.ai/dataset-standard.html
`;
  }

  function scriptMatches() {
    return payload && payload.data.execution.public_bootstrap_repository === bootstrap.repository
      && payload.data.execution.public_bootstrap_commit === bootstrap.commit
      && `${payload.data.execution.public_bootstrap_path}/engine_bootstrap.py` === bootstrap.path
      && payload.data.execution.reference_implementation_commit === bootstrap.runner
      && payload.guide.execution.verified_runner_commit === bootstrap.runner;
  }

  function saveDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.append(link); link.click(); link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function render() {
    const c = copy[language()];
    button.textContent = c.button;
    button.title = payload ? c.ready : c.loading;
    button.disabled = !payload;
    scriptButton.textContent = c.script;
    scriptButton.disabled = !scriptMatches() || downloadingScript;
    scriptButton.title = !payload ? c.loading : scriptMatches() ? c.scriptReady : c.scriptMismatch;
    status.textContent = payload ? c.hint : c.loading;
  }
  button.addEventListener('click', () => {
    if (!payload) return;
    try {
      saveDownload(new Blob(['\uFEFF', buildPrompt()], {type: 'text/plain;charset=utf-8'}),
        `vllm-hust-${payload.data.standard_id}-ai-prompt-${language()}.txt`);
      status.textContent = copy[language()].done;
    } catch {
      status.textContent = copy[language()].failed;
    }
  });
  scriptButton.addEventListener('click', async () => {
    if (!scriptMatches() || downloadingScript) return;
    downloadingScript = true; scriptButton.disabled = true; status.textContent = copy[language()].scriptLoading;
    try {
      const response = await fetch('./downloads/standard-test/one_click.py', {cache: 'no-store'});
      if (!response.ok) throw new Error(`script HTTP ${response.status}`);
      const raw = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (raw.byteLength !== bootstrap.bytes || digest !== bootstrap.sha256) throw new Error('script checksum mismatch');
      saveDownload(new Blob([raw], {type: 'text/x-python;charset=utf-8'}), 'one_click.py');
      status.textContent = copy[language()].scriptDone;
    } catch {
      status.textContent = copy[language()].scriptFailed;
    } finally {
      downloadingScript = false; scriptButton.disabled = !scriptMatches();
    }
  });
  window.vllmHustTestPrompt = {
    setPayload(value) { payload = value; render(); },
    fail() { payload = undefined; render(); },
  };
  window.addEventListener('vllm-hust:langchange', render);
  render();
}());
