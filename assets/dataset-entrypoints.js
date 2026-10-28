(function () {
  'use strict';
  const REV = '07628b9b5b32d0de37dd3b6fa3bc48d350d8ed71'; // pragma: allowlist secret - public source revision
  const BASE = `https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/${REV}/`;
  let catalog;
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
      'Python 3.10+, Git and an isolated local environment. The shared package indexes, verifies and reads original files; it does not turn every source into a common evaluation protocol. Keep data outside the repository. Commands below are for your own authorized run, not new measurements performed by this page.',
      '需要 Python 3.10+、Git 和独立本地环境。共用组件负责索引、校验与读取原文件，不把所有来源变成同一种评测。数据放在仓库外。以下命令供用户获授权后自行运行，本页发布没有新增测量。');
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
    const swe = section('SWE_BENCH_PRO', 'SWE-bench-Pro', t('An Agent edits a repository inside an authorized isolated CPU/Docker workspace. A model API alone is not a task sandbox. Use the administrator-provided template or your own authorized sandbox, not the model host Docker socket.',
      'Agent 在获授权的独立 CPU/Docker 工作区修改仓库。模型 API 不等于任务沙箱；使用管理员提供的模板或自有获授权沙箱，不使用模型宿主机 Docker socket。'), root);
    appendStep(swe, t('Pinned bootstrap, then one explicit run', '固定 bootstrap，然后显式运行'),
      `curl --fail --location -H 'Accept: application/vnd.github.raw+json' 'https://api.github.com/repos/vLLM-HUST/vllm-hust-benchmark/contents/scripts/bootstrap_swe_bench_pro.py?ref=${REV}' --output bootstrap_swe_bench_pro.py\npython3 bootstrap_swe_bench_pro.py --source-revision ${REV} --work "$HOME/swe-pro-first" --model-api https://MODEL_HOST/v1 --model-name openai/SERVED_MODEL_NAME --api-key-env MODEL_API_KEY --run`,
      t('Linux ARM64, Python 3.10+, an isolated Docker daemon, reachable pinned dataset/task images and sufficient disk are required. Use a new absolute private work path. Omitting --run prepares only; an existing owned directory needs --resume with the same identity. Submission and official grading are separate; a submitted patch is not a passing score.',
        '需要 Linux ARM64、Python 3.10+、隔离 Docker daemon、可访问的固定数据/任务镜像和足够磁盘。使用新的绝对私有工作路径；省略 --run 只准备，已有目录需以同身份 --resume。提交与官方评分分开，有 patch 不代表判对。'));
    swe.append(link(t('Sandbox setup, outputs and official grading', '沙箱设置、产物与官方评分'), BASE + 'docs/SWE_BENCH_PRO.zh-CN.md'));
    swe.append(el('p', t('Dataset: ScaleAI/SWE-bench_Pro v1, not SWE-bench Verified or V2. Task repositories and images retain their own licenses.', '数据为 ScaleAI/SWE-bench_Pro v1，不是 SWE-bench Verified 或 V2；任务仓库与镜像遵循各自许可。')));
    const terminal = section('TERMINAL_BENCH_2_1', 'Terminal-Bench 2.1 / Harbor', t('Original task execution, tool environment and verifier, not a static prompt replay. There is no reviewed universal ARM64 2.1 job/bootstrap for ordinary users in this directory.',
      '原任务执行、工具环境和 verifier，不是静态 prompt 回放。当前目录没有已审核的通用 ARM64 2.1 普通用户 job/bootstrap。'), root);
    const e = catalog.primary_entries.find(x => x.source_id === 'TERMINAL_BENCH_2_1');
    appendStep(terminal, t('Install and run an operator-supplied job', '安装并运行运维提供的真实 job'), [...e.install_posix, e.minimum_user_command].join('\n'),
      t('Required job.json must bind the original 2.1 task directory/image, Agent, model endpoint, resources and output. Check each image architecture and task setup; preserve task/test budgets. This page does not supply that private job. Do not substitute the Harbor README 2.0 example for 2.1.',
        'job.json 必须绑定原 2.1 任务目录/镜像、Agent、模型地址、资源和输出；逐题核镜像架构与依赖，保留任务/测试预算。本页不提供该私有 job，不把 Harbor README 的 2.0 示例替代 2.1。'));
    terminal.append(link(t('Harbor configuration documentation', 'Harbor 配置文档'), e.client_document), el('span', ' · '), link(t('Original 2.1 tasks', '原 2.1 任务'), e.official_data));
    terminal.append(el('p', t('Expected: Harbor trial logs, task completion/error and verifier artifacts when the verifier runs. A missing/null reward is not zero or a passing task.', '预期产物为 Harbor trial 日志、任务完成/错误及实际 verifier 产物；缺失/null reward 不能记作 0 或任务通过。')));
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
      [t('Platform submission', '平台提交 API'), t('BLOCKED_NOT_INTEGRATED: ordinary-user production identity is not connected. The local Unix test component is not a public multi-user submission service.', 'BLOCKED_NOT_INTEGRATED：普通用户生产身份链路未接通。本地 Unix 测试组件不是公开多用户提交服务。')],
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
  fetch('./assets/data/dataset-entrypoints-v1.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(data => {
    if (data.schema !== 'dataset-entrypoints/v1' || data.sources.length !== 118) throw new Error('Catalog identity mismatch');
    catalog = data; render();
  }).catch(error => {
    console.error('Public catalog could not be rendered', error);
    text('entry-load-status', 'Catalog could not be loaded. The JSON and existing results links remain available; no execution was started.', '目录加载失败，可通过 JSON 与已有结果链接读取；未启动任何执行。');
  });
}());
