/* Download an execution prompt only after both frozen inputs pass verification. */
(function () {
  'use strict';
  let payload;
  let testTarget = 'mod';
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
    zh: {button: '下载 AI 测试提示词 ↓', ready: '下载 TXT，含完整执行步骤与固定协议身份', loading: '标准与运行指南校验通过后可下载', done: '已生成 TXT 下载', failed: '下载失败，请重试', script: '参考 Engine 一键脚本 ↓', scriptReady: '仅复跑固定 vLLM-HUST Engine 组合，不能自动接入自有 MOD', scriptMismatch: '脚本与当前协议版本不匹配，暂不可下载', scriptLoading: '正在校验脚本…', scriptDone: '已生成 one_click.py 下载；请按指南配置本机参数', scriptFailed: '脚本下载或校验失败，请重试', hint: '默认测自己的 MOD；脚本仅用于参考 Engine'},
    en: {button: 'Download AI test prompt ↓', ready: 'Download TXT with execution steps and pinned protocol identities', loading: 'Available after standard and run-guide verification', done: 'TXT download generated', failed: 'Download failed. Please try again.', script: 'Reference Engine script ↓', scriptReady: 'Reproduces the fixed vLLM-HUST Engine only; does not integrate arbitrary MODs', scriptMismatch: 'Script version does not match the current protocol', scriptLoading: 'Verifying the script…', scriptDone: 'one_click.py download generated; configure local parameters using the guide', scriptFailed: 'Script download or verification failed. Please retry.', hint: 'Own MOD by default; script is for the reference Engine'},
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
    const selectedScope = document.querySelector('[name="test-scope"]:checked')?.value || 'full';
    const selected = guide.modes.find(mode => mode.id === selectedScope) || full;
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

    if (testTarget === 'mod') {
      const form = document.getElementById('mod-parameters');
      const configuration = form ? Object.fromEntries(new FormData(form)) : {};
      const project = JSON.stringify(Object.fromEntries(['mod_repository', 'mod_revision', 'base_runtime', 'mod_activation']
        .map(key => [key, configuration[key]?.trim() || (zh ? '待核对' : 'To be confirmed')])), null, 2);
      if (zh) return `# 标准测试 AI 提示词：评估自己的 MOD

test_target: own_mod
selected_scope: ${selected.id}
selected_profiles: ${selected.datasets_flag}

请在已授权环境中评估我的 MOD。先读取实际 MOD 仓库、基础引擎文档与已有测试执行器，核对接入方式，具备条件后实际执行并交付可复核报告。缺少仓库/提交、环境或输入时先核对缺项；未执行、准备通过和历史成绩分别记录。

## 1. 先定义 B0 / B1，而不是指定某个 Engine
B0 默认是同一基础引擎、提交与配置关闭目标 MOD；B1 是该基础配置启用我开发的 MOD。B1 不默认等于 vllm-hust-engine。保留基础引擎已经默认提供的优化，不能人为削弱共同基线；课题另有基线约定时须先明确其身份及本轮适用范围。
以下是用户填写的项目信息，需到仓库核对：
${project}

冻结 MOD 仓库/提交、基础引擎与依赖、安装/构建步骤、启用与关闭命令、两臂实际启动命令和参数差异。核验 MOD 实际加载、调用与触发证据；参数存在、安装成功或 HTTP 成功不等于机制生效。需同时修改其他配置时披露全部变化，不能把组合变化的效果都归因于单一 MOD。

## 2. 沿用冻结工作负载
${identities}

以上 reference_runner 与公开 bootstrap 是可选参考实现的身份，不定义本轮 B1，也不是必须安装的运行环境。默认不要恢复固定 Engine 替换我的 MOD，不给既有参考脚本添加其不支持的通用 MOD 参数。通用自有 MOD 接入必须按实际执行器实现；未接入不得宣称已支持。
核对标准、指南与附件的版本和 SHA256。本次执行 ${field(selected, 'title')}（${selected.datasets_flag}）；快速检查不能替代五项验收。
${field(guide, 'scope')}

${scope}

## 3. 固定可比条件
两臂使用相同模型权重、tokenizer/模板、硬件与设备数、并行方式、任务/顺序/提示词、并发、生成预算、EOS、评分器及测量区间。保持共同基线优化，记录必须的 MOD 适配差异与额外开销。根据本轮实际引擎准备依赖、设备与数据访问权；不把参考 Engine 的私有源码、固定 SDK 或双卡环境列为所有 MOD 的通用前提。
trace 仍受本标准 Qwen3.5-35B-A3B BF16 tokenizer 与 16K 输入资格绑定；换模型/tokenizer 须新建 profile，不在原标准下静默重算。两臂匹配冻结 token ID 哈希，使用新 cache_salt 与零 KV 复用；不执行历史工具命令。
参考指南的耗时只对应其固定 Engine/模型/硬件；为自己的 MOD 重新排期，不承诺同样时长。

## 4. 接入实际执行器并运行
先找到项目实际支持的输入格式、服务/推理入口、MOD 开关和原始评分器，将冻结清单逐项绑定到实际请求；给出可在当前环境执行的两臂命令，不能杜撰通用 --mod 参数或把改名当成接入。
运行前封存本轮执行计划和参数差异；核验两臂运行资格及输入身份，按协议保留连续 4K/16K C8 证据（原 60 秒预热/300 秒正式窗口）；以相同范围、预算和评分器完成配对。HLE/Frontier 两臂使用同一固定 judge，judge 流量不计 solver 吞吐或成本。两臂输出目录和缓存隔离，使用可比的资源/冷暖条件，保留设备采样与 MOD 实际激活记录。
完整测试范围标识为 mmlu,hle,frontier,swe,terminal；快速检查为 mmlu。这是范围标识，不代表任何自定义执行器已经支持这些 CLI 参数。--prepare-only、诊断小样本和缺失阶段不能算正式完成。
失败保留原始记录、计划分母与未执行阶段，不暗中缩短预算、补造请求、换题或反复挑最好一轮。结束时清理自己的进程并释放设备。

## 5. 核对质量与性能，报告收益和回退
用独立题目答案和原任务评分器判断质量；生成 token 不同本身不能证明质量下降，token 相同也不能证明答案正确。数值/状态错误与重复性诊断另列，不能默认要求跨配置逐 token 一致。报告配对样本量、截断/无法解析/未决比例及不确定性，不把“不显著”写成“等价”。
保留失败、缺失、length stop 与未决 judge 的计划分母，HLE 四层与 Frontier 两轨单列。SWE/Terminal 只报告轨迹推理性能，不给任务解决率。
严格采用原协议统计定义：
${metrics}

原协议执行约束：
${invariants}

从本轮配对计算吞吐变化 (B1/B0−1)、TTFT/TPOT 改善 (1−B1/B0) 与可比成本变化，说明单位和费用范围，保留负收益。单列初始化/编译/准备成本、主机与设备内存、适用和失效条件，不把有利前置条件当成免费收益。未测或不可比项标为未验证，不能记零。

## 6. 交付证据与结论
交付本轮 B0/B1 定义与实际命令、MOD/基础引擎/依赖提交、配置差异、启用证据、模型/硬件/judge 身份、冻结输入与校验、原始 SSE/时间戳、评分、设备采样、清理、失败和未执行阶段，以及可复算报告。
逐项列出所选范围和两臂计划/实际/成功/失败/截断/未决/未完成数；质量、吞吐、TTFT/TPOT、连续 C8、成本与额外开销；MOD 收益/回退及条件。不能借参考 Engine 的历史成绩证明我的 MOD 达标。
MOD 机制收益和项目四项目标验收分开。若同时申请项目验收，按相应大纲核对 3.4.1 有效算力、3.4.2 吞吐与时延、3.4.3 数据集与长稳、3.4.4 成本的正式基线、门槛与适用条件，未测项明确保留。
执行指南：https://vllm-hust.sage.org.ai/dataset-standard.html
项目验收入口：https://vllm-hust.sage.org.ai/b0-b1.html
`;
      return `# AI prompt for standard testing: evaluate my MOD

test_target: own_mod
selected_scope: ${selected.id}
selected_profiles: ${selected.datasets_flag}

Evaluate my MOD in an authorized environment. Read the actual MOD repository, base-engine documentation and existing test runner, establish integration, execute when prerequisites are available and deliver reproducible evidence. Identify missing repository/commit, inputs or runtime facts first. Keep unexecuted stages, preparation checks and historical measurements distinct.

## 1. Define B0 / B1 for this comparison
B0 defaults to the same base engine commit/configuration with the target MOD off; B1 enables my MOD in that configuration. B1 does not default to vllm-hust-engine. Preserve optimizations already enabled in the base engine rather than weakening the control. Document any project-mandated alternative baseline and its applicability.
User-supplied project details to verify in the repository:
${project}

Freeze MOD/base-engine/dependency commits, installation/build instructions, enable/disable commands, actual launch commands and configuration differences. Verify runtime loading, calls and activation. A parameter, installation or HTTP success does not prove that the mechanism ran. Disclose required additional changes instead of attributing a combined intervention to one MOD.

## 2. Reuse the frozen workload
${identities}

reference_runner and bootstrap identities describe an optional reference implementation, not the required B1 or runtime. Do not restore that fixed Engine in place of my MOD, invent unsupported generic MOD flags for it, or claim integration merely by renaming B1. Integrate my actual runner before claiming support.
Verify standard/guide/artifact versions and SHA256. Run the selected ${field(selected, 'title')} scope (${selected.datasets_flag}); quick cannot replace five-profile acceptance.
${field(guide, 'scope')}

${scope}

## 3. Control comparability
Fix weights, tokenizer/template, hardware/device count, parallelism, tasks/order/prompts, concurrency, generation budgets, EOS, graders and measurement intervals. Preserve base-engine optimizations and disclose necessary MOD adaptations and overhead. Use dependencies, device resources and data access appropriate to the actual engine; the reference Engine's private source, fixed SDK and two-card setup are not universal MOD prerequisites.
Trace inputs remain bound to the frozen Qwen3.5-35B-A3B BF16 tokenizer and 16K eligibility. A changed model/tokenizer requires a new profile. Match frozen input token hashes, use fresh cache_salt and zero KV reuse; execute no historical tools. Re-estimate timing for the actual MOD/runtime instead of applying reference Engine estimates as guarantees.

## 4. Integrate and run the actual executor
Inspect actual input formats, inference/service entrypoints, MOD switches and original graders. Bind frozen items to requests and produce commands supported by that project. Do not invent a universal --mod argument or treat renaming as integration.
Seal the plan and differences before running. Qualify both arms and retain continuous 4K/16K C8 evidence with the original 60-second warmup/300-second measurement windows. Use the same scope, budgets and graders; HLE/Frontier share a fixed judge whose traffic is excluded from solver throughput/cost. Isolate outputs/caches, match resource and cold/warm conditions, retain device samples and MOD activation evidence.
Scope identifiers are mmlu,hle,frontier,swe,terminal for full and mmlu for quick; these identifiers do not imply an arbitrary runner accepts corresponding CLI flags. Preparation-only, diagnostic samples and missing stages are not formal completion.
Preserve failures and planned denominators. No hidden budget reduction, fabricated requests, replacement tasks or best-of retries. Clean up owned processes and release devices.

## 5. Assess independent quality and paired effects
Use independent task answers and unchanged graders for quality. Different generated tokens alone do not prove quality loss, and identical tokens do not prove correctness. Separate numerical/state faults and repeatability diagnostics; do not impose cross-configuration token equality by default. Report paired sample sizes, truncation/unparsed/unresolved rates and uncertainty; non-significance is not equivalence.
Retain failures, missing responses, length stops and unresolved judges in planned denominators. Report four HLE strata and both Frontier tracks. SWE/Terminal measure inference only, with no solve rate.
Exact metrics:
${metrics}

Execution invariants:
${invariants}

From this pair compute throughput change (B1/B0−1), TTFT/TPOT improvement (1−B1/B0) and comparable cost changes, with units and pricing scope. Preserve regressions. Report startup/compile/preparation overhead, host/device memory and applicable/failure conditions; favorable prerequisites are not free gains. Mark unmeasured or incomparable items unverified rather than zero.

## 6. Deliver
Provide actual B0/B1 definitions and commands, MOD/base-engine/dependency commits, differences, activation evidence, model/hardware/judge identities, frozen inputs/checks, raw SSE/timestamps, grading, device samples, cleanup, failed/unexecuted stages and recomputable reports.
List selected scope and both arms' planned/executed/success/failure/truncation/unresolved/unfinished counts; quality, throughput, TTFT/TPOT, C8, costs and overhead; MOD gains/regressions and conditions. Do not use historical reference Engine measurements to certify my MOD.
Keep mechanism effects separate from project acceptance. If project acceptance is requested, verify the formal baseline, thresholds and applicability for 3.4.1 compute, 3.4.2 throughput/latency, 3.4.3 datasets/stability and 3.4.4 cost. Retain unmeasured targets.
Guide: https://vllm-hust.sage.org.ai/dataset-standard.html
Project targets: https://vllm-hust.sage.org.ai/b0-b1.html
`;
    }

    if (zh) return `# 标准测试 AI 提示词：复跑固定参考 Engine

test_target: reference-engine

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

    return `# AI prompt for standard testing: reproduce the fixed reference Engine

test_target: reference-engine

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
    button.textContent = testTarget === 'mod' ? (language() === 'zh' ? '下载 MOD 测试提示词 ↓' : 'Download MOD test prompt ↓') : c.button;
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
        `vllm-hust-${payload.data.standard_id}-${testTarget}-ai-prompt-${language()}.txt`);
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
    setTarget(value) { testTarget = value === 'reference-engine' ? value : 'mod'; render(); },
    setPayload(value) { payload = value; render(); },
    fail() { payload = undefined; render(); },
  };
  window.addEventListener('vllm-hust:langchange', render);
  render();
}());
