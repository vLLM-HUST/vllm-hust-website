(function () {
  'use strict';
  const REV = '07628b9b5b32d0de37dd3b6fa3bc48d350d8ed71'; // pragma: allowlist secret - public source revision
  const BASE = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${REV}/`;
  const AGENT_REV = 'a05b816b7d205a8e97c2bc0042f4bc52e60601ba'; // pragma: allowlist secret - reviewed public source revision // pragma: allowlist secret
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
    text('entry-run-warning', "Choose the client for your task, connect your model API, and run one example using the steps below.",
      "选择对应客户端，连接模型 API，按下方步骤运行一道示例题。");
    const notes = {
      MMLU_PRO: ['MMLU-Pro', 'Requires token-ID completions and local answer extraction.', '使用 token-ID completions 接口与本地答案提取。'],
      HLE_VERIFIED: ['HLE-Verified', 'Separate solver/judge; images require multimodal input and judging needs Structured Outputs.', '独立 Solver/Judge；图像题需多模态输入，Judge 需 Structured Outputs。'],
      FRONTIERSCIENCE: ['FrontierScience', 'Olympiad and Research rubrics require their existing judge adapter.', 'Olympiad 与 Research 评分需使用已有 Judge 适配。']
    };
    for (const entry of catalog.primary_entries.filter(e => notes[e.source_id])) {
      const n = notes[entry.source_id]; const item = section(entry.source_id, n[0], t(n[1], n[2]), root);
      appendStep(item, t('Install locally', '本地安装'), entry.install_posix.join('\n'),
        t("Python 3.9+. Use one virtual environment per client. On Windows, activate with .venv\\Scripts\\Activate.ps1.",
          "Python 3.9+，每个客户端使用独立环境。Windows 使用 .venv\\Scripts\\Activate.ps1 激活。"));
      if (entry.source_id === 'MMLU_PRO') {
        appendStep(item, t('Data and preparation dependencies', '数据与准备依赖'), [...entry.prepare_extra_install, ...entry.download_example_not_executed].join('\n'));
        item.append(el('p', t("Provide ./model-tokenizer with the served tokenizer and chat template, plus ./service/runtime-contract.json from the service operator. Pin the transformers version. The base URL below excludes /v1; the service must accept token IDs at /v1/completions.",
          "提供与服务一致的 ./model-tokenizer（分词器与 chat template）和运维提供的 ./service/runtime-contract.json，并固定 transformers 版本。下方 base URL 不含 /v1；服务需支持 /v1/completions 的 token IDs。")));
      } else {
        appendStep(item, t('Copy and edit the supplied configuration templates', '复制并修改已有配置模板'), entry.configuration_steps.slice(0, 3).join('\n'),
          t("Set base_url, model, model_artifact and api_key_env in run/solver.json and run/judge.json for your services. model_artifact records the model identity. Set request, token, time and concurrency budgets, and attach service runtime details when available.",
            "在 run/solver.json、run/judge.json 中填写服务的 base_url、model、model_artifact 和 api_key_env；model_artifact 用于记录模型身份。同时设置请求、token、时间与并发预算，有服务运行记录时一并附上。"));
        item.append(code(JSON.stringify({base_url: 'https://MODEL_HOST', model: 'SERVED_MODEL_NAME', model_artifact: 'OWNER_SUPPLIED_MODEL_IDENTITY', api_key_env: 'MODEL_API_KEY'}, null, 2))); // pragma: allowlist secret - environment variable name, not a credential
        item.append(el('p', t("Replace these fields in the copied templates. Supply the API key through the named environment variable and keep the Judge response format.", "在复制的完整模板中替换以上字段，通过指定环境变量提供 API 密钥，并保留 Judge 响应格式。")));
      }
      appendStep(item, t('Prepare, run one item and summarize', '准备、运行一题并汇总'), entry.minimum_argv.map(a => a.join(' ')).join('\n'),
        t(entry.outputs, "输出包括计划、请求与回答、运行汇总；HLE 和 FrontierScience 还会生成 Judge 评分及报告。"));
      item.append(el('p', t(entry.source_id === 'MMLU_PRO' ? 'Answers are extracted locally; unparsed answers count as incorrect. Prompt and few-shot settings are documented in the client guide.' : 'Scoring uses the configured Judge and rubric. See the client guide for the method.',
        entry.source_id === 'MMLU_PRO' ? "评分采用本地答案提取，未解析答案记错；提示模板与 few-shot 配置见客户端指南。" : "评分采用配置中的 Judge 和评分策略，详细方法见客户端指南。")));
      item.append(el('p', t(entry.splits, entry.source_id === 'HLE_VERIFIED' ? 'Gold 668 / Revision 1143；默认 fetch 不含 Uncertain，示例选择 Gold。' : entry.source_id === 'FRONTIERSCIENCE' ? "Gold Olympiad 100 / Research 60；示例每次运行一道题。" : 'test 12032 / validation 70（用于 few-shot 准备）。')));
      const links = el('p', undefined, 'entry-links'); links.append(link(t('Official data and terms', '官方数据与条款'), entry.official_data), link(t('Client source', '客户端源码'), entry.client_repository), link(t('Existing results', '已有结果'), './dataset-validation.html'));
      item.append(links);
    }
  }

  function agents() {
    const root = document.getElementById('entry-agent-guides'); root.replaceChildren();
    const swe = section('SWE_BENCH_PRO', 'SWE-bench-Pro', t("Create a Coder CPU workspace from the published template, connect your model API, and run the Agent in its isolated Docker sandbox.",
      "在 Coder 中选择模板创建 CPU 工作区，连接模型 API，即可在独立 Docker 沙箱中运行 Agent。"), root);
    const sweLinks = el('p', undefined, 'entry-links');
    sweLinks.append(link(t('Coder workspace instructions', 'Coder 工作区操作说明'), AGENT_BASE + 'docs/SWE_BENCH_PRO.zh-CN.md#coder-上的执行结构docker-in-docker-沙箱'), link(t('Complete run and grading guide', '完整运行与评分指南'), AGENT_BASE + 'docs/SWE_BENCH_PRO.zh-CN.md'), link(t('Platform assistant (optional)', '平台助手（可选）'), OPS + 'references/swe-bench-pro.md'));
    swe.append(sweLinks);
    swe.append(el('p', t("Status · 2026-10-31: workspace creation and environment preparation passed with a fresh ordinary-user workspace. Agent and official grading results are recorded in the complete guide.",
      "状态 · 2026-10-31：普通用户新建工作区与环境准备已通过验证。Agent 运行结果和官方评分见完整指南。")));
    appendStep(swe, t('1. Create your Coder CPU workspace', '1. 创建自己的 Coder CPU 工作区'), null,
      t("Select swe-bench-pro-cpu in Coder, create a workspace and open its terminal. Fill in your model API and model name below. For authentication, export MODEL_API_KEY and append --api-key-env MODEL_API_KEY. The starter runs one NodeBB V1 task.",
        "在 Coder 中选择 swe-bench-pro-cpu 模板创建工作区，打开终端，填写下方的模型 API 和模型名。需要鉴权时，先设置 MODEL_API_KEY 环境变量，再追加 --api-key-env MODEL_API_KEY。入门流程运行一道 NodeBB V1 任务。"));
    appendStep(swe, t("2. Prepare the environment and run one task", "2. 准备环境并运行单题"),
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
      t("The template supplies Linux ARM64, Python and isolated Docker. Choose a new absolute work path. Omit --run to prepare the environment only; use --resume with matching settings to continue in an existing directory.",
        "模板提供 Linux ARM64、Python 和独立 Docker。使用新的绝对工作路径；省略 --run 可仅准备环境，继续已有目录时使用相同配置并加上 --resume。"));
    appendStep(swe, t('3. Inspect the Agent result, then grade the saved patch', '3. 检查 Agent 结果，再对保存的补丁独立评分'), `WORK="$HOME/swe-pro-first"
"$WORK/client/bin/python" -m vllm_hust_benchmark.swe_bench_pro grade \\
  --settings "$WORK/settings-private.json" --inputs "$WORK/inputs" \\
  --batch-directory "$WORK/run" --output "$WORK/grade-001"`,
      t("Read the task report, Agent trajectory and patch under the run directory. quality_score: null means grading is pending. The command above runs the official grader in a fresh container and saves grading-status.json, patch application details and test outputs.",
        "在 run 目录查看任务报告、Agent 轨迹和补丁；quality_score: null 表示待评分。上述命令会在新容器中运行官方评分器，保存 grading-status.json、补丁应用记录和测试输出。"));
    swe.append(el('p', t("Dataset: ScaleAI/SWE-bench_Pro v1. Task repositories and images retain their own licenses.", "数据版本：ScaleAI/SWE-bench_Pro v1。任务仓库与镜像遵循各自许可。")));
    const terminal = section('TERMINAL_BENCH_2_1', 'Terminal-Bench 2.1 / Harbor', t("Run the ARM64 OpenSSL task with Harbor. The steps below cover workspace setup, a model run and scoring.",
      "使用 Harbor 运行 ARM64 OpenSSL 单题。下方提供工作区准备、模型运行和评分步骤。"), root);
    terminal.append(el('p', t("Self-service · 2026-10-31: a new ordinary-user workspace completed setup, Agent execution and original grading. Follow the commands below to run the OpenSSL task.",
      "自助入口 · 2026-10-31：普通用户新建工作区已完成环境准备、Agent 运行和原评分器验收。按下方命令即可运行 OpenSSL 单题。")));
    const result = el('div', undefined, 'terminal-current-result'); result.id = 'terminal-current-result';
    result.append(el('h4', t('Recorded v0.18 single-task result · 2026-10-28', 'v0.18 单题记录 · 2026-10-28')));
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
    const currentLinks = el('p', undefined, 'entry-links');
    const terminalBase = AGENT_BASE;
    currentLinks.append(link(t('Complete ARM64 guide', 'ARM64 完整使用指南'), terminalBase + 'docs/TERMINAL_BENCH_ARM64.zh-CN.md'), link(t('Self-service acceptance', '新工作区验收记录'), terminalBase + 'docs/terminal-arm64-acceptance/self-service-20261031.json'), link(t('v0.18 result record', 'v0.18 结果记录'), './assets/data/terminal-arm64-acceptance-v1.json'), link(t('Ops skill', 'ops skill 运维入口'), OPS + 'SKILL.md')); result.append(currentLinks); terminal.append(result);
    appendStep(terminal, t('1. Create a Coder workspace', '1. 创建 Coder 工作区'), null,
      t('Select swe-bench-pro-cpu in Coder, choose at least 20 GiB of home storage, and open the terminal. This CPU template also supports the Terminal task and supplies isolated Docker and Python 3.12.',
        '在 Coder 中选择 swe-bench-pro-cpu 模板，家目录选择至少 20 GiB，创建后打开终端。这个 CPU 模板也支持 Terminal 单题，提供独立 Docker 和 Python 3.12。'));
    terminal.append(link(t('Open Coder', '打开 Coder'), 'https://coder.sage.org.ai:9443'));
    const download = section('terminal-arm64-download', t('2. Download the entry script', '2. 下载入口脚本'), t('Download the pinned script and verify its SHA256.', '下载固定脚本并核对 SHA256。'), terminal);
    download.append(code(`SHA=5b468a8a20750148c59f0a112f4bded579bd28abcd0908bea5356c2da6a21871 # pragma: allowlist secret
BASE=https://coder.sage.org.ai:9443/swe-bench-pro-artifacts/terminal
curl --fail --location "$BASE/$SHA/bootstrap_terminal_arm64.py" --output bootstrap_terminal_arm64.py
echo "$SHA  bootstrap_terminal_arm64.py" | sha256sum --check`));
    appendStep(terminal, t('3. Prepare the environment and check the grader', '3. 准备环境并检查评分器'),
      `RUN_DIR="$HOME/terminal-first"
BASE_IMAGE=docker.m.daocloud.io/library/python@sha256:608b27b2db85abf38d81685085cd1166a5ed7ada66549f0dfe53a75bb830cd5d # pragma: allowlist secret
python3 bootstrap_terminal_arm64.py prepare --directory "$RUN_DIR" --base-image-ref "$BASE_IMAGE"
python3 bootstrap_terminal_arm64.py controls --directory "$RUN_DIR"`,
      t('The script installs Harbor and Compose, verifies the fixed inputs, and builds the ARM64 task image through a pinned registry mirror. After READY, the controls check an empty answer and the reference solution in separate sandboxes.',
        '脚本安装 Harbor 和 Compose，校验固定输入，通过镜像源下载基础镜像并构建 ARM64 任务。出现 READY 后，正负控制会分别在新沙箱检查空答案和参考解。'));
    appendStep(terminal, t('4. Connect your model and run once', '4. 连接模型并运行一次'),
      `MODEL_API="https://MODEL_HOST/v1"
MODEL_NAME="SERVED_MODEL_NAME"
read -rsp "API key: " MODEL_API_KEY; echo
export MODEL_API_KEY
python3 bootstrap_terminal_arm64.py run --directory "$RUN_DIR" \\
  --model-api "$MODEL_API" --model-name "$MODEL_NAME" --api-key-env MODEL_API_KEY
python3 bootstrap_terminal_arm64.py status --directory "$RUN_DIR"`,
      t('Fill in your API URL and model name. If the service needs no authentication, omit the key input and replace --api-key-env MODEL_API_KEY with --no-api-key. Each run uses a new directory and executes one Agent task followed by the original grader.',
        '填写 API 地址和模型名。无需认证的服务可省略密钥输入，将 --api-key-env MODEL_API_KEY 换为 --no-api-key。每次使用新目录，运行一次 Agent 后自动进入原评分器。'));
    appendStep(terminal, t('5. Read the result', '5. 查看结果'), null,
      t('prepared.json records environment readiness. Agent trajectories are under jobs/terminal-user-model/*/agent/. Read model-receipt.json for grading: reward=1 means passed, reward=0 means failed, and null reward means unscored. Verifier logs are under jobs/terminal-user-model/*/verifier/.',
        'prepared.json 记录环境准备状态，Agent 轨迹位于 jobs/terminal-user-model/*/agent/。评分见 model-receipt.json：reward=1 为通过，reward=0 为未通过，null reward 为未评分；评分日志位于 jobs/terminal-user-model/*/verifier/。'));
    const advanced = section('terminal-advanced', t('Batch configuration and detailed methods', '批次配置与详细方法（展开）'), t("Configure a task set and compare B0/B1 runs after completing the single-task workflow.", "完成单题流程后，可按下方方法配置任务集合和 B0/B1 对比。"), terminal);
    const e = catalog.primary_entries.find(x => x.source_id === 'TERMINAL_BENCH_2_1');
    const terminalLinks = el('p', undefined, 'entry-links');
    terminalLinks.append(link(t('Original 2.1 tasks', '原 2.1 任务'), e.official_data), link(t('Existing preparation code', '已有准备程序'), AGENT_BASE + 'scripts/prepare_pyramidkv_terminal.py'), link(t('Harbor configuration', 'Harbor 配置说明'), 'https://docs.harborframework.com/jobs/configs'), link(t('Ops skill', 'ops skill 运维入口'), OPS + 'SKILL.md'));
    advanced.append(terminalLinks);
    appendStep(advanced, t('1. Ops delivers the execution workspace', '1. 由 ops 交付执行工作区'), null,
      t("Provide your platform account, target model and task scope. Ops prepares Docker + Compose, Python 3.12+, image access, persistent storage and model API connectivity. Allocate CPU, memory and disk according to task requirements.",
        "提供平台账号、目标模型和任务范围，由 ops 准备 Docker + Compose、Python 3.12+、镜像访问、持久存储和模型 API 连接，并按任务要求配置 CPU、内存和磁盘。"));
    advanced.append(el('p', t("The batch plan uses linux/amd64 images. Use a matching backend. For additional ARM64 tasks, verify each image, its dependencies, reference solution and grader.",
      "批次方案使用 linux/amd64 镜像，请选择对应架构的后端。扩展 ARM64 任务时，逐题检查镜像、依赖、参考解和评分器。")));
    const preparation = section('terminal-preparation', t('2. Fetch, verify and prepare (operator commands)', '2. 获取、校验与准备（运维命令）'), t('Run in a new private workspace. These commands prepare a candidate; they do not run model tasks.', '在新的私有工作目录执行。以下只准备候选方案，不执行模型任务。'), advanced);
    appendStep(preparation, t('Install the pinned client', '安装固定客户端'),
      `git clone https://github.com/vLLM-HUST/vllm-hust-benchmark.git\ncd vllm-hust-benchmark\ngit checkout --detach ${AGENT_REV}\npython3.12 -m venv "$HOME/terminal-client"\n. "$HOME/terminal-client/bin/activate"\npython -m pip install harbor==0.24.0\npython -m pip freeze > "$HOME/terminal-client-requirements.txt"\nharbor run --help\ndocker version\ndocker compose version`,
      t("Create a separate client environment and record its resolved dependencies and execution image.", "创建独立客户端环境，记录安装的依赖版本和执行环境镜像。"));
    appendStep(preparation, t('Retrieve the fixed task and image metadata, then generate jobs', '获取固定任务与镜像元数据，再生成 job'),
      `python scripts/fetch_pyramidkv_terminal.py --assets "$HOME/terminal-assets"\npython scripts/prepare_pyramidkv_terminal.py --assets "$HOME/terminal-assets" --output "$HOME/terminal-plan" --api-base https://MODEL_HOST/v1 --validate-harbor`,
      t("Source: terminal-bench-2-1 revision 7131e4375048a0e408a8fb404b5f499d726b695b, 89 tasks. The fetcher verifies source and image metadata. The preparer pins image digests and writes job-b0.json, job-b1.json, contract.json and source-audit/ to a new plan directory.",
        "来源：terminal-bench-2-1，版本 7131e4375048a0e408a8fb404b5f499d726b695b，共 89 道任务。获取器校验源码与镜像元数据；准备器固定镜像 digest，并在新计划目录生成 job-b0.json、job-b1.json、contract.json 和 source-audit/。"));
    appendStep(advanced, t('3. Turn the candidate into the actual run contract', '3. 将候选配置落实为本次实际运行合同'), null,
      t('Ops must edit and validate both jobs before use: actual model_name and /v1 api_base; server-proven context/input/output budgets; Agent/parser/temperature/thinking/summarization settings; attempts, concurrency and unique output directories. Inject OPENAI_API_KEY into the client environment if required, never into a URL or job file. Pull every required image by digest and verify architecture and effective resource limits.',
        'ops 使用前须修改并校验两份 job：真实 model_name 与 /v1 api_base；服务端已确认的上下文、输入和输出预算；Agent、解析器、温度、thinking、压缩策略；尝试次数、并发和独立输出目录。需要认证时将 OPENAI_API_KEY 注入客户端环境，不写入 URL 或 job。逐个按 digest 拉取所需镜像，核实架构与实际资源限额。'));
    advanced.append(el('p', t("Update the generated PyramidKV model identity and 32K/4096/100-turn settings for your service. Save the final job hashes and settings as a new run contract. Fill in actual prices for cost analysis. Use vLLM 0.18 + vLLM-Ascend 0.18 for B0, and record the tested optimization and versions for B1.",
      "按实际服务更新生成器中的 PyramidKV 模型身份和 32K/4096/100 轮设置，将最终 job 哈希及配置另存为运行记录。分析成本时填写实际价格。B0 使用 vLLM 0.18 + vLLM-Ascend 0.18，B1 记录实际优化方案与版本。")));
    const validation = section('terminal-validation', t('Job checks and single-task configurations', 'job 校验与单题配置'), t("After step 3, run from the plan directory so relative task paths resolve correctly. Start with one task to check the workflow.", "完成第 3 步后，从计划目录执行以正确解析任务相对路径，先运行一道任务检查流程。"), advanced);
    validation.append(code(`cd "$HOME/terminal-plan"\npython - <<'PY'\nimport json\nfrom pathlib import Path\nfrom harbor.models.job.config import JobConfig\nfrom harbor.agents.terminus_2.terminus_2 import Terminus2\nfor name in ('job-b0.json', 'job-b1.json'):\n    job = json.loads(Path(name).read_text())\n    JobConfig.model_validate(job)\n    Terminus2.options_model.model_validate(job['agents'][0]['kwargs'])\n    assert job['tasks'] and not job['verifier']['disable']\njob = json.loads(Path('job-b0.json').read_text())\njob.update(job_name='terminal-smoke', jobs_dir='jobs-smoke', n_attempts=1, n_concurrent_trials=1)\njob['tasks'] = job['tasks'][:1]\nwith open('job-smoke.json', 'x') as f:\n    json.dump(job, f, indent=2)\njob.update(job_name='terminal-oracle', jobs_dir='jobs-oracle', agents=[{'name': 'oracle'}])\nwith open('job-oracle.json', 'x') as f:\n    json.dump(job, f, indent=2)\njob.update(job_name='terminal-nop', jobs_dir='jobs-nop', agents=[{'name': 'nop'}])\nwith open('job-nop.json', 'x') as f:\n    json.dump(job, f, indent=2)\nPY`));
    appendStep(advanced, t('4. Validate the sandbox and verifier, then run one model task', '4. 先验证沙箱与评分器，再跑一个模型任务'),
      `cd "$HOME/terminal-plan"\nharbor run -c job-oracle.json\nharbor run -c job-nop.json\n# After inspecting both verifier artifacts:\nharbor run -c job-smoke.json`,
      t("Run oracle with the reference solution and nop with an empty answer. Check that the verifier accepts the reference and rejects the empty answer; select another negative control if needed. Then run the model task and inspect its API calls, terminal actions and verifier output. Resolve environment or verifier errors before expanding the batch.",
        "oracle 运行参考解，nop 使用空答案。检查评分器是否接受参考解、拒绝空答案，必要时更换负控制任务。随后运行模型任务，查看 API 调用、终端操作和评分输出；环境或评分器出错时先修复，再扩大批次。"));
    appendStep(advanced, t('5. Run the frozen B0/B1 batch', '5. 运行冻结的 B0/B1 批次'),
      `cd "$HOME/terminal-plan"\n# After verifying and recording the actual B0 service:\nharbor run -c job-b0.json\n# After verifying and recording the actual B1 service:\nharbor run -c job-b1.json`,
      t("For B0/B1, align task IDs, Agent, model weights, inputs, budgets, resources and scoring policy. Record configuration differences and set repetition counts and stopping rules before running. Save B0/B1 outputs separately and use a fresh sandbox for each trial.",
        "B0/B1 使用相同的任务 ID、Agent、模型权重、输入、预算、资源与评分策略。记录配置差异，运行前确定重复次数和停止规则。B0/B1 输出分开保存，每次 trial 使用新沙箱。"));
    appendStep(advanced, t('6. Accept and archive the result', '6. 验收与归档结果'), null,
      t("Archive job files and hashes, source and image versions, service details, per-trial result.json, Agent trajectories and verifier logs. Summarize coverage, scored tasks, passes, failures and errors. Compare complete B0/B1 pairs and archive redacted results in the benchmark repository.",
        "归档 job 文件及哈希、源码与镜像版本、服务配置、逐 trial result.json、Agent 轨迹和评分日志。汇总覆盖范围、已评分、通过、失败和异常数量，统计完整 B0/B1 配对，并将脱敏结果保存到 benchmark 仓库。"));
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
    const descriptions = {
      MMLU_PRO: ['Multiple-choice reasoning across academic subjects.', '跨学科多项选择与推理。'],
      HLE_VERIFIED: ['Expert-level questions with solver and judge scoring.', '专家级题目，使用 Solver 解题、Judge 评分。'],
      SWE_BENCH_PRO: ['Repository repair with an Agent and official tests.', 'Agent 修复代码仓库，使用官方测试评分。'],
      FRONTIERSCIENCE: ['Science olympiad and research questions.', '科学奥赛与研究型问答。'],
      TERMINAL_BENCH_2_1: ['Terminal tasks executed in isolated sandboxes.', '在独立沙箱中完成终端操作任务。']
    };
    for (const id of Object.keys(names)) {
      const entry = catalog.primary_entries.find(e => e.source_id === id);
      const card = el('article', undefined, 'focus-card'); card.append(el('h2', names[id]));
      card.append(link(t('Test instructions & runner →', '测试说明与执行入口 →'), '#' + id));
      card.append(link(t('Official dataset ↗', '原始数据集 ↗'), entry.official_data));
      card.append(el('p', t(...descriptions[id])));
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
      'entry-boundary-title': ['Services and integration', "服务配置"],
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
      [t('MOD integration', 'MOD 接入'), t("Configure the optimization and API on the server, then reuse the matching client with the same prompts, budgets and scoring settings.", "在服务端配置优化方案与 API，复用匹配的客户端，保持提示、预算和评分设置一致。")]
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
