/* Product overview interactions are local illustrations; they never call a model. */
(function () {
  'use strict';
  const kind = document.body.dataset.page;
  const shared = {
  "zh": {
    "explore": "探索工作方式 ↓",
    "stackLink": "查看产品分工 ↘",
    "outcomeLabel": "结果",
    "stackTitle": "执行、调度、工作环境，各司其职。",
    "stackMods": "三个产品均通过 MOD 扩展：执行优化、服务策略、上下文与沙箱。",
    "stackEngine": "高效执行推理",
    "stackControl": "组织推理服务",
    "stackMemory": "接续任务与工作环境",
    "detailsTitle": "实现与规划",
    "detailsLead": "展开查看范围与接口。",
    "productNavigation": "产品",
    "diagramAria": "产品架构示意",
    "workflowAria": "工作流程",
    "capabilitiesAria": "产品能力",
    "detailsAria": "实现与规划"
  },
  "en": {
    "explore": "Explore the workflow ↓",
    "stackLink": "See the product roles ↘",
    "outcomeLabel": "OUTCOME",
    "stackTitle": "Execute. Coordinate. Continue.",
    "stackMods": "MODs extend all three products: execution, service policies, context and sandboxes.",
    "stackEngine": "Execute inference efficiently",
    "stackControl": "Coordinate inference services",
    "stackMemory": "Continue tasks and their workspaces",
    "detailsTitle": "Implementation & direction",
    "detailsLead": "Expand for scope and interfaces.",
    "productNavigation": "Products",
    "diagramAria": "Illustrated product architecture",
    "workflowAria": "Workflow",
    "capabilitiesAria": "Product capabilities",
    "detailsAria": "Implementation and direction"
  }
};
  const products = {
  "control-plane": {
    "name": "SAGE Control Plane",
    "zh": {
      "owner": "负责人：毛言粲",
      "status": "网关与调度已有实现",
      "titleLine1": "把请求送到",
      "titleLine2": "合适的算力。",
      "lead": "统一服务入口，协调模型与引擎，让每次推理各就其位。",
      "diagramLabel": "服务架构",
      "diagramNote": "架构示意",
      "client": "应用 / Agent",
      "coreNote": "网关 · 准入 · 路由",
      "workerA": "模型服务",
      "workerB": "选定实例",
      "workerC": "模型服务",
      "flowTitle": "一次请求，四步协同。",
      "flowLead": "选择步骤，查看请求如何经过服务层。",
      "step0": "接入",
      "step1": "选路",
      "step2": "执行",
      "step3": "反馈",
      "capTitle0": "统一入口",
      "capText0": "认证、模型映射与流式代理。",
      "capTitle1": "感知负载",
      "capText1": "结合并发、健康与 KV 利用率选择实例。",
      "capTitle2": "协调生命周期",
      "capText2": "管理引擎注册、故障转移与扩缩容接口。",
      "detailTitle0": "实现范围",
      "detailText0": "RTC 是服务控制的请求限流与程序调度组件。当前实现包含 API 网关、显式模型映射、调度策略、健康管理、流式转发、追踪与聚合指标。扩缩容接口与 PD 路由属于调度边界；具体部署组合单独验证。",
      "detailTitle1": "与 Engine 的接口",
      "detailText1": "Control Plane 读取实例健康、负载与容量信息，下发请求并接收状态。Engine 负责 token 执行、KV 管理和数据传输。",
      "detailTitle2": "与 Continuum 的接口 · 规划",
      "detailText2": "Control Plane 负责资源分配与服务调度；Continuum 负责上下文、文件、沙箱环境和任务检查点的保存与恢复。应用组织好上下文后，经服务入口调用 Engine。",
      "flows": [
        [
          "GATEWAY",
          "一个入口接入模型服务",
          "验证 API key，执行准入限制，接收 Chat Completions 与 Responses 请求。",
          "请求进入服务系统"
        ],
        [
          "ROUTING",
          "选择适合当前请求的实例",
          "显式模型请求保持模型身份；调度结合实例健康、当前负载与配置的策略。",
          "确定模型与目标实例"
        ],
        [
          "EXECUTION",
          "由引擎执行，流式返回",
          "将请求转发给目标引擎，并把生成结果流式返回应用。Engine 管理具体计算与 KV 数据通路。",
          "应用持续接收生成结果"
        ],
        [
          "FEEDBACK",
          "让运行状态回到调度层",
          "通过追踪、聚合指标与实例状态观察服务，并为后续调度和生命周期管理提供输入。",
          "更新服务视图与调度依据"
        ]
      ]
    },
    "en": {
      "owner": "Lead: Yancan Mao (毛言粲)",
      "status": "Gateway & scheduler implemented",
      "titleLine1": "The right compute. ",
      "titleLine2": "For every request.",
      "lead": "One service entry point to coordinate models, engines and inference requests.",
      "diagramLabel": "Service architecture",
      "diagramNote": "Architecture illustration",
      "client": "Applications / Agents",
      "coreNote": "Gateway · admission · routing",
      "workerA": "Model serving",
      "workerB": "Selected instance",
      "workerC": "Model serving",
      "flowTitle": "One request. Four coordinated steps.",
      "flowLead": "Select a step to explore the serving path.",
      "step0": "Admit",
      "step1": "Route",
      "step2": "Execute",
      "step3": "Observe",
      "capTitle0": "One entry point",
      "capText0": "Authentication, model mappings and streaming proxy.",
      "capTitle1": "Load-aware routing",
      "capText1": "Use concurrency, health and KV utilization to select an instance.",
      "capTitle2": "Coordinated lifecycle",
      "capText2": "Engine registration, failover and scaling hooks.",
      "detailTitle0": "Implemented scope",
      "detailText0": "RTC is the request-throttling and program-scheduling component of Control Plane. The implementation includes an API gateway, explicit model mappings, scheduling policies, health management, streaming, traces and aggregate metrics. Scaling hooks and PD routing belong to the scheduling boundary; individual deployment combinations are validated separately.",
      "detailTitle1": "The Engine interface",
      "detailText1": "Control Plane reads instance health, load and capacity, dispatches requests and receives status. Engine owns token execution, KV management and data transfer.",
      "detailTitle2": "The Continuum interface · planned",
      "detailText2": "Control Plane allocates resources and schedules services. Continuum preserves and restores context, files, sandbox environments and task checkpoints. Applications assemble context and call Engine through the service entry point.",
      "flows": [
        [
          "GATEWAY",
          "One entry point for model services",
          "Verify API keys, apply admission limits and receive Chat Completions and Responses requests.",
          "The request enters the serving system"
        ],
        [
          "ROUTING",
          "Choose an instance for this request",
          "Explicit model requests retain their model identity. Scheduling uses instance health, current load and configured policies.",
          "A model and target instance are selected"
        ],
        [
          "EXECUTION",
          "Engine executes. Tokens stream back.",
          "Forward the request to the selected engine and stream its output to the application. Engine owns computation and the KV data path.",
          "The application receives generated output"
        ],
        [
          "FEEDBACK",
          "Bring runtime state back to scheduling",
          "Use traces, aggregate metrics and instance state to observe the service and inform subsequent scheduling and lifecycle management.",
          "An updated service view informs scheduling"
        ]
      ]
    }
  },
  "continuum": {
    "name": "Continuum · Agent Workspace",
    "zh": {
      "owner": "暂任负责人：张书豪 · 招募负责人",
      "status": "架构规划",
      "titleLine1": "让下一次开始，",
      "titleLine2": "接着上一次。",
      "lead": "面向 Agent 的持续工作环境，统一上下文与记忆、文件与产物、沙箱和任务恢复。",
      "diagramLabel": "一项任务，完整工作环境",
      "diagramNote": "产品设计示意",
      "sessions": "跨会话、跨中断，接续同一项工作",
      "memoryA": "上下文与长期记忆",
      "memoryATag": "事实与约束",
      "memoryB": "文件与工具产物",
      "memoryBTag": "来源与版本",
      "memoryC": "沙箱与执行环境",
      "memoryCTag": "隔离与复用",
      "memoryReturn": "恢复上下文、文件与环境，继续工作",
      "flowTitle": "从启动任务，到保存与接续。",
      "flowLead": "选择步骤，了解规划中的工作环境生命周期。",
      "step0": "取回上下文",
      "step1": "准备环境",
      "step2": "执行工具",
      "step3": "保存与恢复",
      "capTitle0": "上下文与记忆",
      "capText0": "组织事实、决策与任务约束，保留来源和版本。",
      "capTitle1": "沙箱与工具",
      "capText1": "管理隔离的文件与执行环境，探索预热和复用。",
      "capTitle2": "检查点与恢复",
      "capText2": "关联上下文、文件、环境与进度，从中断处接续。",
      "detailTitle0": "第一阶段 · 任务与环境恢复",
      "detailText0": "先打通长任务 Agent 的保存与恢复：关联项目约束、任务事件、文件产物和沙箱检查点。验证恢复后的任务状态与环境是否一致，是否避免重复执行，并记录恢复时间、token 和环境启动开销。",
      "detailTitle1": "第二阶段 · 记忆与沙箱优化",
      "detailText1": "计划支持带来源的记忆检索与上下文装配，以及沙箱预热、环境复用、快照与按需恢复。复用必须保留项目和用户隔离、环境版本及清理规则；以端到端任务时延、恢复成本和资源占用验证效果。",
      "detailTitle3": "招募 Continuum 负责人",
      "detailText3": "由张书豪暂任负责人。招募能够推动 Agent 工作环境架构、实现和验证的负责人，重点包括上下文与记忆、沙箱生命周期与优化、文件和产物管理、检查点与任务恢复。",
      "recruitLink": "通过 GitHub 联系 ↗",
      "detailTitle2": "与推理服务的边界",
      "detailText2": "Continuum 管理任务上下文、记忆、文件、工具产物与沙箱的保存和恢复。Engine 管理 token 执行、KV、分层缓存和传输；Control Plane 负责资源分配、模型路由与服务调度。沙箱的具体执行后端与资源供给通过接口接入。",
      "flows": [
        [
          "CONTEXT",
          "取回任务上下文",
          "按用户与项目作用域读取记忆、已确认约束、任务进度和文件引用，装配当前任务需要的上下文。",
          "得到有来源的任务起点"
        ],
        [
          "ENVIRONMENT",
          "准备任务的执行环境",
          "创建或恢复隔离的沙箱，关联文件、工具与环境版本。计划探索预热和复用，减少重复准备开销。",
          "获得匹配任务的工作环境"
        ],
        [
          "TOOLS",
          "执行工具，记录产物",
          "Agent 调用工具并向推理服务提交模型请求，记录工具结果、文件变化及其来源；模型执行仍由 Engine 承担。",
          "形成可追溯的任务进展"
        ],
        [
          "RESUME",
          "保存检查点，继续工作",
          "将上下文、文件、环境与进度关联保存；中断后恢复相应状态，继续推进并记录恢复开销。",
          "任务连同环境一起接续"
        ]
      ],
      "memoryD": "任务检查点",
      "memoryDTag": "保存与恢复"
    },
    "en": {
      "owner": "Interim lead: Shuhao Zhang (张书豪) · recruiting a lead",
      "status": "Architecture planning",
      "titleLine1": "Pick up where ",
      "titleLine2": "you left off.",
      "lead": "A persistent workspace for agents: context and memory, files and artifacts, sandboxes and task recovery.",
      "diagramLabel": "One task. A complete workspace.",
      "diagramNote": "Product concept illustration",
      "sessions": "Continue the same work across sessions and interruptions.",
      "memoryA": "Context & long-term memory",
      "memoryATag": "Facts & constraints",
      "memoryB": "Files & tool artifacts",
      "memoryBTag": "Sources & versions",
      "memoryC": "Sandbox & execution environment",
      "memoryCTag": "Isolation & reuse",
      "memoryReturn": "Restore context, files and environment. Continue.",
      "flowTitle": "Start a task. Save it. Continue.",
      "flowLead": "Select a step to explore the planned workspace lifecycle.",
      "step0": "Context",
      "step1": "Environment",
      "step2": "Tools",
      "step3": "Save & resume",
      "capTitle0": "Context & memory",
      "capText0": "Organize facts, decisions and constraints with sources and versions.",
      "capTitle1": "Sandboxes & tools",
      "capText1": "Manage isolated files and execution environments; explore warmup and reuse.",
      "capTitle2": "Checkpoints & recovery",
      "capText2": "Link context, files, environment and progress to resume interrupted work.",
      "detailTitle0": "First stage · task and environment recovery",
      "detailText0": "Connect project constraints, task events, file artifacts and sandbox checkpoints for long-running agents. Validate consistent task state and environments after recovery, avoidance of repeated execution, and recovery time, tokens and environment startup costs.",
      "detailTitle1": "Second stage · memory and sandbox optimization",
      "detailText1": "Plan sourced memory retrieval and context assembly alongside sandbox warmup, environment reuse, snapshots and on-demand restore. Reuse must retain project and user isolation, environment versions and cleanup rules. Evaluate end-to-end task latency, recovery costs and resource use.",
      "detailTitle3": "Lead Continuum",
      "detailText3": "Shuhao Zhang is the interim lead. We are seeking a lead to drive agent workspace architecture, implementation and validation: context and memory, sandbox lifecycle and optimization, files and artifacts, checkpoints and task recovery.",
      "recruitLink": "Get in touch on GitHub ↗",
      "detailTitle2": "The inference service boundary",
      "detailText2": "Continuum preserves and restores task context, memory, files, tool artifacts and sandboxes. Engine owns token execution, KV, tiered caching and transfer. Control Plane allocates resources, routes models and schedules services. Sandbox execution backends and resource supply connect through interfaces.",
      "flows": [
        [
          "CONTEXT",
          "Retrieve the task context",
          "Read scoped memories, confirmed constraints, task progress and file references. Assemble the context needed for the current task.",
          "A task starting point with sources"
        ],
        [
          "ENVIRONMENT",
          "Prepare the execution environment",
          "Create or restore an isolated sandbox and connect files, tools and environment versions. Planned warmup and reuse reduce repeated setup.",
          "A workspace matched to the task"
        ],
        [
          "TOOLS",
          "Run tools and record artifacts",
          "The agent calls tools and submits model requests through the serving layer. Record tool outputs, file changes and sources. Engine still executes the model.",
          "Traceable task progress"
        ],
        [
          "RESUME",
          "Save a checkpoint. Continue the work.",
          "Associate context, files, environment and progress in checkpoints. Restore the matching state after an interruption and record recovery costs.",
          "The task resumes with its workspace"
        ]
      ],
      "memoryD": "Task checkpoints",
      "memoryDTag": "Save & restore"
    }
  }
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
