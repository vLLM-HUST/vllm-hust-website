(function () {
  'use strict';
  const list = document.getElementById('systems-list');
  if (!list) return;
  window.vllmHustPageDict = {
    en: { title: 'External Systems | vLLM-HUST', 'footer-copy': 'Connected systems for domestic-compute inference.' },
    zh: { title: '外部系统 | vLLM-HUST', 'footer-copy': '面向国产算力推理的外部系统生态。' }
  };
  // Editorial integration notes; lifecycle and evidence remain registry-owned.
  const profiles = {
    'triton-ascend-hust': {
      use: ['Compiler and kernel infrastructure for Ascend, maintained as a fork of official Triton Ascend.', '面向昇腾的编译器与算子基础设施，作为官方 Triton Ascend 的 HUST 分支维护。'],
      integration: ['Connects through Triton language and the Ascend compiler backend in the runtime platform stack.', '通过 Triton language 与 Ascend 编译后端接入运行时平台栈。'],
      note: ['This is compiler infrastructure. Follow the repository build and compatibility instructions for the target platform.', '该项目是编译器基础设施；请按仓库说明选择目标平台的构建与兼容组合。']
    },
    'prefix-router-migration': {
      use: ['A prefix-aware external request router, being migrated with a narrow cache-event adapter.', '前缀感知的外部请求路由器，正在与窄幅缓存事件适配器一起迁移。'],
      integration: ['Consumes KV events and routes OpenAI-compatible HTTP requests outside the inference engine.', '在推理引擎之外消费 KV 事件，并路由 OpenAI 兼容 HTTP 请求。'],
      note: ['Migration scaffold only; no installable release is recorded. Historical evidence does not verify the migrated implementation.', '目前仅有迁移仓库，尚未记录可安装发行版；历史证据不代表迁移后的实现已经验证。']
    },
    pegaflow: {
      use: ['Shared KV state across inference instances, with storage, transfer and metadata services.', '通过存储、传输与元数据服务，为推理实例提供共享 KV 状态。'],
      integration: ['PegaKVConnector connects vLLM to a separately operated PegaFlow service.', '通过 PegaKVConnector，将 vLLM 连接到独立运行的 PegaFlow 服务。'],
      note: ['The HUST Ascend path builds from source. Published upstream CUDA packages and H800 results do not establish HUST Ascend support or performance.', 'HUST Ascend 路径使用源码构建；上游 CUDA 安装包和 H800 结果不代表 HUST Ascend 的支持或性能。'],
      bridge: 'pegaflow-vllm-connectors'
    },
    mooncake: {
      use: ['Shared KV storage and transfer for serving systems that separate cache services from inference workers.', '为缓存服务与推理 worker 分离的部署提供共享 KV 存储和数据传输。'],
      integration: ['The official vLLM MooncakeStoreConnector connects the runtime to the Mooncake service.', '通过官方 vLLM MooncakeStoreConnector 连接 Mooncake 服务。'],
      note: ['The HUST fork follows upstream. Select the transport and platform build described in its deployment documentation.', 'HUST 分支跟随上游；按部署文档选择对应平台的构建与传输路径。'],
      bridge: 'mooncake-vllm-connectors'
    },
    'vllm-production-stack': {
      use: ['Kubernetes-native deployment and request routing for a cluster of vLLM serving instances.', '面向多个 vLLM 服务实例，提供 Kubernetes 原生部署与请求路由。'],
      integration: ['Helm values and Kubernetes APIs configure the external cluster control plane.', '通过 Helm values 和 Kubernetes API 配置外部集群控制面。'],
      note: ['The HUST fork carries an arm64 distribution path and focused integration changes; consult the fork guide for scope.', 'HUST 分支承载 arm64 发布路径与必要集成改动；具体范围见分支维护说明。']
    }
  };
  const labels = {
    compiler: ['Compiler & kernels', '编译器与算子'], other: ['Other system', '其他系统'], legacy_evidence: ['Historical evidence only', '仅历史证据'], in_process: ['In-process platform stack', '进程内平台栈'], migration: ['Migration scaffold', '迁移阶段'],
    all: ['All systems', '全部系统'], kv: ['KV service', 'KV 服务'], control: ['Control plane', '控制面'],
    supported: ['Supported', '已支持'], incubating: ['Incubating', '孵化中'], concept: ['Concept', '概念阶段'],
    experimental: ['Experimental', '实验阶段'], integration_tested: ['Integration tested', '已完成集成测试'],
    descriptor_only: ['Descriptor only', '仅描述定义'], distributed_service: ['Distributed service', '分布式服务'],
    kubernetes: ['Kubernetes cluster', 'Kubernetes 集群'], separate_application: ['Separate application', '独立应用'],
    evidence: ['Registry evidence', '目录证据等级'], integration: ['Connect to vLLM-HUST', '接入 vLLM-HUST'],
    topology: ['Deployment', '部署形态'], repository: ['Repository ↗', '系统仓库 ↗'],
    docs: ['Deployment guide ↗', '部署文档 ↗'], upstream: ['Upstream ↗', '官方上游 ↗'],
    connector: ['Connector source ↗', 'Connector 源码 ↗'],
    conceptNote: ['No public system repository is recorded. This is an architectural direction, not an available service.', '尚未登记公开系统仓库；当前为架构方向，尚非可用服务。'],
    empty: ['No systems match. Try another search or clear the filters.', '没有匹配的系统，请更换关键词或清除筛选。'],
    failed: ['The system directory could not be loaded. Reload this page or open the ecosystem registry below.', '系统目录加载失败。请刷新页面，或打开下方生态目录查看。'],
    loading: ['Loading systems…', '正在加载系统…']
  };
  const search = document.getElementById('systems-search');
  const status = document.getElementById('systems-status');
  const reset = document.getElementById('systems-reset');
  const concepts = document.getElementById('systems-concepts');
  const buttons = [...document.querySelectorAll('[data-system-filter]')];
  let components = null;
  let failed = false;
  let selected = 'all';
  const zh = () => document.documentElement.lang.startsWith('zh');
  const text = (pair) => pair[zh() ? 1 : 0];
  const label = (key) => labels[key] ? text(labels[key]) : key;
  const category = (item) => ({ control_plane: 'control', request_router: 'control', kv_store: 'kv', kv_state_manager: 'kv', compiler_runtime: 'compiler' }[item.system_role] || 'other');
  const isExploratory = (item) => item.maturity === 'concept' || !item.canonical_repository || item.delivery_model === 'migration_scaffold';
  function node(tag, className, content) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (content) result.textContent = content;
    return result;
  }
  function link(title, url) {
    const result = node('a', '', title);
    result.href = url;
    return result;
  }
  function card(item) {
    const profile = profiles[item.id];
    const article = node('article', 'system-card');
    article.id = item.id;
    article.setAttribute('aria-labelledby', `${item.id}-title`);
    const top = node('div', 'system-card-top');
    top.append(node('span', 'system-category', label(category(item))), node('span', `system-badge ${item.maturity}`, label(item.delivery_model === 'migration_scaffold' ? 'migration' : item.maturity)));
    const heading = node('h3', '', item.name);
    heading.id = `${item.id}-title`;
    article.append(top, heading);
    if (item.canonical_repository) article.append(node('div', 'system-repo-name', item.canonical_repository.split('/').pop()));
    article.append(node('p', 'system-description', profile ? text(profile.use) : item[zh() ? 'summary_zh' : 'summary_en']));
    if (!item.canonical_repository) {
      article.append(node('p', 'system-note', label('conceptNote')), node('p', 'system-note', `${label('evidence')}: ${label(item.evidence_level)}`));
      return article;
    }
    const facts = node('dl');
    const rows = [
      ['integration', profile ? text(profile.integration) : (item.integration_contracts.join(' · ') || '—')],
      ['topology', label(item.deployment_topology)],
      ['evidence', label(item.evidence_level)]
    ];
    rows.forEach(([key, value]) => {
      const row = node('div');
      row.append(node('dt', '', label(key)), node('dd', '', value));
      facts.append(row);
    });
    article.append(facts);
    if (profile) article.append(node('p', 'system-note', text(profile.note)));
    const links = node('div', 'system-links');
    if (item.canonical_repository) {
      links.append(link(label('repository'), item.canonical_repository), link(label('docs'), `${item.canonical_repository}#readme`));
    }
    if (item.upstream_repository) links.append(link(label('upstream'), item.upstream_repository));
    const bridge = components.find((entry) => entry.id === profile?.bridge);
    if (bridge?.canonical_repository && bridge.canonical_repository !== item.canonical_repository) links.append(link(label('connector'), bridge.canonical_repository));
    article.append(links);
    return article;
  }
  function render() {
    document.querySelector('.systems-filters').setAttribute('aria-label', zh() ? '系统分类' : 'System category');
    buttons.forEach((button) => { button.disabled = !components; });
    search.disabled = !components;
    if (!components) {
      status.textContent = label(failed ? 'failed' : 'loading');
      return;
    }
    const query = search.value.trim().toLowerCase();
    const external = components.filter((item) => item.artifact_type === 'external_system');
    const published = external.filter((item) => !isExploratory(item));
    published.sort((a, b) => (a.id === 'pegaflow' ? -1 : b.id === 'pegaflow' ? 1 : a.name.localeCompare(b.name)));
    const visible = published.filter((item) => {
      const searchable = [item.name, item.canonical_repository, item.summary_en, item.summary_zh, item.system_role, item.deployment_topology, ...Object.values(profiles[item.id] || {}).flat()].join(' ').toLowerCase();
      return (selected === 'all' || selected === category(item)) && searchable.includes(query);
    });
    list.replaceChildren(...visible.map(card));
    status.textContent = visible.length ? (zh() ? `显示 ${visible.length} / ${published.length} 个系统` : `Showing ${visible.length} / ${published.length} systems`) : label('empty');
    reset.hidden = visible.length > 0;
    concepts.replaceChildren(...external.filter(isExploratory).map(card));
  }
  function select(value) {
    selected = value;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.systemFilter === value)));
    render();
  }
  buttons.forEach((button) => button.addEventListener('click', () => select(button.dataset.systemFilter)));
  search.addEventListener('input', render);
  reset.addEventListener('click', () => { search.value = ''; select('all'); search.focus(); });
  // Map links also restore filtered-out destinations before scrolling.
  document.querySelectorAll('.systems-map a').forEach((anchor) => anchor.addEventListener('click', () => { search.value = ''; select('all'); }));
  window.addEventListener('vllm-hust:langchange', render);
  render();
  fetch(list.dataset.source).then((response) => {
    if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
    return response.json();
  }).then((registry) => {
    if (!Array.isArray(registry.components)) throw new Error('Invalid ecosystem registry');
    components = registry.components;
    render();
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.classList.contains('system-card')) target.scrollIntoView();
  }).catch(() => { components = null; failed = true; render(); });
}());
