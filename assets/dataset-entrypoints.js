(function () {
  'use strict';
  const REV = '07628b9b5b32d0de37dd3b6fa3bc48d350d8ed71'; // pragma: allowlist secret - public source revision
  const BASE = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${REV}/`;
  const AGENT_REV = '0531845b8b20b0c91acffd253ed3234ad38a692d'; // pragma: allowlist secret - reviewed public source revision // pragma: allowlist secret
  const AGENT_BASE = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${AGENT_REV}/`;
  const OPS = 'https://github.com/yancanmao/npu-private-cloud-ops-skill/blob/02b8fea242d5fcf49e43344b2a6c0db4e03418d2/'; // pragma: allowlist secret - reviewed public skill revision
  let catalog;
  let terminalEvidence;
  let terminalSource;
  let lang = localStorage.getItem('vllm-hust_lang') === 'zh' ? 'zh' : 'en';
  const t = (en, zh) => lang === 'zh' ? zh : en;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const link = (label, url) => {
    const node = el('a', label);
    if (/^(https:\/\/|\.\/|#)/.test(url)) node.href = url;
    return node;
  };
  const code = text => { const p = el('pre'); p.append(el('code', text)); return p; };
  const text = (id, en, zh) => { document.getElementById(id).textContent = t(en, zh); };
  const section = (id, title, description, target, expanded = false) => {
    const item = el('details', undefined, 'entry-quick'); item.id = id; item.open = expanded;
    item.append(el('summary', title), el('p', description)); target.append(item); return item;
  };
  const appendStep = (node, title, command, description) => {
    node.append(el('h4', title));
    if (description) node.append(el('p', description));
    if (command) node.append(code(command));
  };
  const jsonText = v => typeof v === 'string' ? v : JSON.stringify(v);

  function basic() {
    text('entry-install-note',
      'Python 3.10+, Git and an isolated local environment. The shared package indexes, verifies and reads original files; it does not turn every source into a common evaluation protocol. Keep data outside the repository. Opening this page does not execute the commands; use them only for your own authorized run.',
      '需要 Python 3.10+、Git 和独立本地环境。共用组件负责索引、校验与读取原文件，不把所有来源变成同一种评测。数据放在仓库外。打开页面不会执行这些命令；请在本人获授权的运行中使用。');
    document.getElementById('entry-install').textContent = `git clone https://github.com/vLLM-HUST/vllm-hust-benchmark.git\ncd vllm-hust-benchmark\ngit checkout --detach ${REV}\npython3 -m venv .venv\n. .venv/bin/activate\npython -m pip install -e .\npython -m pip install -e "./workload-preparation[data]"\npython -m vllm_hust_benchmark.workload_data source-plan GSM8K\npython -m vllm_hust_workload_data.catalog download-plan GSM8K`;
    text('entry-install-output',
      'Expected: source entrypoints and a pinned file/URL/SHA download plan, not downloaded data or scores. Windows: use py -3 -m venv .venv and .venv\\Scripts\\Activate.ps1; use the Python download example below instead of POSIX shell syntax.',
      '预期输出：来源入口及固定文件、URL、SHA 下载计划，不是已下载数据或分数。Windows 使用 py -3 -m venv .venv 和 .venv\\Scripts\\Activate.ps1；下载可用下方跨平台 Python 示例。');
    const root = document.getElementById('entry-basic'); root.replaceChildren();
    const g = section('GSM8K-quickstart', t('GSM8K: download, configure, prepare and run 3 original questions', 'GSM8K：下载、配置、准备并运行 3 道原题'),
      t('A small supported path through the existing repository, not a universal runner or a full benchmark score. The task uses the unchanged lm-eval GSM8K prompt/scorer with five training examples; three held-out test rows, chat transport, 2,048 output tokens and thinking disabled are explicit differences.',
        '复用现有仓库的小型完整路径，不是万能执行器或全量成绩。沿用 lm-eval 的 GSM8K 提示、评分和五个训练示例；显式区别为三道测试题、chat 传输、2048 输出 token 与关闭 thinking。'), root, true);
    appendStep(g, t('Download the original fixed files', '下载固定原文件'),
      `mkdir -p ../evaluation-data/gsm8k\npython -c "from pathlib import Path; from urllib.request import urlretrieve; from vllm_hust_workload_data.catalog import download_plan; p=Path('../evaluation-data/gsm8k'); p.mkdir(parents=True,exist_ok=True); [urlretrieve(f['url'], p/Path(f['path']).name) for f in download_plan('GSM8K')['files'] if f['role']=='data']"`,
      t('MIT metadata at the pinned publisher revision; review publisher terms. Downloads both original train and test parquet files. Omit mkdir on Windows; the Python command creates the directory.', '目录记录许可为 MIT，仍需阅读固定发布版本条款；下载原 train/test parquet 文件。Windows 可省略 mkdir，Python 命令会创建目录。'));
    appendStep(g, t('Shared configuration: save as input.json in the repository root', '统一准备配置：在仓库根目录创建 input.json'),
      JSON.stringify({sources: [{source_id: 'GSM8K', data_root: '../evaluation-data/gsm8k', manifest: '../evaluation-data/gsm8k-binding.json', limit: 3}]}, null, 2));
    appendStep(g, t('Bind and prepare references', '校验并准备输入引用'),
      `python -m vllm_hust_workload_data.pipeline bind GSM8K --data-root ../evaluation-data/gsm8k --files test-00000-of-00001.parquet --revision 740312add88f781978c0658806c59bc2815b9866 --output ../evaluation-data/gsm8k-binding.json\npython -m vllm_hust_workload_data.pipeline plan --config input.json\npython -m vllm_hust_workload_data.pipeline run --config input.json --output ../evaluation-data/prepared-001`,
      t('Expected: workload.sqlite and manifest.json containing input references, not model replies or scores. Use a fresh output directory. Other supported readers use the same configuration shape, but each source needs its own original files and adapter.', '预期生成 workload.sqlite 与 manifest.json，只保存输入引用，不含模型回复或分数。输出目录必须是新目录；其他已支持读取器共用此配置结构，但仍需对应原文件和适配器。'));
    appendStep(g, t('Actual execution: the existing GSM8K runner', '实际执行：现有 GSM8K 专用执行入口'),
      `python -m pip install 'lm-eval[api]==0.4.11' datasets==3.6.0 pyarrow==19.0.1 huggingface-hub==0.31.0\npython scripts/run_gsm8k_original_samples.py --data-root ../evaluation-data/gsm8k --endpoint https://MODEL_HOST/v1/chat/completions --model SERVED_MODEL_NAME --output ../evaluation-data/gsm8k-run-001`,
      t('Provide an authorized chat/completions endpoint and its exact model name; for authenticated lm-eval API transport use its OPENAI_API_KEY environment variable, never a key in argv. This runner reads and hashes the original parquet directly, not workload.sqlite. Expected: receipt.json and private-results.json, three evaluated sample IDs and actual metrics or a retained error. Private results contain questions, references and responses. No promised passing score.',
        '提供获授权的 chat/completions 地址和真实模型名；lm-eval API 认证使用其 OPENAI_API_KEY 环境变量，不把密钥写进参数。此执行器直接读取并校验原 parquet，不消费 workload.sqlite。预期产物为 receipt.json、private-results.json、三个样本 ID 和真实指标或保留的错误；私有结果含题目、参考和回复，不保证通过。'));
    g.append(link(t('Original runner and scope', '原执行器及范围'), BASE + 'scripts/run_gsm8k_original_samples.py'));
    root.append(el('p', t('The shared execution module is only for records explicitly marked request_replay with original HTTP bodies. It rejects static tasks and metadata-only traces and reports scoring=NOT_RUN. It is not the execution command for these 118 sources.',
      '共用 execution 模块仅接收显式 request_replay 的原始 HTTP 请求体，拒绝静态题与纯元数据轨迹，输出 scoring=NOT_RUN；不能作为 118 个来源的统一评测命令。')));
  }

  function special() {
    const root = document.getElementById('entry-quickstarts'); root.replaceChildren();
    text('entry-run-warning', 'Use these existing clients only when the task needs their token template, judge or media protocol. Local clients connect to your existing service without SSH; they do not install a model server. The examples run one item, not the full dataset.',
      '只有任务需要对应 token 模板、Judge 或媒体协议时才使用这些已有客户端。客户端在本地连接现有服务，无需 SSH，不安装模型服务；以下只跑一题，不是全量评测。');
    const notes = {
      MMLU_PRO: ['MMLU-Pro', 'Token-ID completions and local extraction; not a generic chat-only service.', '需要 token-ID completions 与本地答案提取，不适用于仅支持通用 chat 的服务。'],
      HLE_VERIFIED: ['HLE-Verified', 'Separate solver/judge; images require multimodal input and judging needs Structured Outputs.', '独立 Solver/Judge；图像题需多模态输入，Judge 需 Structured Outputs。'],
      FRONTIERSCIENCE: ['FrontierScience', 'Olympiad and Research rubrics require their existing judge adapter.', 'Olympiad 与 Research 评分需使用已有 Judge 适配。']
    };
    for (const entry of catalog.primary_entries.filter(e => notes[e.source_id])) {
      const n = notes[entry.source_id]; const item = section(entry.source_id, n[0], t(n[1], n[2]), root);
      appendStep(item, t('Install locally', '本地安装'), entry.install_posix.join('\n'),
        t('Python 3.9+. Windows activation: .venv\\Scripts\\Activate.ps1. Use one virtual environment per client. Core installation/help were checked; the commands below are not a new data/model validation.',
          'Python 3.9+，Windows 激活使用 .venv\\Scripts\\Activate.ps1，每个客户端使用独立环境。已检查 core 安装/help，以下命令不是新数据或模型验收。'));
      if (entry.source_id === 'MMLU_PRO') {
        appendStep(item, t('Data and preparation dependencies', '数据与准备依赖'), [...entry.prepare_extra_install, ...entry.download_example_not_executed].join('\n'));
        item.append(el('p', t('Supply ./model-tokenizer with the exact served tokenizer/chat template and ./service/runtime-contract.json from the operator. Freeze the transformers version used for tokenization. The base URL below excludes /v1; the endpoint must accept token IDs at /v1/completions. Do not fabricate server runtime evidence from local packages.',
          '需提供与服务一致的 ./model-tokenizer tokenizer/chat template，以及运维提供的 ./service/runtime-contract.json；固定分词 transformers 版本。下方 base URL 不含 /v1，服务需支持 /v1/completions 的 token IDs。不能用本地包身份冒充服务环境。')));
      } else {
        appendStep(item, t('Copy and edit the supplied configuration templates', '复制并修改已有配置模板'), entry.configuration_steps.slice(0, 3).join('\n'),
          t('Edit run/solver.json and run/judge.json: base_url, model, model_artifact and api_key_env must match your authorized services. Keep request/token/time/concurrency settings explicit; model_artifact is an identity field, not a command to load local weights. Owner-provided runtime contracts can be attached; omitted provenance remains unknown.',
            '编辑 run/solver.json、run/judge.json 的 base_url、model、model_artifact、api_key_env 为实际获授权服务；明确 request/token/时间/并发设置。model_artifact 为身份记录，不要求本地加载权重。可附运维的真实 runtime contract，缺失时保持未知。'));
        item.append(code(JSON.stringify({base_url: 'https://MODEL_HOST', model: 'SERVED_MODEL_NAME', model_artifact: 'OWNER_SUPPLIED_MODEL_IDENTITY', api_key_env: 'MODEL_API_KEY'}, null, 2))); // pragma: allowlist secret - environment variable name, not a credential
        item.append(el('p', t('These are the fields to replace in the complete copied templates, not a complete standalone config. Supply secrets through the named environment variable. Preserve the judge response format from its template.', '上面是完整模板中需要替换的字段，不是独立完整配置。密钥仅通过指定环境变量提供，保留 Judge 模板的响应格式。')));
      }
      appendStep(item, t('Prepare, run one item and summarize', '准备、运行一题并汇总'), entry.minimum_argv.map(a => a.join(' ')).join('\n'),
        t(entry.outputs, '预期生成计划、请求/回答与汇总；HLE/Frontier 另生成 Judge 评分和报告。保留错误、截断与未解决项，一题结果不能代表全量。'));
      item.append(el('p', t(entry.scorer_boundary,
        entry.source_id === 'MMLU_PRO' ? '本地提取未解析答案记错，不采用原随机猜测；token 模板与 few-shot 合同不等同官方榜单复现。' : '使用替代 Judge 和显式评分策略，不等同原作者审核或官方榜单成绩。')));
      item.append(el('p', t(entry.splits, entry.source_id === 'HLE_VERIFIED' ? 'Gold 668 / Revision 1143；默认 fetch 不含 Uncertain，示例选择 Gold。' : entry.source_id === 'FRONTIERSCIENCE' ? 'Gold Olympiad 100 / Research 60；limit 1 不覆盖两个 track。' : 'test 12032 / validation 70（用于 few-shot 准备）。')));
      const links = el('p', undefined, 'entry-links'); links.append(link(t('Official data and terms', '官方数据与条款'), entry.official_data), link(t('Client source', '客户端源码'), entry.client_repository), link(t('Existing results', '已有结果'), './dataset-validation.html'));
      item.append(links);
    }
  }

  function agents() {
    const root = document.getElementById('entry-agent-guides'); root.replaceChildren();
    const swe = section('SWE_BENCH_PRO', 'SWE-bench-Pro', t('Run the Agent in your Coder CPU/Docker workspace using the published template. The workspace provides a separate task sandbox; connect it to your model API without using the model host Docker socket.',
      '登录 Coder 后，使用已发布模板创建自己的 CPU/Docker 工作区，按下列步骤运行 Agent。工作区提供独立任务沙箱并连接模型 API，不使用模型宿主机 Docker socket。'), root);
    const sweLinks = el('p', undefined, 'entry-links');
    sweLinks.append(link(t('Coder workspace instructions', 'Coder 工作区操作说明'), AGENT_BASE + 'docs/SWE_BENCH_PRO.zh-CN.md#coder-上的执行结构docker-in-docker-沙箱'), link(t('Complete run and grading guide', '完整运行与评分指南'), AGENT_BASE + 'docs/SWE_BENCH_PRO.zh-CN.md'), link(t('Platform assistant (optional)', '平台助手（可选）'), OPS + 'references/swe-bench-pro.md'));
    swe.append(sweLinks);
    swe.append(el('p', t('Platform status, 2026-10-31: the CPU template is visible to ordinary users, but creating a new 20 GiB workspace is currently blocked by the full namespace storage quota (4625 / 4625 GiB). Administrators must make approved capacity available. The grading-directory mount is repaired in template cpu-grade-bind-1031-1fd0da18; the guide reports environment readiness, Agent submission and official grading separately.',
      '平台状态（2026-10-31）：普通用户可见 CPU 模板，但新建 20 GiB 工作区当前被已满的存储配额（4625 / 4625 GiB）阻塞，需管理员按容量审批流程释放或增加额度。评分目录挂载已在 cpu-grade-bind-1031-1fd0da18 模板修复；环境就绪、Agent 提交及官方评分分别见完整指南。')));
    appendStep(swe, t('1. Create your Coder CPU workspace', '1. 创建自己的 Coder CPU 工作区'), null,
      t('In Coder, create a workspace from the published swe-bench-pro-cpu template and open its terminal. Use your model API with the commands below. The template provides the isolated Docker environment. A platform assistant can optionally help prepare the workspace. The starter runs one NodeBB V1 task; the lock covers eight tasks, not the entire dataset.',
        '在 Coder 中选择已发布的 swe-bench-pro-cpu 模板创建工作区，打开终端，填写自己的模型 API 和模型名执行下方命令；需要鉴权时，先在终端设置 MODEL_API_KEY，再追加 --api-key-env MODEL_API_KEY。模板提供独立 Docker 环境；也可以让平台助手代为准备。入门流程运行一道 NodeBB V1 任务，锁定清单覆盖八道，不代表全量数据集。'));
    swe.append(code(t('Use npu-private-cloud-ops to prepare SWE-bench Pro on my authorized platform. Discover the CPU template and existing model service; complete the pinned environment and input checks. Return the workspace entry, exact command and result paths. Keep the official tested Agent unchanged. Report preparation, Agent submission and official grading separately.',
      '请使用 npu-private-cloud-ops，在我有权使用的平台准备 SWE-bench Pro。发现 CPU 模板和已有模型服务，完成固定环境与输入检查，交付工作区入口、实际命令和结果位置。保持被测官方 Agent 不变，分别报告环境就绪、Agent 提交和官方评分。')));
    appendStep(swe, t('2. Pinned bootstrap, then one explicit run', '2. 固定 bootstrap，然后显式运行'),
      `MODEL_API=https://MODEL_HOST/v1
MODEL_NAME=openai/SERVED_MODEL_NAME
export PIP_INDEX_URL="\${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
BASE=https://coder.sage.org.ai:9443/swe-bench-pro-artifacts
REV=33efa2a4ce065bcd6d25ab387ddffd85b3826a3f # pragma: allowlist secret
BUNDLE_SHA=fcf21b81bc91e569ab57ebb43791a0a4b7b1b8678dd5dc3487ad931c57e5e7b8 # pragma: allowlist secret
curl --fail --location "$BASE/$REV/bootstrap_swe_bench_pro.py" --output bootstrap_swe_bench_pro.py
echo 'f4700673883af8447442c89193881efa314649cb949b2fdca00bf8ea88fecea9  bootstrap_swe_bench_pro.py' | sha256sum --check # pragma: allowlist secret
python3 bootstrap_swe_bench_pro.py --source-revision "$REV" \\
  --source-bundle-url "$BASE/$REV/runtime.tar.gz" \\
  --source-bundle-sha256 "$BUNDLE_SHA" \\
  --crane-archive-url "$BASE/crane-v0.20.3-linux-arm64.tar.gz" \\
  --work "$HOME/swe-pro-first" --model-api "$MODEL_API" --model-name "$MODEL_NAME" --run`,
      t('Linux ARM64, Python 3.10+, an isolated Docker daemon, reachable pinned dataset/task images and sufficient disk are required. Use a new absolute private work path. Omitting --run prepares only; an existing owned directory needs --resume with the same identity. Submission and official grading are separate; a submitted patch is not a passing score.',
        '需要 Linux ARM64、Python 3.10+、隔离 Docker daemon、可访问的固定数据/任务镜像和足够磁盘。使用新的绝对私有工作路径；省略 --run 只准备，已有目录需以同身份 --resume。提交与官方评分分开，有 patch 不代表判对。'));
    appendStep(swe, t('3. Inspect the Agent result, then grade the saved patch', '3. 检查 Agent 结果，再对保存的补丁独立评分'), `WORK="$HOME/swe-pro-first"
"$WORK/client/bin/python" -m vllm_hust_benchmark.swe_bench_pro grade \\
  --settings "$WORK/settings-private.json" --inputs "$WORK/inputs" \\
  --batch-directory "$WORK/run" --output "$WORK/grade-001"`,
      t('Read the per-task report, trajectory, patch and batch report. Submitted is not resolved; quality_score: null means ungraded. Bootstrap includes local official-grading dependencies. Run the command above to grade the saved patch in a fresh container. Preserve grading-status.json, patch-application evidence and official outputs. Ops prepares the environment; it is not added to the tested Agent as a solving skill.',
        '读取逐题 report、轨迹、patch 和 batch report。Submitted 不等于修复成功，quality_score: null 表示未评分。bootstrap 已安装本地官方评分依赖；使用上述命令在新容器执行 grade，保存 grading-status.json、补丁应用证据和官方输出。ops 负责环境，不作为修题技能注入被测 Agent。'));
    swe.append(el('p', t('Dataset: ScaleAI/SWE-bench_Pro v1, not SWE-bench Verified or V2. Task repositories and images retain their own licenses.', '数据为 ScaleAI/SWE-bench_Pro v1，不是 SWE-bench Verified 或 V2；任务仓库与镜像遵循各自许可。')));
    const terminal = section('TERMINAL_BENCH_2_1', 'Terminal-Bench 2.1 / Harbor', t('Start with the native ARM64 OpenSSL task in your authorized CPU workspace. Current results, setup and scoring are shown first; batch configuration is below.',
      '先在本人获授权 CPU 工作区运行原生 ARM64 OpenSSL 单题。先看当前实测、使用入口和评分，批次详细配置在下方展开。'), root);
    const result = el('div', undefined, 'terminal-current-result'); result.id = 'terminal-current-result';
    result.append(el('h4', t('Current single-task result', '当前单题实测')));
    const ev = terminalEvidence;
    const table = el('table'); const header = el('tr');
    for (const title of [t('Run', '运行'), 'Reward', t('Tests passed', '评分项通过'), t('Status', '状态')]) header.append(el('th', title));
    const head = el('thead'); head.append(header); table.append(head); const body = el('tbody');
    for (const [role, label] of [['nop', t('Empty answer control', '空答案负控制')], ['oracle', t('Reference control', '参考解正控制')], ['model', t('Real model Agent', '真实模型 Agent')]]) {
      const item = ev.validation[role]; const row = el('tr');
      row.append(el('td', label), el('td', item.reward == null ? t('Not scored', '未评分') : String(item.reward)), el('td', item.tests == null ? '—' : `${item.passed}/${item.tests}`), el('td', item.status === 'scored' ? t('Scored', '已评分') : t('Incomplete', '未完成'))); body.append(row);
    }
    table.append(body); result.append(table);
    result.append(el('p', `${ev.task_id} · ${ev.runtime.model} · vLLM ${ev.runtime.vllm} / Ascend ${ev.runtime.vllm_ascend}`));
    result.append(el('p', t('Scope: one fresh task and original verifier in an existing ARM64 CPU workspace. Controls are separate from model quality. This does not validate all 89 tasks, a new-account workspace setup, or B0/B1 performance.', '范围：已有 ARM64 CPU 工作区中的一次全新任务与原评分器。正负控制与模型成绩分开；不代表全部 89 题、新账号创建工作区或 B0/B1 性能配对通过。')));
    const currentLinks = el('p', undefined, 'entry-links');
    const terminalBase = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${terminalSource.commit}/`;
    currentLinks.append(link(t('Complete ARM64 guide', 'ARM64 完整使用指南'), terminalBase + 'docs/TERMINAL_BENCH_ARM64.zh-CN.md'), link(t('Acceptance evidence', '验收记录与证据'), './assets/data/terminal-arm64-acceptance-v1.json'), link(t('Ops skill', 'ops skill 运维入口'), OPS + 'SKILL.md')); result.append(currentLinks); terminal.append(result);
    appendStep(terminal, t('1. Ask ops to prepare your workspace and model profile', '1. 让 ops 准备本人工作区与模型配置'),
      t('Use npu-private-cloud-ops to run the Terminal-Bench 2.1 ARM64 OpenSSL task in my authorized CPU workspace with my existing model service. Fill the persistent run directory and private model profile, run the official controls, then one real Agent and verifier. Return the workspace entry, filled commands and result path. Keep ops outside the tested Agent.', '请使用 npu-private-cloud-ops，在我获授权的 ARM64 CPU 工作区沿用已有模型服务，运行 Terminal-Bench 2.1 OpenSSL 单题。自动填妥持久运行目录和私有模型配置，先跑原评分器正负控制，再跑一次真实 Agent 与评分。返回工作区入口、已填好的命令和结果路径；ops 不加入被测 Agent。'),
      t('Ops handles Docker, Compose, image access, persistent storage and model credentials. You use your own workspace terminal; no cluster administration is required. The prepared path uses Python 3.12+, 1 CPU/2 GiB per sandbox and an isolated MTU 1400 network.', 'Docker、Compose、镜像访问、持久存储和模型认证由 ops 处理。使用者进入本人工作区终端，不需要集群管理员权限。入口要求 Python 3.12+；每个沙箱 1 核/2 GiB，使用独立 MTU 1400 网络。'));
    const download = section('terminal-arm64-download', t('2. Download the fixed entry script', '2. 下载固定版本入口'), t('Ops can perform this step for you. The source revision is fixed to the executed script.', '可由 ops 代为完成，固定到本次实际执行的脚本版本。'), terminal);
    download.append(code(`python3 - <<'PY'\nimport base64, json, urllib.request\nfrom pathlib import Path\nrevision = "${ev.source.bootstrap_commit}"\nurl = "https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/scripts/bootstrap_terminal_arm64.py?ref=" + revision\nwith urllib.request.urlopen(url, timeout=120) as response:\n    item = json.load(response)\nPath("bootstrap_terminal_arm64.py").write_bytes(base64.b64decode(item["content"]))\nPY`));
    appendStep(terminal, t('3. Prepare, validate and run once', '3. 准备、控制与一次运行'),
      `python3 bootstrap_terminal_arm64.py prepare --directory "$RUN_DIR"\npython3 bootstrap_terminal_arm64.py controls --directory "$RUN_DIR"\npython3 bootstrap_terminal_arm64.py run --directory "$RUN_DIR" --profile "$MODEL_PROFILE"\npython3 bootstrap_terminal_arm64.py status --directory "$RUN_DIR"`,
      t('Ops supplies RUN_DIR and MODEL_PROFILE with your actual paths. READY only means preparation finished. controls runs fresh empty-answer and reference sandboxes; run executes one model task and the original grader. A started attempt cannot be submitted again in the same directory.', 'RUN_DIR 和 MODEL_PROFILE 由 ops 填为本人实际路径。READY 仅表示准备完成；controls 在新沙箱检查空答案和参考解，run 执行一次模型任务与原评分器。同一目录已启动的任务不能重复提交。'));
    appendStep(terminal, t('4. Read the score', '4. 读取评分'), null,
      t('Open model-receipt.json: reward=1 means this task passed; reward=0 with complete grading is a real quality failure; null reward means unscored. Original trajectories and verifier logs are under jobs/. Fixed budget: 100 turns, 4096 output tokens, 900 seconds for Agent and verifier each; no whole-trial retry. Full settings and upstream internal call retries are documented in the guide.', '查看 model-receipt.json：reward=1 表示此题通过；完整评分得到 reward=0 是真实质量失败；null reward 表示未评分。原轨迹和评分日志位于 jobs/。固定预算为 100 轮、单次最多输出 4096 tokens，Agent 与评分各 900 秒，不重跑整题；完整参数及上游内部调用重试见指南。'));
    const advanced = section('terminal-advanced', t('Batch configuration and detailed methods', '批次配置与详细方法（展开）'), t('For separately authorized, frozen task sets. The ARM64 single-task result does not qualify these other images or a full batch.', '仅供另行授权并冻结的任务集合使用。ARM64 单题结果不能代替其他镜像或完整批次验收。'), terminal);
    const e = catalog.primary_entries.find(x => x.source_id === 'TERMINAL_BENCH_2_1');
    const terminalLinks = el('p', undefined, 'entry-links');
    terminalLinks.append(link(t('Original 2.1 tasks', '原 2.1 任务'), e.official_data), link(t('Existing preparation code', '已有准备程序'), AGENT_BASE + 'scripts/prepare_pyramidkv_terminal.py'), link(t('Harbor configuration', 'Harbor 配置说明'), 'https://docs.harborframework.com/jobs/configs'), link(t('Ops skill', 'ops skill 运维入口'), OPS + 'SKILL.md'));
    advanced.append(terminalLinks);
    appendStep(advanced, t('1. Ops delivers the execution workspace', '1. 由 ops 交付执行工作区'), null,
      t('The user supplies the authorized platform/account, target model and intended task scope. Ops discovers an isolated Docker + Compose backend, Python 3.12+, image access, persistent storage and connectivity from the Agent to the model API. Size CPU, memory and disk for the original task requirements. A CPU workspace with a Docker client alone is insufficient.',
        '使用者提供有权使用的平台/账号、目标模型和任务范围。ops 发现或准备独立 Docker + Compose、Python 3.12+、镜像访问、持久存储，以及 Agent 到模型 API 的连通性，按原任务要求配置 CPU、内存和磁盘。只有 Docker 客户端的普通 CPU 工作区不够。'));
    advanced.append(el('p', t('The existing candidate image audit selects linux/amd64. Use a matching authorized backend for that exact plan. For ARM64 tasks beyond the OpenSSL entry above, ops must separately verify each image, dependencies, oracle and verifier; the SWE ARM template does not prove Terminal compatibility. There is no Terminal-specific recipe in the linked ops skill yet; use this checklist with its platform workflow.',
      '现有候选镜像审计选择 linux/amd64，复用该方案需匹配的获授权执行后端。上方 OpenSSL 入口以外的 ARM64 任务，仍须由 ops 逐题核验镜像、依赖、oracle 和 verifier；SWE 的 ARM 模板不代表 Terminal 已适配。链接的 ops skill 尚无 Terminal 专项配方，需结合本页步骤使用其平台运维流程。')));
    advanced.append(code(t('Use npu-private-cloud-ops to prepare Terminal-Bench 2.1 following this page. Discover an authorized CPU sandbox and existing model API. Reuse the pinned source audit and job builder, replace candidate-specific identities, and deliver the actual workspace entry, frozen job files and run/result paths. Verify image architecture, effective limits, oracle/verifier and one model trial before a full batch. Keep ops outside the tested Agent and report unresolved items.',
      '请使用 npu-private-cloud-ops，按本页流程准备 Terminal-Bench 2.1。发现获授权 CPU 沙箱与已有模型 API，复用固定来源审计和 job 生成器，替换候选方案专属身份，交付实际工作区入口、冻结 job 文件、运行命令与结果路径。全量前验证镜像架构、有效限额、oracle/verifier 和一个模型任务。ops 不加入被测 Agent，未完成项如实列出。')));
    const preparation = section('terminal-preparation', t('2. Fetch, verify and prepare (operator commands)', '2. 获取、校验与准备（运维命令）'), t('Run in a new private workspace. These commands prepare a candidate; they do not run model tasks.', '在新的私有工作目录执行。以下只准备候选方案，不执行模型任务。'), advanced);
    appendStep(preparation, t('Install the pinned client', '安装固定客户端'),
      `git clone https://github.com/vLLM-HUST/vllm-hust-benchmark.git\ncd vllm-hust-benchmark\ngit checkout --detach ${AGENT_REV}\npython3.12 -m venv "$HOME/terminal-client"\n. "$HOME/terminal-client/bin/activate"\npython -m pip install harbor==0.24.0\npython -m pip freeze > "$HOME/terminal-client-requirements.txt"\nharbor run --help\ndocker version\ndocker compose version`,
      t('Use a fresh client environment, separate from the model server. Ops freezes the resolved dependencies and execution image; installing Harbor alone does not verify the backend.', '使用独立于模型服务的新客户端环境。ops 还需固定解析后的依赖和执行环境镜像；安装 Harbor 不等于后端验收。'));
    appendStep(preparation, t('Retrieve the fixed task and image metadata, then generate jobs', '获取固定任务与镜像元数据，再生成 job'),
      `python scripts/fetch_pyramidkv_terminal.py --assets "$HOME/terminal-assets"\npython scripts/prepare_pyramidkv_terminal.py --assets "$HOME/terminal-assets" --output "$HOME/terminal-plan" --api-base https://MODEL_HOST/v1 --validate-harbor`,
      t('Source: terminal-bench-2-1 at 7131e4375048a0e408a8fb404b5f499d726b695b, 89 tasks. The fetcher checks the published source and image metadata; it does not pull image layers. The preparer stages tasks with image digests and creates job-b0.json, job-b1.json, contract.json and source-audit/. It refuses to replace an existing plan. Schema validation is not task execution.',
        '来源：terminal-bench-2-1 的 7131e4375048a0e408a8fb404b5f499d726b695b，89 道任务。获取器校验已发布的源码与镜像元数据，不下载镜像层。准备器按镜像 digest 暂存任务，生成 job-b0.json、job-b1.json、contract.json 和 source-audit/，拒绝覆盖已有计划。schema 通过不等于任务运行通过。'));
    appendStep(advanced, t('3. Turn the candidate into the actual run contract', '3. 将候选配置落实为本次实际运行合同'), null,
      t('Ops must edit and validate both jobs before use: actual model_name and /v1 api_base; server-proven context/input/output budgets; Agent/parser/temperature/thinking/summarization settings; attempts, concurrency and unique output directories. Inject OPENAI_API_KEY into the client environment if required, never into a URL or job file. Pull every required image by digest and verify architecture and effective resource limits.',
        'ops 使用前须修改并校验两份 job：真实 model_name 与 /v1 api_base；服务端已确认的上下文、输入和输出预算；Agent、解析器、温度、thinking、压缩策略；尝试次数、并发和独立输出目录。需要认证时将 OPENAI_API_KEY 注入客户端环境，不写入 URL 或 job。逐个按 digest 拉取所需镜像，核实架构与实际资源限额。'));
    advanced.append(el('p', t('The builder contains PyramidKV names, a model revision and a 32K/4096/100-turn diagnostic protocol. Those are not universal model limits. Preserve the original candidate contract; write a new run contract with the actual identities, final job hashes and changes. Zero token prices in the template are not measured operating cost. B0 means vLLM 0.18 + vLLM-Ascend 0.18; a b0 filename does not switch the server. B1 must record its actual tested optimization and versions.',
      '生成器含 PyramidKV 名称、模型 revision 和 32K/4096/100 轮诊断协议，不是所有模型的固定上限。保留原候选 contract，另存实际身份、最终 job 哈希和变更说明的运行合同。模板中的零 token 单价不是实测运营成本。B0 必须对应 vLLM 0.18 + vLLM-Ascend 0.18；文件名 b0 不会切换服务。B1 记录实际优化方案与版本。')));
    const validation = section('terminal-validation', t('Job checks and single-task configurations', 'job 校验与单题配置'), t('After ops has completed step 3, run from the plan directory so relative task paths resolve correctly. The first task is only an entry check, not an architecture or quality claim for the full set.', 'ops 完成第 3 步后，从计划目录执行，确保任务相对路径正确。首题仅用于入口检查，不能代表全部任务的架构兼容性或质量。'), advanced);
    validation.append(code(`cd "$HOME/terminal-plan"\npython - <<'PY'\nimport json\nfrom pathlib import Path\nfrom harbor.models.job.config import JobConfig\nfrom harbor.agents.terminus_2.terminus_2 import Terminus2\nfor name in ('job-b0.json', 'job-b1.json'):\n    job = json.loads(Path(name).read_text())\n    JobConfig.model_validate(job)\n    Terminus2.options_model.model_validate(job['agents'][0]['kwargs'])\n    assert job['tasks'] and not job['verifier']['disable']\njob = json.loads(Path('job-b0.json').read_text())\njob.update(job_name='terminal-smoke', jobs_dir='jobs-smoke', n_attempts=1, n_concurrent_trials=1)\njob['tasks'] = job['tasks'][:1]\nwith open('job-smoke.json', 'x') as f:\n    json.dump(job, f, indent=2)\njob.update(job_name='terminal-oracle', jobs_dir='jobs-oracle', agents=[{'name': 'oracle'}])\nwith open('job-oracle.json', 'x') as f:\n    json.dump(job, f, indent=2)\njob.update(job_name='terminal-nop', jobs_dir='jobs-nop', agents=[{'name': 'nop'}])\nwith open('job-nop.json', 'x') as f:\n    json.dump(job, f, indent=2)\nPY`));
    appendStep(advanced, t('4. Validate the sandbox and verifier, then run one model task', '4. 先验证沙箱与评分器，再跑一个模型任务'),
      `cd "$HOME/terminal-plan"\nharbor run -c job-oracle.json\nharbor run -c job-nop.json\n# After inspecting both verifier artifacts:\nharbor run -c job-smoke.json`,
      t('Oracle executes the supplied reference solution and must stay separate from model scoring. Inspect its verifier output. The nop job leaves a fresh task untouched to check the negative case; confirm that the chosen task is expected to fail without a solution. If it is not, select a known-failing case before accepting the verifier. Then confirm the model trial actually calls the intended model, executes terminal commands and reaches the verifier. A zero reward with a valid verifier is a real failure; a missing reward or setup error is unresolved. Do not proceed past an environment/verifier fault or silently retry.',
        'oracle 执行自带参考解，必须与模型评分分开；检查其 verifier 输出。nop job 在新沙箱中不解题，用于负例检查；先确认所选任务在未解答时应失败，否则另选已知失败样例再验收评分器。随后确认模型试跑确实调用目标模型、执行终端命令并进入 verifier。有效评分器产生 0 是真实失败；缺失 reward 或环境错误是未决。环境/评分器故障未解决时不扩大批次，不静默重试。'));
    appendStep(advanced, t('5. Run the frozen B0/B1 batch', '5. 运行冻结的 B0/B1 批次'),
      `cd "$HOME/terminal-plan"\n# After verifying and recording the actual B0 service:\nharbor run -c job-b0.json\n# After verifying and recording the actual B1 service:\nharbor run -c job-b1.json`,
      t('Use the same task IDs, Agent, model weights, input, budgets, resources and scoring policy for the comparison; record any applicable differences. Keep B0/B1 outputs separate and allocate fresh trial sandboxes. Preserve upstream task/test budgets. Freeze repetitions and stopping rules before running; a smoke task does not replace the declared full scope. The project comparison is not an official leaderboard submission.',
        '比较时对齐任务 ID、Agent、模型权重、输入、预算、资源和评分策略，披露适用差异；B0/B1 分开输出，每次 trial 使用新沙箱。保留原任务/测试预算，运行前冻结重复次数与停止规则；单题试跑不能替代声明的全量范围。项目比较不等于官方榜单提交。'));
    appendStep(advanced, t('6. Accept and archive the result', '6. 验收与归档结果'), null,
      t('Keep the final jobs and hashes, source/image/dependency identities, service runtime evidence, per-trial result.json, Agent trajectories, terminal logs and verifier/reward artifacts. Reconcile planned, attempted, scored, passed, failed and errored task counts. Report coverage and the predeclared denominator, retaining errors; never turn null reward into zero or success. Summarize complete B0/B1 pairs only. Store canonical results in the benchmark repository after redaction; the website displays their summary.',
        '保存最终 job 及哈希、源码/镜像/依赖身份、服务运行证据、逐 trial result.json、Agent 轨迹、终端日志和 verifier/reward 原件。核对计划、尝试、已评分、通过、失败、异常数量，报告覆盖范围和事前确定的分母，保留异常；null reward 不能改成 0 或通过。只对完整 B0/B1 配对汇总。脱敏后的规范结果归档 benchmark 仓库，网站展示摘要。'));
  }

  function sources() {
    const query = document.getElementById('entry-search').value.trim().toLowerCase();
    const filter = document.getElementById('entry-filter').value;
    const rows = catalog.sources.filter(r => {
      const kind = r.guide_id ? 'client' : r.entrypoints.length ? 'indexed' : 'metadata';
      return (filter === 'all' || kind === filter) && `${r.source_id} ${r.classes.join(' ')} ${r.asset_group} ${r.ledger_status}`.toLowerCase().includes(query);
    });
    const root = document.getElementById('entry-sources'); root.replaceChildren();
    document.getElementById('entry-count').textContent = `${rows.length} / ${catalog.counts.sources}`;
    for (const row of rows) {
      const d = el('details', undefined, 'entry-source'); d.id = `source-${row.source_id}`;
      const sum = el('summary'); sum.append(el('strong', row.source_id), el('span', row.guide_id ? t('On-page guide', '站内指南') : row.ledger_status)); d.append(sum);
      const list = el('dl'); const field = (name, value) => { list.append(el('dt', name), el('dd', value)); };
      field(t('Classification', '分类'), `${row.classes.join(', ') || row.asset_group} / ${row.asset_group}`);
      field(t('Provider', '数据组件'), row.provider_registered ? t('Registered; download-plan is metadata only.', '已注册；download-plan 只输出元数据。') : t('Not registered in this provider, not proof that no client exists.', '仅此 provider 未注册，不代表项目没有客户端。'));
      field(t('Ledger status', '既有清单状态'), row.ledger_status + (row.guide_id ? t(' (workload batch only; use the independent guide below)', '（仅 workload 批次；独立入口见下方指南）') : ''));
      if (row.scope_limits) field(t('Validated scope', '已验证范围'), jsonText(row.scope_limits));
      if (row.native_validation) field(t('Native validation', '原生验证'), jsonText(row.native_validation));
      if (row.blocker) field(t('Recorded limitation', '已记录限制'), jsonText(row.blocker));
      field(t('Revision', '固定版本'), row.revision || t('Not recorded by this provider; see the specific guide/publisher.', '此 provider 未记录，见对应指南/发布方。'));
      field(t('License / access', '许可与访问'), row.access ? jsonText(row.access) : t('Not established here; publisher/task terms apply.', '此处未确立，遵守发布方/任务条款。'));
      d.append(list);
      const links = el('p', undefined, 'entry-links');
      if (row.publisher) links.append(link(t('Publisher', '官方来源'), row.publisher));
      if (row.guide_id) links.append(link(t('Installation, configuration and run guide', '安装、配置与运行指南'), '#' + row.guide_id));
      links.append(link(t('Preparation and scope documentation', '准备与范围说明'), BASE + 'workload-preparation/README.md'));
      d.append(links, code([row.source_plan_command, row.download_plan_command].filter(Boolean).join('\n')));
      if (row.files.length) {
        d.append(el('p', t('Pinned files / splits (first 8; the JSON/download-plan contains the complete list). Follow publisher terms before downloading.', '固定文件 / split（前 8 项，完整列表见 JSON/download-plan）；下载前遵守发布方条款。')));
        const files = el('ul');
        for (const file of row.files.slice(0, 8)) {
          const f = el('li'); f.append(file.url ? link(file.path, file.url) : el('span', file.path));
          f.append(el('span', ` [${file.role || 'file'}${file.split ? ', ' + file.split : ''}${file.rows != null ? ', ' + file.rows + ' rows' : ''}]`)); files.append(f);
        } d.append(files);
      }
      if (row.entrypoints.length) {
        d.append(el('p', t('Existing source-specific entrypoints. A reader/preparer is not a task executor; indexed code is not proof of full validation.', '已有分来源入口。读取/准备不等于任务执行，索引有代码不等于全量验证。')));
        const entries = el('ul'); for (const e of row.entrypoints) { const item = el('li'); item.append(link(`${e.role}: ${e.path}`, e.url)); if (e.scope) item.append(el('span', ` — ${e.scope}`)); entries.append(item); } d.append(entries);
      } else if (!row.guide_id) d.append(el('p', t('No executable entry is established by this index. Use the publisher protocol or request integration; no generic execution command is supplied.', '本索引尚未确立可执行入口。需按发布方协议或接入相应执行器，此处不提供假通用命令。')));
      if (row.evidence.length) { const evidence = el('p', undefined, 'entry-links'); for (const e of row.evidence) evidence.append(link(e.label, e.url)); d.append(evidence); }
      root.append(d);
    }
  }

  function designated() {
    const root = document.getElementById('designated-cards'); root.replaceChildren();
    const names = {MMLU_PRO: 'MMLU-Pro', HLE_VERIFIED: 'HLE-Verified', SWE_BENCH_PRO: 'SWE-bench-Pro', FRONTIERSCIENCE: 'FrontierScience', TERMINAL_BENCH_2_1: 'TerminalBench 2.1'};
    for (const id of Object.keys(names)) {
      const entry = catalog.primary_entries.find(e => e.source_id === id);
      const card = el('article', undefined, 'focus-card'); card.append(el('h2', names[id]));
      card.append(link(t('Test instructions & runner →', '测试说明与执行入口 →'), '#' + id));
      card.append(link(t('Official dataset ↗', '原始数据集 ↗'), entry.official_data));
      const scope = entry.splits ? jsonText(entry.splits) : entry.split;
      if (scope) card.append(el('p', scope));
      if (entry.scorer_boundary) card.append(el('p', entry.scorer_boundary));
      root.append(card);
    }
  }

  function render() {
    const labels = {
      'entry-title': ['Project-designated datasets', '项目指定数据集测试'],
      'entry-lead': ['Original data, installation, execution and scoring for the five designated datasets.', '指定五项数据集的原始来源、安装、测试入口与评分说明。先选择数据集，再按对应客户端或沙箱流程执行。'],
      'entry-jump-basic': ['The five datasets', '指定五项数据集'], 'entry-jump-special': ['2. Special scoring', '2. 特殊评分'], 'entry-jump-sandbox': ['3. Agent sandboxes', '3. 闭环任务'],
      'entry-all-link': ['All 118 sources', '全部 118 来源'],
      'entry-install-title': ['1. Shared preparation, then a supported runner', '1. 统一准备，再选择已支持的执行入口'],
      'entry-quick-title': ['2. Special scoring and multimodal clients', '2. 特殊评分与多模态客户端'],
      'entry-sandbox-title': ['3. Sandboxes, tools and task graders', '3. 沙箱、工具与任务评分'],
      'entry-boundary-title': ['Services and integration', '服务与接入边界'],
      'entry-catalog-title': ['All 118 sources', '全部 118 来源'],
      'entry-catalog-note': ['40 task classes plus 15 separately classified trace, probe, relationship and private assets. 104 provider registrations and 14 unregistered entries. Registration, reading, generation and native grading are separate states; AVAILABLE is limited to each linked receipt, not all records or versions. License metadata is a pinned snapshot, not a new legal/access check.', '40 类任务及另列的 15 项轨迹、探针、跨任务关系和私有资产；104 个 provider 注册来源、14 个未注册项。登记、读取、生成与原生评分是不同状态；AVAILABLE 只限对应回执范围，不表示全记录/版本通过。许可元数据为固定快照，不是新法律/访问审核。'],
      'entry-search-label': ['Search', '搜索'], 'entry-filter-label': ['Entry status', '入口类型'],
      'entry-json': ['Versioned catalog (JSON)', '版本化机器目录（JSON）'], 'entry-old-results': ['Existing results', '已有评测结果']
    };
    for (const [id, value] of Object.entries(labels)) text(id, ...value);
    document.getElementById('entry-search').placeholder = t('Source ID, class, status', '来源 ID、类别、状态');
    const options = [['All', '全部'], ['On-page guides', '站内指南'], ['Indexed entrypoints', '已索引入口'], ['Metadata / external setup', '元数据 / 外部准备']];
    [...document.getElementById('entry-filter').options].forEach((o, i) => { o.textContent = t(...options[i]); });
    special(); agents(); designated();
    const boundary = document.getElementById('entry-boundaries'); boundary.replaceChildren();
    for (const pair of [
      [t('Local client', '本地客户端'), t('Existing authorized service URL, exact model, credentials and task budgets. No SSH is needed for HTTP clients; runtime evidence comes from the service owner.', 'HTTP 客户端使用现有获授权服务 URL、真实模型、认证和任务预算，无需 SSH；服务身份由运维提供。')],
      [t('Run the evaluation', '运行方式'), t('Follow the selected dataset guide in your Coder workspace. This page provides installation commands, execution steps and result instructions.', '在自己的 Coder 工作区按对应数据集指南运行。本页提供安装命令、执行步骤和结果查看说明。')],
      [t('MOD integration', 'MOD 接入'), t('Operators configure the server-side optimization and supported API. Reuse these clients when their contract matches; a new client is not required for each MOD. Do not silently change prompts, budgets or scoring.', '运维配置服务端优化及支持的 API；合同一致时复用客户端，不为每个 MOD 另造客户端，不静默改变提示、预算或评分。')]
    ]) boundary.append(el('dt', pair[0]), el('dd', pair[1]));
    text('entry-load-status', 'Five designated dataset guides loaded.', '已加载指定五项数据集的测试指南。');
    revealHash();
  }
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
  document.getElementById('entry-search').addEventListener('input', () => { if (catalog) sources(); });
  document.getElementById('entry-filter').addEventListener('change', () => { if (catalog) sources(); });
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('vllm-hust:langchange', event => { lang = event.detail.lang; if (catalog) render(); });
  Promise.all(['dataset-entrypoints-v1.json', 'terminal-arm64-acceptance-v1.json', 'terminal-arm64-acceptance-source.json'].map(name => fetch('./assets/data/' + name).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }))).then(([data, evidence, source]) => {
    if (data.schema !== 'dataset-entrypoints/v1' || data.sources.length !== 118) throw new Error('Catalog identity mismatch');
    if (evidence.schema !== 'terminal-arm64-user-acceptance/v1' || evidence.task_id !== 'openssl-selfsigned-cert') throw new Error('Terminal evidence identity mismatch');
    if (!/^[0-9a-f]{40}$/.test(source.commit)) throw new Error('Terminal source identity mismatch');
    terminalSource = source;
    terminalEvidence = evidence;
    catalog = data; render();
  }).catch(error => {
    console.error('Public catalog could not be rendered', error);
    text('entry-load-status', 'Catalog could not be loaded. The JSON and existing results links remain available; no execution was started.', '目录加载失败，可通过 JSON 与已有结果链接读取；未启动任何执行。');
  });
}());
