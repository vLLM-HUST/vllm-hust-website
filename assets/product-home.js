/* Product overview interactions are local illustrations; they never call a model. */
(function () {
  'use strict';
  const kind = document.body.dataset.page;
  const shared = {
    zh: {
      explore: '探索工作方式 ↓', stackLink: '查看产品分工 ↘', outcomeLabel: '结果',
      stackTitle: '计算、调度、记忆，各司其职。', stackMods: '三个产品均通过 MOD 扩展：执行优化、服务策略与记忆处理。', stackEngine: '高效执行推理', stackControl: '组织推理服务', stackMemory: '保存长期上下文',
      detailsTitle: '实现与规划', detailsLead: '展开查看范围与接口。', productNavigation: '产品', diagramAria: '产品架构示意', workflowAria: '工作流程', capabilitiesAria: '产品能力', detailsAria: '实现与规划',
    },
    en: {
      explore: 'Explore the workflow ↓', stackLink: 'See the product roles ↘', outcomeLabel: 'OUTCOME',
      stackTitle: 'Compute. Coordinate. Remember.', stackMods: 'MODs extend all three products: execution, service policies and memory processing.', stackEngine: 'Execute inference efficiently', stackControl: 'Coordinate inference services', stackMemory: 'Keep long-term context',
      detailsTitle: 'Implementation & direction', detailsLead: 'Expand for scope and interfaces.', productNavigation: 'Products', diagramAria: 'Illustrated product architecture', workflowAria: 'Workflow', capabilitiesAria: 'Product capabilities', detailsAria: 'Implementation and direction',
    },
  };
  const products = {
    'control-plane': {
      name: 'SAGE Control Plane',
      zh: {
        owner: '负责人：毛言粲', status: '网关与调度已有实现', titleLine1: '把请求送到', titleLine2: '合适的算力。', lead: '统一服务入口，协调模型与引擎，让每次推理各就其位。',
        diagramLabel: '服务架构', diagramNote: '架构示意', client: '应用 / Agent', coreNote: '网关 · 准入 · 路由', workerA: '模型服务', workerB: '选定实例', workerC: '模型服务',
        flowTitle: '一次请求，四步协同。', flowLead: '选择步骤，查看请求如何经过服务层。',
        step0: '接入', step1: '选路', step2: '执行', step3: '反馈',
        capTitle0: '统一入口', capText0: '认证、模型映射与流式代理。', capTitle1: '感知负载', capText1: '结合并发、健康与 KV 利用率选择实例。', capTitle2: '协调生命周期', capText2: '管理引擎注册、故障转移与扩缩容接口。',
        detailTitle0: '实现范围', detailText0: '当前实现包含 API 网关、显式模型映射、调度策略、健康管理、流式转发、追踪与聚合指标。扩缩容接口与 PD 路由属于调度边界；具体部署组合单独验证。',
        detailTitle1: '与 Engine 的接口', detailText1: 'Control Plane 读取实例健康、负载与容量信息，下发请求并接收状态。Engine 负责 token 执行、KV 管理和数据传输。',
        detailTitle2: '与 Continuum 的接口 · 规划', detailText2: '应用可从 Continuum 取得任务状态和相关记忆，组织为模型输入，再交给服务入口。记忆持久化与版本管理由 Continuum 承担。',
        flows: [
          ['GATEWAY', '一个入口接入模型服务', '验证 API key，执行准入限制，接收 Chat Completions 与 Responses 请求。', '请求进入服务系统'],
          ['ROUTING', '选择适合当前请求的实例', '显式模型请求保持模型身份；调度结合实例健康、当前负载与配置的策略。', '确定模型与目标实例'],
          ['EXECUTION', '由引擎执行，流式返回', '将请求转发给目标引擎，并把生成结果流式返回应用。Engine 管理具体计算与 KV 数据通路。', '应用持续接收生成结果'],
          ['FEEDBACK', '让运行状态回到调度层', '通过追踪、聚合指标与实例状态观察服务，并为后续调度和生命周期管理提供输入。', '更新服务视图与调度依据'],
        ],
      },
      en: {
        owner: 'Lead: Yancan Mao (毛言粲)', status: 'Gateway & scheduler implemented', titleLine1: 'The right compute.', titleLine2: 'For every request.', lead: 'One service entry point to coordinate models, engines and inference requests.',
        diagramLabel: 'Service architecture', diagramNote: 'Architecture illustration', client: 'Applications / Agents', coreNote: 'Gateway · admission · routing', workerA: 'Model serving', workerB: 'Selected instance', workerC: 'Model serving',
        flowTitle: 'One request. Four coordinated steps.', flowLead: 'Select a step to explore the serving path.',
        step0: 'Admit', step1: 'Route', step2: 'Execute', step3: 'Observe',
        capTitle0: 'One entry point', capText0: 'Authentication, model mappings and streaming proxy.', capTitle1: 'Load-aware routing', capText1: 'Use concurrency, health and KV utilization to select an instance.', capTitle2: 'Coordinated lifecycle', capText2: 'Engine registration, failover and scaling hooks.',
        detailTitle0: 'Implemented scope', detailText0: 'The implementation includes an API gateway, explicit model mappings, scheduling policies, health management, streaming, traces and aggregate metrics. Scaling hooks and PD routing belong to the scheduling boundary; individual deployment combinations are validated separately.',
        detailTitle1: 'The Engine interface', detailText1: 'Control Plane reads instance health, load and capacity, dispatches requests and receives status. Engine owns token execution, KV management and data transfer.',
        detailTitle2: 'The Continuum interface · planned', detailText2: 'An application can retrieve task state and relevant memories from Continuum, assemble model input and submit it to the service entry point. Continuum owns memory persistence and versioning.',
        flows: [
          ['GATEWAY', 'One entry point for model services', 'Verify API keys, apply admission limits and receive Chat Completions and Responses requests.', 'The request enters the serving system'],
          ['ROUTING', 'Choose an instance for this request', 'Explicit model requests retain their model identity. Scheduling uses instance health, current load and configured policies.', 'A model and target instance are selected'],
          ['EXECUTION', 'Engine executes. Tokens stream back.', 'Forward the request to the selected engine and stream its output to the application. Engine owns computation and the KV data path.', 'The application receives generated output'],
          ['FEEDBACK', 'Bring runtime state back to scheduling', 'Use traces, aggregate metrics and instance state to observe the service and inform subsequent scheduling and lifecycle management.', 'An updated service view informs scheduling'],
        ],
      },
    },
    continuum: {
      name: 'Continuum',
      zh: {
        owner: '暂任负责人：张书豪 · 招募负责人', status: '架构规划', titleLine1: '让下一次开始，', titleLine2: '接着上一次。', lead: '面向 Agent 的持久记忆与任务数据底座，连接会话、决策与工作进度。',
        diagramLabel: '跨会话的工作上下文', diagramNote: '产品设计示意', sessions: '不同会话，同一项工作', memoryA: '项目事实与约束', memoryATag: '长期记忆', memoryB: '任务进度与检查点', memoryBTag: '任务状态', memoryC: '工具结果与原始记录', memoryCTag: '来源追溯', memoryReturn: '恢复上下文，继续工作',
        flowTitle: '从一次交互，到持续记忆。', flowLead: '选择步骤，了解计划中的记忆生命周期。',
        step0: '记录', step1: '整理', step2: '取回', step3: '接续',
        capTitle0: '记得有依据', capText0: '关联事实、决策与原始来源。', capTitle1: '任务可接续', capText1: '保存进度、产物引用与恢复检查点。', capTitle2: '记忆可演进', capText2: '管理更新、冲突、过期与删除。',
        detailTitle0: '第一阶段 · 任务恢复', detailText0: '先面向长任务 Agent：保存项目约束、任务事件、工具结果和检查点，支持跨会话读取与接续。验收重点是恢复后是否保留约束、避免重复执行，以及恢复所需的时间与 token。',
        detailTitle1: '第二阶段 · 记忆组织', detailText1: '计划支持带来源的事实与决策、版本更新、检索和上下文装配。使用项目与用户作用域组织记忆，并提供明确的访问与删除接口。',
        detailTitle3: '招募 Continuum 负责人', detailText3: '由张书豪暂任负责人。招募能够推动 Agent 记忆与任务数据系统架构、实现和验证的负责人，重点包括记忆生命周期、检索与上下文组织、任务恢复及数据系统工程。', recruitLink: '通过 GitHub 联系 ↗',
        detailTitle2: '与推理服务的边界', detailText2: 'Continuum 保存可跨会话使用的信息与任务状态。Engine 管理 KV、recurrent state、分层缓存与传输；Control Plane 管理模型路由、资源分配和服务调度。',
        flows: [
          ['CAPTURE', '保留事件和原始来源', '记录会话、工具结果与任务事件，为每条记录保留所属项目、时间和来源。', '形成可追溯的原始记录'],
          ['ORGANIZE', '组织事实、决策与任务状态', '从记录中整理可复用信息，关联出处，并管理版本、冲突与有效范围。', '得到带来源的工作记忆'],
          ['RETRIEVE', '为当前任务取回相关上下文', '按用户与项目作用域检索记忆，结合当前任务和上下文预算选择需要的信息。', '装配本次任务需要的上下文'],
          ['RESUME', '从检查点继续推进', '恢复已确认的约束、完成状态和产物引用，继续执行并写入新的进度。', '工作跨会话持续推进'],
        ],
      },
      en: {
        owner: 'Interim lead: Shuhao Zhang (张书豪) · recruiting a lead', status: 'Architecture planning', titleLine1: 'Pick up where', titleLine2: 'you left off.', lead: 'Persistent memory and task data for agents. Connect sessions, decisions and work in progress.',
        diagramLabel: 'Working context across sessions', diagramNote: 'Product concept illustration', sessions: 'Different sessions. The same work.', memoryA: 'Project facts & constraints', memoryATag: 'Long-term memory', memoryB: 'Progress & checkpoints', memoryBTag: 'Task state', memoryC: 'Tool results & source records', memoryCTag: 'Provenance', memoryReturn: 'Restore context. Continue the work.',
        flowTitle: 'From one interaction to lasting memory.', flowLead: 'Select a step to explore the planned memory lifecycle.',
        step0: 'Capture', step1: 'Organize', step2: 'Retrieve', step3: 'Resume',
        capTitle0: 'Memory with sources', capText0: 'Connect facts and decisions to original records.', capTitle1: 'Work that resumes', capText1: 'Keep progress, artifact references and recovery checkpoints.', capTitle2: 'Memory that evolves', capText2: 'Manage updates, conflicts, expiry and deletion.',
        detailTitle0: 'First stage · task recovery', detailText0: 'Start with long-running agents: preserve project constraints, task events, tool results and checkpoints across sessions. Evaluate constraint retention, avoidance of repeated work, and the time and tokens needed to resume.',
        detailTitle1: 'Second stage · memory organization', detailText1: 'Planned capabilities include sourced facts and decisions, version updates, retrieval and context assembly. Organize memory by project and user scope, with explicit access and deletion interfaces.',
        detailTitle3: 'Lead Continuum', detailText3: 'Shuhao Zhang is the interim lead. We are seeking a lead to drive architecture, implementation and validation of agent memory and task data: memory lifecycle, retrieval and context assembly, task recovery, and data systems engineering.', recruitLink: 'Get in touch on GitHub ↗',
        detailTitle2: 'The inference service boundary', detailText2: 'Continuum preserves information and task state across sessions. Engine owns KV, recurrent state, tiered caching and transfer. Control Plane owns model routing, resource allocation and service scheduling.',
        flows: [
          ['CAPTURE', 'Keep events and their original sources', 'Record conversations, tool outputs and task events with project scope, timestamps and provenance.', 'Traceable original records'],
          ['ORGANIZE', 'Organize facts, decisions and task state', 'Extract reusable information, link its sources and manage versions, conflicts and validity.', 'Working memory with provenance'],
          ['RETRIEVE', 'Bring back context for this task', 'Retrieve within user and project scopes, selecting relevant memories for the task and available context budget.', 'Context assembled for the current task'],
          ['RESUME', 'Continue from a checkpoint', 'Restore confirmed constraints, completion state and artifact references, then continue and record new progress.', 'Work continues across sessions'],
        ],
      },
    },
  };
  const product = products[kind];
  if (!product) return;
  const tabs = Array.from(document.querySelectorAll('[data-step]'));
  let selected = 0;
  function render() {
    const lang = window.vllmHustSite?.getCurrentLang() === 'zh' ? 'zh' : 'en';
    const copy = {...shared[lang], ...product[lang]};
    document.title = `${product.name} · vLLM-HUST`;
    document.querySelector('meta[name="description"]').content = copy.lead;
    document.querySelectorAll('[data-copy]').forEach(element => { element.textContent = copy[element.dataset.copy]; });
    document.querySelectorAll('[data-copy-aria]').forEach(element => { element.setAttribute('aria-label', copy[element.dataset.copyAria]); });
    const [tag, heading, text, outcome] = copy.flows[selected];
    document.getElementById('flow-tag').textContent = `0${selected + 1} / ${tag}`;
    document.getElementById('flow-heading').textContent = heading;
    document.getElementById('flow-text').textContent = text;
    document.getElementById('flow-outcome').textContent = outcome;
    document.getElementById('flow-panel').setAttribute('aria-labelledby', `flow-tab-${selected}`);
    tabs.forEach((tab, index) => {
      tab.setAttribute('aria-selected', String(index === selected));
      tab.tabIndex = index === selected ? 0 : -1;
    });
    document.body.dataset.productReady = 'true';
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { selected = index; render(); });
    tab.addEventListener('keydown', event => {
      const next = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
      if (next === undefined) return;
      event.preventDefault(); selected = next; render(); tabs[next].focus();
    });
  });
  window.addEventListener('vllm-hust:langchange', render);
  render();
}());
