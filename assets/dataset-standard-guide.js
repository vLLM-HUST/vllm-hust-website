(function () {
  'use strict';
  let payload;
  let failure;
  const query = new URLSearchParams(location.search);
  let selectedMode = query.get('scope') === 'quick' ? 'quick' : 'full';
  let selectedTarget = query.get('target') === 'reference-engine' ? 'reference-engine' : 'mod';
  const language = () => (window.vllmHustSite?.getCurrentLang()
    || localStorage.getItem('vllm-hust_lang') || navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
  const node = (tag, value, className) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  const copy = {
    zh: {
      back: '← 返回测试数据集', eyebrow: '执行指南 / 固定协议 v1', title: '标准测试，按这四步完成',
      lead: 'B0 是对照配置，B1 是启用待测 MOD 的候选配置；用同一批输入比较质量和性能。',
      boundary: '完整测试覆盖项目冻结的五项范围；SWE / Terminal 仅测轨迹回放性能。跑完测试后，还须单独判断各项验收目标是否达标。',
      onThisPage: '按顺序执行', choose: '选择测试范围', prepare: '准备运行环境', run: '执行配对测试', review: '核对结果与交付',
      detailsNav: '协议细节与下载 ↓', sideNote: '第一次运行？从第 01 步开始。复核协议？直接看底部详情。',
      chooseLead: '联调选快速；正式完整测试选五项。两种模式都需要 B0 / B1。',
      timing: '预计耗时包含什么？', scopeTable: '查看五项任务数与请求数', tableCaption: '每臂 = B0 或 B1；每臂都使用同一份冻结清单。',
      dataset: '数据集', tasks: '固定任务 / 源任务', requests: '每臂请求', purpose: '测什么',
      prepareLead: '以下命令用于 vLLM-HUST Engine。先确认条件，再启动测试。',
      otherEngines: '其他引擎沿用同一冻结数据范围，使用各自执行器；模型或 tokenizer 改变时，trace 必须另立 profile。',
      engineDocs: '打开固定版本的部署与运行说明 ↗', runnerSource: '查看执行器源码 ↗',
      runLead: '使用 Engine 入口，或下载顶部的一键脚本，在 one_click.py 所在目录运行。先填写本机路径和卡号；输出目录必须全新。',
      modelPath: '模型目录', sdkPath: '固定 B1 SDK 的 Python', devices: '物理 NPU 卡号', outPath: '全新结果目录', copy: '复制命令',
      commandHint: '路径与卡号只在本页生成命令，网页不会启动测试。', copied: '命令已复制。请在运行前确认路径、卡号与环境。',
      copyFailed: '无法自动复制，请选中上方命令手动复制。', invalid: '请填写全部参数；物理卡号应为两个不同的非负整数，例如 0,1。',
      stopRule: '失败时保留原始记录与未执行阶段。不要删掉失败项、缩短输出预算或换题补跑来凑齐结果。',
      reviewLead: '先检查所选范围是否执行完整，再检查四项目标。两者分开记录。', deliveryTitle: '交付时带上这些证据',
      acceptanceLink: '查看 B0/B1 四项目标 →', referenceEyebrow: '需要复核时再展开', detailsTitle: '协议细节与下载',
      immutable: '样本、顺序、来源、预算、评分或 tokenizer 变化须发布新版本。冻结协议不代表实测已完成。',
      frozenRules: '各数据集的抽样与生成设置', metrics: '统计口径：吞吐、TTFT、TPOT 与质量', invariants: '执行约束与访问要求',
      downloads: '协议文件与 SHA256', downloadNote: '仅含任务身份与校验信息，不分发题目、答案或原始对话。使用原始数据须遵守来源授权。',
      fullProtocol: '完整协议说明', verifier: '离线校验脚本', verifyHint: '下载全部附件后，在协议文件所在目录执行。', provenance: '版本身份与固定来源',
      verified: '已校验 · 测试标准与运行指南来源一致', loading: '正在校验测试标准与运行指南…', error: '测试标准加载或校验失败，请稍后重试。',
      quickTag: '联调 / 单项检查', fullTag: '正式完整测试', estimate: '预计', hours: '小时',
      quality: '质量与推理性能', trace: '仅轨迹回放性能', planned: '计划 solver 请求 / 臂',
      pinnedSource: '固定标准来源', runGuide: '固定运行指南', generation: '生成参数', judge: '裁判输出上限', footer: '固定标准 · 执行步骤 · 可复核证据',
      preparations: [
        ['硬件与权重', '准备两张可独占的 Ascend 910B2、同源 Qwen3.5-35B-A3B BF16 权重；核对物理卡号。'],
        ['运行环境', '控制器使用 Python 3.11+；准备 CANN 9.1 / ATB 与固定 B1 Torch 2.13 SDK。B0 按固定镜像恢复，不混用宿主临时环境。'],
        ['来源访问', '确认可读取私有 Engine 与固定附件，并具备原始数据访问权。部署与依赖版本按下方固定说明配置。'],
        ['全新输出与本机资格', '预留模型、附件、缓存与结果空间；输出卷至少满足执行器 4 GiB 启动余量。首次在本机执行须重跑 C8，不借用历史资格。'],
      ],
      stages: [
        ['恢复与冻结', '校验两侧 SDK、任务、源码与评分配置，写出 execution-checklist.json。'],
        ['本机 C8 资格', '执行 4K / 16K 连续资格检查；资格通过后再进入配对测试。'],
        ['按所选范围配对', 'B0 / B1 使用相同输入、顺序与预算；HLE / Frontier 使用同一个固定 judge。'],
        ['封存与出报告', '清理进程、释放设备，保留原始流与失败记录，再复算和生成报告。'],
      ],
      reviews: [
        ['范围完整', '核对所选数据集的两臂计划数、实际执行数、成功数与未完成数。快速测试不能替代五项完整验收；--prepare-only 和 --smoke-evaluators 不算正式完成。'],
        ['质量与性能', '保留计划分母中的失败、未返回、截断与未决评分。HLE 四层、Frontier 两轨单列；judge 流量不计 solver 吞吐或费用。'],
        ['四项目标分别判断', '按大纲逐项核对单芯片有效算力、吞吐与时延、数据集与长上下文稳定性、单位 token 成本。另查连续 4K / 16K C8 证据；有限批次 P95 / P99 不证明连续长稳，同费率成本估算须写明费用依据。'],
      ],
      delivery: [
        '本轮身份：标准版本、实际执行提交、B0 / B1、模型、硬件与 judge 身份。',
        '原始证据：冻结清单、原始 SSE / 请求时间戳、评分、设备采样、失败及未执行阶段、校验清单。',
        '结果报告：执行清单、配对报告与图表；明确所选范围完成情况、四项目标结论及限制。',
      ],
      metricNames: {throughput: '吞吐', ttft: '首 token 时延（TTFT）', tpot: '逐 token 时延（TPOT）', percentiles: '分位数', quality: '质量', trace_quality: '轨迹任务质量'},
      metricText: {
        throughput: '有效生成输出 token 数 ÷ 整批 solver 墙钟时间（首个请求提交至最后响应完成）。不累加重叠请求的时长。',
        ttft: '逐请求：提交时刻至首个内容 token 事件。保留原始 SSE 与时间戳。',
        tpot: '逐请求：(响应完成时刻 − 首个内容 token 时刻) / (输出 token 数 − 1)。仅对输出多于 1 token 的请求定义；报告未定义数量，均值逐请求等权。',
        percentiles: '有限样本在 (n−1)×q 处线性插值，并报告样本数。有限批次不能证明连续 16K 的 P95 / P99 长稳。',
        quality: '使用未修改的原评分器与计划分母；HLE 各层、Frontier 各轨单列。错误、缺失、截断与未决 judge 保留。',
        trace_quality: '不测任务执行、完成率或解决率，不套用历史作者分数。',
      },
      invariantText: [
        '两臂使用完全相同的冻结任务、请求顺序、提示词与生成预算；不按成绩筛选、重试、补齐或换题。',
        '保留 EOS，不强制等长输出或静默改短预算。trace 保留原 history / tools，tool_choice=none，不执行历史命令。',
        'trace 使用全新 cache_salt、零 KV 复用；两臂 /tokenize 须逐项匹配冻结 token ID 哈希后才生成。',
        '历史轨迹时间戳仅作来源信息；并发 8 的闭环批次不是历史到达回放。',
        '协议、输入身份和实际执行身份分开记录；冻结计划或 CPU 检查不等于模型实验完成。',
        '质量子集不能证明总体等价、官方全集复刻或四项目标全部通过；连续 4K / 16K C8 与四项目标另行验收。',
      ],
      access: '参考 Engine 需私有仓库权限；公开协议不授予软件、数据或再分发权。每轮单独记录引擎、模型与硬件；trace 冻结于 Qwen3.5-35B-A3B BF16 tokenizer，变更须新建 profile。HLE / Frontier 两臂使用同一固定 judge，并记录其模型、运行时、提示词、解析器与预算。',
    },
    en: {
      back: '← Back to test datasets', eyebrow: 'EXECUTION GUIDE / FROZEN PROTOCOL v1', title: 'Run a standard test in four steps',
      lead: 'B0 is the control and B1 is the candidate configuration with the target MOD enabled. Compare quality and performance using the same inputs.',
      boundary: 'Full testing covers five project-frozen profiles. SWE / Terminal measure trace inference only. After execution, assess each acceptance target separately.',
      onThisPage: 'FOLLOW THE STEPS', choose: 'Choose a test scope', prepare: 'Prepare the environment', run: 'Run the paired test', review: 'Review and deliver',
      detailsNav: 'Protocol details & downloads ↓', sideNote: 'First run? Start at step 01. Auditing the protocol? Jump to the details below.',
      chooseLead: 'Use quick for integration checks; select all five for full testing. Both modes require B0 and B1.',
      timing: 'What does the time estimate include?', scopeTable: 'View tasks and requests for all five profiles', tableCaption: 'One arm = B0 or B1. Each arm uses the same frozen manifest.',
      dataset: 'Dataset', tasks: 'Fixed / source tasks', requests: 'Requests per arm', purpose: 'Scope',
      prepareLead: 'These commands use vLLM-HUST Engine. Check the prerequisites before starting.',
      otherEngines: 'Other engines use their own runners with the same frozen workload. A changed model or tokenizer requires a new trace profile.',
      engineDocs: 'Open pinned deployment and run instructions ↗', runnerSource: 'View runner source ↗',
      runLead: 'Use the Engine entrypoint or download the script above. Run from the directory containing one_click.py. Set local paths and device IDs; use a fresh output directory.',
      modelPath: 'Model directory', sdkPath: 'Fixed B1 SDK Python', devices: 'Physical NPU IDs', outPath: 'Fresh result directory', copy: 'Copy command',
      commandHint: 'Paths and device IDs only generate a command locally. This page does not start tests.', copied: 'Command copied. Verify paths, devices and environment before running.',
      copyFailed: 'Automatic copy failed. Select the command above and copy it manually.', invalid: 'Fill in all fields. Device IDs must be two distinct non-negative integers, for example 0,1.',
      stopRule: 'On failure, retain raw records and unexecuted stages. Do not remove failures, shorten generation budgets or replace tasks to fill the result.',
      reviewLead: 'Check execution completeness first, then assess the four targets. Record the two conclusions separately.', deliveryTitle: 'Include these in the handoff',
      acceptanceLink: 'View the four B0/B1 targets →', referenceEyebrow: 'EXPAND WHEN YOU NEED THE DETAILS', detailsTitle: 'Protocol details & downloads',
      immutable: 'Changes to samples, order, sources, budgets, grading or tokenizer require a new version. A frozen protocol is not a completed measurement.',
      frozenRules: 'Selection and generation settings by dataset', metrics: 'Metrics: throughput, TTFT, TPOT and quality', invariants: 'Execution constraints and access requirements',
      downloads: 'Protocol files and SHA256', downloadNote: 'Identity and integrity metadata only. No questions, answers or raw conversations are redistributed. Original source terms apply.',
      fullProtocol: 'Full protocol', verifier: 'Offline verifier', verifyHint: 'After downloading all artifacts, run in the protocol directory.', provenance: 'Version identity and pinned sources',
      verified: 'Verified · standard and run guide match their pinned sources', loading: 'Verifying the standard and run guide…', error: 'Unable to load or verify the test standard. Please try again.',
      quickTag: 'Integration / single-profile check', fullTag: 'Full standard test', estimate: 'About', hours: 'hours',
      quality: 'Quality + inference', trace: 'Trace inference only', planned: 'Planned solver requests / arm',
      pinnedSource: 'Pinned standard source', runGuide: 'Pinned run guide', generation: 'Generation', judge: 'Judge output limit', footer: 'Frozen protocol · Execution steps · Verifiable evidence',
      preparations: [
        ['Hardware and weights', 'Two exclusive Ascend 910B2 cards and Qwen3.5-35B-A3B BF16 weights from the same source. Verify physical device IDs.'],
        ['Runtime', 'Python 3.11+ controller, CANN 9.1 / ATB and the fixed B1 Torch 2.13 SDK. B0 restores its pinned image environment instead of reusing temporary host packages.'],
        ['Source access', 'Read access to the private Engine and pinned assets, plus access rights for the original datasets. Follow the pinned deployment instructions below.'],
        ['Fresh output and local qualification', 'Reserve space for weights, artifacts, caches and results. The output filesystem must meet the runner’s 4 GiB startup reserve. A first run on a new host must rerun C8.'],
      ],
      stages: [
        ['Restore and freeze', 'Verify both SDKs, tasks, source and graders; write execution-checklist.json.'],
        ['Qualify local C8', 'Run continuous 4K / 16K qualification before the paired workload.'],
        ['Run the selected profiles', 'Use identical inputs, order and budgets for B0 / B1. HLE / Frontier use one shared frozen judge.'],
        ['Seal and report', 'Clean up processes, release devices and retain raw streams and failures before recomputing reports.'],
      ],
      reviews: [
        ['Scope completeness', 'Compare planned, executed, successful and unfinished counts for both arms. Quick cannot replace five-profile acceptance. --prepare-only and --smoke-evaluators do not count as formal completion.'],
        ['Quality and performance', 'Keep failures, missing answers, truncations and unresolved grading in planned denominators. Report all four HLE strata and both Frontier tracks. Exclude judge traffic from solver throughput and cost.'],
        ['Assess the four targets separately', 'Check effective compute per chip, throughput and latency, dataset and long-context stability, and cost per token against the outline. Retain separate continuous 4K / 16K C8 evidence. Batch P95 / P99 do not establish continuous stability. Label equal-rate cost estimates and their pricing basis.'],
      ],
      delivery: [
        'Run identity: standard version, actual execution commit, B0 / B1, model, hardware and judge identity.',
        'Raw evidence: frozen manifests, SSE / request timestamps, grading, device samples, failed and unexecuted stages, integrity manifests.',
        'Reports: execution checklist, paired report and figures; state selected-scope completeness, each target conclusion and limitations.',
      ],
      metricNames: {throughput: 'Throughput', ttft: 'Time to first token (TTFT)', tpot: 'Time per output token (TPOT)', percentiles: 'Percentiles', quality: 'Quality', trace_quality: 'Trace task quality'},
    },
  };
  const modCopy = {
    zh: {
      targetTitle: '先选择要测什么', modTarget: '评估待测 MOD', modTargetNote: '默认：同一基础引擎，关闭 / 启用目标 MOD',
      engineTarget: '复跑参考 Engine', engineTargetNote: '可选：已冻结的 vLLM-HUST Engine 组合',
      armDefinitions: '本页 MOD 对比默认 B0 = 同一基础配置关闭目标 MOD，B1 = 启用待测 MOD。每轮冻结实际版本与开关，不把 B1 固定为某个 Engine。',
      prepareLead: '先固定本轮的基础引擎、目标 MOD 与对照方式，再准备同一冻结数据范围。',
      otherEngines: '先核对基础引擎是否已默认具备目标能力。保留共同基线的现有优化；以实际启用记录和受益条件解释 MOD 增量效果。',
      runLead: '使用项目实际执行器跑 B0 / B1。可填写下方信息，让 AI 按实际仓库完成接入、运行和报告。',
      modRepo: 'MOD 仓库或本地路径', modRevision: 'MOD 提交或版本', baseRuntime: '基础引擎与版本', modActivation: 'MOD 启用与关闭方式',
      modParameterHint: '可先填写项目信息，再下载 AI 提示词；填写内容仅用于本地生成文件。', downloadModPrompt: '下载待测 MOD 测试提示词 ↓',
      modRunnerBoundary: '接入项目中实际可用的测试执行器，核对安装、启用 / 关闭、推理与评分接口。顶部参考 Engine 脚本只复跑固定组合，不会自动装载任意 MOD；不能只改一个 B1 名称就声称完成接入。',
      reviewLead: '先确认所选范围执行完整，再判断本轮 MOD 收益。项目四项目标按各自基线和门槛另行核对。',
      preparations: [
        ['冻结 B0 / B1', '默认使用同一基础引擎、提交和配置：B0 关闭目标 MOD，B1 启用待测 MOD。如课题指定其他基线，另记其定义与差异，不能把多项变化都归因于一个 MOD。'],
        ['固定可比条件', '固定模型权重、tokenizer、硬件、设备数、并行方式、输入、顺序、并发、生成预算与评分器。MOD 必需的配置变化须披露；trace 换模型或 tokenizer 须另立 profile。'],
        ['核验实际启用', '记录 MOD 仓库与提交、安装/构建方式、启停开关、依赖和运行时日志，确认候选确实调用目标机制。仅安装成功或参数存在不能证明已生效。'],
        ['准备设备与证据', '按所选引擎和 MOD 准备依赖、数据访问权、设备与结果空间。两臂使用独立输出和缓存；连续 4K / 16K C8 资格与清理回执单列，参考 Engine 的 SDK 不是通用前提。'],
      ],
      stages: [
        ['核验接入并冻结计划', '读取 MOD 与基础引擎的实际文档和执行器；冻结样本、参数、B0/B1 身份、启停方式和评分配置。'],
        ['分别取得运行资格', '确认两臂的运行时、资源、输入身份和目标 MOD 状态；按协议保留连续 4K / 16K C8 证据。'],
        ['执行同范围配对', '按相同样本与预算测 B0 / B1；HLE / Frontier 共用固定 judge。保留全部计划项和原始流，记录 MOD 触发与额外开销。'],
        ['复算 MOD 收益', '封存与清理后，从本轮两臂证据复算质量、吞吐、TTFT、TPOT、长稳与成本，报告正收益、负收益和适用条件。'],
      ],
      delivery: [
        '身份与差异：基础引擎、B0/B1、MOD 仓库/提交、启停命令、实际激活证据、模型、硬件与 judge。',
        '原始证据：冻结清单、SSE / 时间戳、评分、设备采样、失败/未执行阶段、清理与校验清单。',
        '收益报告：本轮 MOD 对比的质量、性能、长稳和成本、额外开销、适用与失效条件；项目验收结论另列。',
      ],
    },
    en: {
      targetTitle: 'Choose what to evaluate', modTarget: 'Evaluate the target MOD', modTargetNote: 'Default: the same base engine with the target MOD off / on',
      engineTarget: 'Reproduce the reference Engine', engineTargetNote: 'Optional: the frozen vLLM-HUST Engine combination',
      armDefinitions: 'For this MOD comparison, B0 defaults to the same base configuration with the target MOD off; B1 enables the target MOD. Freeze actual versions and switches for each run. B1 is not a fixed Engine product.',
      prepareLead: 'Define the base engine, target MOD and control before preparing the frozen workload.',
      otherEngines: 'Check whether the base engine already provides the target capability. Preserve its existing optimizations and explain incremental MOD effects using activation evidence and applicable conditions.',
      runLead: 'Use the project runner for B0 / B1. Fill in the project details below so the AI can inspect the repository, integrate, execute and report.',
      modRepo: 'MOD repository or local path', modRevision: 'MOD commit or version', baseRuntime: 'Base engine and version', modActivation: 'MOD enable / disable method',
      modParameterHint: 'Optionally fill in project details before downloading the prompt. Values are used locally to generate the file.', downloadModPrompt: 'Download the target MOD test prompt ↓',
      modRunnerBoundary: 'Integrate the actual installation, enable/disable, inference and grading interfaces of the project runner. The reference Engine script reproduces a fixed combination; it does not load arbitrary MODs. Renaming B1 alone does not establish integration.',
      reviewLead: 'Check execution completeness, then assess this MOD comparison. Evaluate the four project targets separately against their own baseline contracts and thresholds.',
      preparations: [
        ['Freeze B0 / B1', 'By default use the same base engine commit and configuration: target MOD off in B0 and on in B1. Document a project-mandated alternative baseline and all differences. Do not attribute multiple changes to one MOD.'],
        ['Control comparison conditions', 'Fix weights, tokenizer, hardware, device count, parallelism, inputs/order, concurrency, budgets and graders. Disclose required MOD configuration changes. A changed trace model/tokenizer requires a new profile.'],
        ['Verify activation', 'Record MOD repository/commit, installation/build, switches, dependencies and runtime logs showing that the mechanism ran. Installation or a parameter alone does not prove activation.'],
        ['Prepare devices and evidence', 'Use dependencies and source access required by the selected engine/MOD. Keep separate outputs/caches for both arms, continuous 4K/16K C8 evidence and cleanup receipts. The reference Engine SDK is not a universal prerequisite.'],
      ],
      stages: [
        ['Inspect integration and freeze the plan', 'Read actual MOD/base-engine docs and runners; freeze samples, parameters, B0/B1 identities, activation and grading.'],
        ['Qualify each arm', 'Verify runtime, resources, input identities and target MOD state; retain continuous 4K/16K C8 evidence under the protocol.'],
        ['Run the same paired scope', 'Use identical samples and budgets. HLE/Frontier share one frozen judge. Retain planned items/raw streams and record mechanism activation and overhead.'],
        ['Recompute MOD effects', 'After sealing and cleanup, compute quality, throughput, TTFT, TPOT, stability and cost from this pair. Report gains, regressions and applicable conditions.'],
      ],
      delivery: [
        'Identities and differences: base engine, B0/B1, MOD repository/commit, activation commands and evidence, model, hardware and judge.',
        'Raw evidence: frozen manifests, SSE/timestamps, grading, device samples, failed/unexecuted stages, cleanup and checksums.',
        'MOD report: paired quality, performance, stability, cost, overhead and applicable/failure conditions. Keep project acceptance separate.',
      ],
    },
  };
  const labels = () => copy[language()];
  const field = (object, name) => object[`${name}_${language()}`];
  const shellQuote = value => /^[a-zA-Z0-9_./,:=-]+$/.test(value) ? value : "'" + value.replace(/'/g, "'\\''") + "'";

  function updateCommand() {
    if (!payload) return;
    const mode = payload.guide.modes.find(item => item.id === selectedMode);
    document.getElementById('selected-mode-label').textContent = `${field(mode, 'title')} · B0 / B1`;
    document.querySelectorAll('[name="test-scope"]').forEach(input => {
      input.checked = input.value === selectedMode;
      input.closest('.test-mode').classList.toggle('selected', input.checked);
    });
    const form = document.getElementById('run-parameters');
    const values = Object.fromEntries(new FormData(form));
    const ids = values.devices.split(',').map(id => id.trim());
    const valid = Object.values(values).every(value => value.trim() && !/[\r\n\0]/.test(value))
      && ids.length === 2 && ids.every(id => /^\d+$/.test(id)) && Number(ids[0]) !== Number(ids[1]);
    document.getElementById('copy-run-command').disabled = !valid;
    const feedback = document.getElementById('command-feedback');
    feedback.textContent = valid ? labels().commandHint : labels().invalid;
    if (!valid) {
      document.getElementById('run-command').textContent = '';
      return;
    }
    const quote = name => shellQuote(values[name].trim());
    const continuation = ' \\\n  ';
    const substitutions = {
      '/path/to/model': quote('model'), '/path/to/new-results': quote('out'),
      '{datasets}': mode.datasets_flag, '{sdk}': quote('sdk'), '{devices}': ids.join(','),
    };
    const command = payload.guide.execution.command_template
      .replace(/ --/g, `${continuation}--`)
      .replace('--datasets', () => `--b1-python {sdk}${continuation}--physical-devices {devices}${continuation}--datasets`)
      .replace(/\/path\/to\/model|\/path\/to\/new-results|\{datasets\}|\{sdk\}|\{devices\}/g, token => substitutions[token]);
    document.getElementById('run-command').textContent = command;
  }

  function pairList(id, items) {
    const container = document.getElementById(id);
    container.replaceChildren();
    for (const [title, detail] of items) {
      const row = node(id === 'review-list' ? 'article' : 'li');
      row.append(node(id === 'review-list' ? 'h3' : 'strong', title), node('p', detail));
      container.append(row);
    }
  }

  function render() {
    const lang = language();
    const c = {...labels(), ...(selectedTarget === 'mod' ? modCopy[lang] : {})};
    if (selectedTarget === 'reference-engine') c.armDefinitions = lang === 'zh'
      ? '参考复跑使用已冻结的 B0 / B1 组合；此路径不注入待测 MOD，模型、硬件与 SDK 按参考文档准备。'
      : 'Reference reproduction uses the frozen B0 / B1 combination. It does not inject the target MOD; prepare the model, hardware and SDK specified by the reference documentation.';
    document.querySelectorAll('[data-guide-copy]').forEach(element => {
      const value = c[element.dataset.guideCopy] ?? modCopy[lang][element.dataset.guideCopy];
      if (value !== undefined) element.textContent = value;
    });
    document.querySelector('[data-guide-nav]').setAttribute('aria-label', c.onThisPage);
    document.getElementById('test-mode-cards').setAttribute('aria-label', c.choose);
    document.title = `${lang === 'zh' ? '标准测试执行指南' : 'Standard test guide'} · vLLM-HUST`;
    document.getElementById('footer-copy').textContent = c.footer;
    const status = document.getElementById('standard-status');
    status.textContent = failure ? c.error : payload ? c.verified : c.loading;
    if (!payload || failure) return;
    const {data, guide, source, entry, digest, guideSource, guideEntry, guideDigest} = payload;
    const cards = document.getElementById('test-mode-cards'); cards.replaceChildren();
    for (const mode of guide.modes) {
      const card = node('label', undefined, `test-mode${mode.id === selectedMode ? ' selected' : ''}`);
      card.id = `test-mode-${mode.id}`;
      const top = node('span', undefined, 'mode-top');
      const input = node('input'); input.type = 'radio'; input.name = 'test-scope'; input.value = mode.id; input.checked = mode.id === selectedMode;
      input.addEventListener('change', () => { selectedMode = mode.id; updateCommand(); });
      top.append(node('span', mode.id === 'full' ? c.fullTag : c.quickTag), input);
      card.append(top, node('strong', field(mode, 'title'), 'mode-title'),
        node('span', `${lang === 'zh' ? '参考组合约' : 'Reference setup: about'} ${mode.hours[0]}–${mode.hours[1]} ${c.hours}`, 'duration'),
        node('span', field(mode, 'scope'), 'mode-scope'));
      const requests = mode.datasets.reduce((sum, id) => sum + data.datasets.find(item => item.id === id).requests_per_arm, 0);
      card.append(node('span', `${c.planned} · ${requests}`, 'mode-requests'));
      cards.append(card);
    }
    document.getElementById('test-mode-scope').textContent = field(guide, 'scope');
    const notes = document.getElementById('test-mode-notes'); notes.replaceChildren();
    for (const key of ['reference', 'includes', 'excludes', 'basis', 'qualified']) notes.append(node('p', field(guide.timing, key)));
    for (const key of ['note', 'acceptance']) notes.append(node('p', field(guide.execution, key)));
    const guideLink = node('a', c.runGuide);
    guideLink.href = `https://github.com/${guideSource.repository}/blob/${guideSource.commit}/${guideEntry.benchmark_path}`;
    document.getElementById('test-mode-provenance').replaceChildren(guideLink, node('code', `SHA256 ${guideDigest}`));
    const engineBase = `https://github.com/${guide.execution.engine_repository}/blob/${guide.execution.verified_runner_commit}`;
    document.getElementById('engine-instructions').href = `${engineBase}/README.md`;
    document.getElementById('runner-source').href = `${engineBase}/one_click.py`;
    document.getElementById('mod-run').hidden = selectedTarget !== 'mod';
    document.getElementById('reference-run').hidden = selectedTarget !== 'reference-engine';
    document.getElementById('reference-engine-links').hidden = selectedTarget !== 'reference-engine';
    document.querySelectorAll('[name="test-target"]').forEach(input => { input.checked = input.value === selectedTarget; });
    window.vllmHustTestPrompt.setTarget(selectedTarget);
    pairList('preparation-list', c.preparations);
    pairList('execution-stages', c.stages);
    pairList('review-list', c.reviews);
    document.getElementById('delivery-list').replaceChildren(...c.delivery.map(value => node('li', value)));
    const rows = document.getElementById('standard-rows'); rows.replaceChildren();
    const rules = document.getElementById('dataset-rules'); rules.replaceChildren();
    for (const dataset of data.datasets) {
      const row = node('tr');
      for (const value of [dataset.name.replace(/ public traces$/, ''), `${dataset.tasks} / ${dataset.source_tasks}`, dataset.requests_per_arm, dataset.mode === 'inference_only' ? c.trace : c.quality]) row.append(node('td', String(value)));
      rows.append(row);
      const rule = node('article', undefined, 'dataset-rule');
      rule.append(node('h3', dataset.name.replace(/ public traces$/, '')), node('p', field(dataset, 'selection')));
      const setting = node('p', undefined, 'generation-settings');
      for (const value of [`max_output_tokens=${dataset.max_output_tokens}`, `concurrency=${dataset.concurrency}`, `temperature=${dataset.temperature}`, `seed=${dataset.seed}`]) setting.append(node('code', value));
      if (dataset.judge_max_tokens) setting.append(node('code', `${c.judge}=${dataset.judge_max_tokens}`));
      rule.append(setting);
      const link = node('a', dataset.protocol); link.href = `./data/dataset-standard-v1/${dataset.protocol}`; rule.append(link);
      rules.append(rule);
    }
    const metrics = document.getElementById('standard-metrics'); metrics.replaceChildren();
    for (const [name, value] of Object.entries(data.metrics)) metrics.append(node('dt', c.metricNames[name] || name), node('dd', lang === 'zh' ? c.metricText[name] || value : value));
    const invariants = lang === 'zh' ? c.invariantText : data.invariants;
    document.getElementById('standard-invariants').replaceChildren(...invariants.map(value => node('li', value)));
    document.getElementById('standard-access').textContent = lang === 'zh' ? c.access
      : [data.execution.access, data.execution.engine_binding, data.execution.trace_model_binding, data.execution.judge].join(' ');
    const files = document.getElementById('standard-files'); files.replaceChildren();
    for (const [name, artifact] of Object.entries(data.artifacts)) {
      const link = node('a', name); link.href = `./data/dataset-standard-v1/${name}`; link.download = name;
      const item = node('li'); item.append(link, node('code', `${artifact.bytes} bytes · SHA256 ${artifact.sha256}`)); files.append(item);
    }
    document.getElementById('standard-title').textContent = data.standard_id;
    const original = node('a', c.pinnedSource); original.href = `https://github.com/${source.repository}/blob/${source.commit}/${entry.benchmark_path}`;
    document.getElementById('standard-provenance').replaceChildren(original, node('p', `${source.repository} @ ${source.commit}`), node('code', `SHA256 ${digest}`));
    updateCommand();
    document.getElementById('standard-content').hidden = false;
  }

  document.querySelectorAll('[name="test-target"]').forEach(input => input.addEventListener('change', () => {
    selectedTarget = input.value; render();
  }));
  document.getElementById('mod-parameters').addEventListener('submit', event => event.preventDefault());
  document.getElementById('download-mod-prompt').addEventListener('click', () => document.getElementById('download-test-prompt').click());
  document.getElementById('run-parameters').addEventListener('submit', event => event.preventDefault());
  document.getElementById('run-parameters').addEventListener('input', updateCommand);
  document.getElementById('copy-run-command').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById('run-command').textContent);
      document.getElementById('command-feedback').textContent = labels().copied;
    } catch {
      const code = document.getElementById('run-command');
      const range = document.createRange(); range.selectNodeContents(code);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.getElementById('command-feedback').textContent = labels().copyFailed;
    }
  });
  window.vllmHustStandardGuide = {
    render(data) { payload = data; failure = undefined; render(); },
    fail(error) {
      failure = error;
      document.getElementById('standard-content').hidden = true;
      const status = document.getElementById('standard-status'); status.setAttribute('role', 'alert'); status.dataset.error = error.message;
      render();
    },
  };
  window.addEventListener('vllm-hust:langchange', render);
  render();
}());
