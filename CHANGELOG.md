# Changelog

All notable changes to sagellm-website will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- 官网首页下载区块的 DOM / i18n 标识已从 `qinglu_*` 统一清理为 `changzheng_*`，避免品牌改名后继续保留旧内部命名。
- 移除 legacy 的 `downloads/qinglu/windows/` 静态下载页、`data/qinglu_release.json` 与旧同步脚本，统一只保留长征下载链路。
- Hugging Face 自动拉取 workflow 已重命名为 `sync-changzheng-hf-release.yml`，并改为同步 `changzheng/windows` 发布目录。
- 长征 Desktop 下载清单与同步脚本中的文档仓库链接已切换到新远程 `intellistream/changzheng-desktop`，避免官网继续指向已改名的旧仓库地址。
- `hooks/pre-push` 默认不再因检测到发布凭证而自动发布；只有显式使用 `git push -o sagellm-publish origin main-dev` 或 `SAGELLM_PUBLISH_ON_PUSH=1 git push origin main-dev` 时才会触发发布。
- `hooks/post-commit` 默认不再在每次提交后自动 bump 版本；普通 `git push` 也不再触发 PyPI 版本冲突检查，只有显式发布时才会处理版本号。
- 青炉下载链路改为“qinglu-desktop 先上传到 Hugging Face dataset，website 再定时拉取到静态目录”，降低 website 对桌面仓库工作区的直接依赖。

- 同步 2026-03-09 A100 单机 `sagellm vs vllm` live compare 结果到 leaderboard 数据源，新增 `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` 的 `sagellm` 与 `vllm` 两条单机记录，并刷新 `data/last_updated.json`。
- 重构 leaderboard 展示布局，新增顶部引擎对比摘要卡片、更聚焦的主表指标，以及“只看同模型同硬件 / 隐藏缺少对比的数据”开关与 coverage 提示，使不同引擎的延迟与吞吐差异更易读。
- 首页与 leaderboard 动态内容补齐中英双语切换，覆盖摘要卡片、对比提示、详情面板、版本构建表、复制按钮与最近更新时间，确保整页语言切换一致。
- 精简首页首屏文案，移除发布横幅中的长段说明，并将 Quick Start 引导压缩为一句动作导向提示，减少首屏阅读负担。
- 进一步收敛首页信息层级：移除首屏 release banner，仅保留简洁 hero 定位语与更短的 Quick Start 辅助文案，减少视觉噪音与重复解释。
- 将首页前半段重组为更清晰的 launchpad 双栏布局：左侧 live demo，右侧紧凑 quickstart，减少连续大卡片堆叠带来的拥挤感，并继续压缩首屏说明文字。
- 首页叙事主轴调整为“科学发现大模型 + 国产硬件优先”，并将 benchmark / leaderboard / 引擎对比明确降级为验证与优化方法，而非产品主目标。
- leaderboard 过滤区新增可点击展开的 Q1-Q8 query 说明菜单，明确每类 workload 的测试意图，避免用户只看到代号而无法理解 benchmark 语义。
- Q1-Q8 query 说明菜单升级为二级 accordion：点击单个 query 单独展开并自动收起其他项，降低一次性信息展开带来的视觉干扰。

### Fixed

- **CI/CD pre-commit 错误修复**：
  - 修复 `data/validate_schema.py` 中未使用的 `jsonschema` 导入
  - 修复 `scripts/generate_cast.py` 中的单行多语句问题（E701）
  - 在 `.pre-commit-config.yaml` 中排除 `data/examples/*.json`，避免 detect-secrets 误报 git_commit 字段为密钥
  - 自动修复 f-string 格式问题和代码格式化
- **Leaderboard 详情展开布局重叠问题**：修复了点击 Details 按钮后，"Full Build Results"表格与"Component Versions"区域重叠的布局缺陷
  - 将详情展开区域从横向 grid 布局改为纵向 flex 布局，避免水平方向的挤压和重叠
  - 为 Build Variants 表格添加横向滚动支持（`overflow-x: auto`），确保在小屏幕上正确显示
  - 优化了细节展示的视觉层次：添加渐变背景、阴影效果、悬停动画等
  - 为选中的版本行添加了醒目的渐变背景和左侧边框，提升可读性
  - 改进了响应式设计，在移动端和桌面端都能提供良好的浏览体验

### Added

- 首页新增 **SageLLM Workstation 动画预览区块**，用于展示已验证的 workstation → gateway → engine 交互形态，适配启动会与官网演示场景
- 首页新增 **青炉 Desktop 下载区块**，并增加 `data/qinglu_release.json` 作为官网桌面发布入口的数据源
- 新增 `downloads/qinglu/windows/index.html` 公开下载页，以及 `scripts/sync_qinglu_release.py`，用于把 `qinglu-desktop` 的 Windows 安装包同步到 public website 静态目录

### Changed

- 官网顶部终端演示改为贴近真实 Quick Start 的安装 / 启动 / 健康检查 / 模型列表流程，并将 `scripts/generate_cast.py` 重构为可基于在线服务实时生成 cast 资源
- workstation 展示区改为更克制的纯产品展示样式，弱化动画感与宣传感，突出界面结构与基础信息布局
- 青炉下载链路由“官网 + 外部 release”调整为“官网首页摘要 + 官网静态下载页直出安装包”，并在 manifest 中预留真实 `.msi/.exe` / SHA256 列表字段

- **[#14 #15 + sagellm#26 #28] Leaderboard MVP（Schema-first）**
  - 新增并冻结 MVP 数据契约：`data/schemas/leaderboard_v1.schema.json`（兼容单条 entry 与 entry 列表）
  - 补齐最小多机展示数据：`data/leaderboard_multi.json`（1 条 multi-node 样例）
  - 首页 Leaderboard 区块新增数据模型标识，确保展示与 schema 来源一致

### Changed

- Leaderboard 前端支持多引擎展示：新增 `Engine` 筛选器，版本聚合/排序/去重改为 engine-aware（`engine + engine_version`），并对非 `sagellm` 引擎显示通用 `Engine Versions` 面板。
- `data/schemas/leaderboard_v1.schema.json` 扩展可选字段 `engine` / `engine_version`（entry 与 metadata），保持历史 `sagellm_version` 数据兼容。

- `data/validate_schema.py` 升级为可一次校验多个文件，支持 object/array 两种 payload，输出统一 pass/fail 摘要
- `data/FIELD_SPECIFICATION.md`、`data/VALIDATION_RULES.md` 收敛为 MVP 规范，字段与网站展示列一一对应
- `data/examples/*.json` 对齐硬件互联字段（补充 `interconnect`），确保示例与 schema 一致

### Fixed

- **quickstart.sh**: replace `cp hooks/pre-{commit,push}` with `ln -sf` to avoid "same file" error
  when `.git/hooks` entries are already symlinks

### Changed

- **[#14 #15] Leaderboard 内容同步**：基于 `data/results/**/**_leaderboard.json` 重新聚合
  `data/leaderboard_single.json` / `data/leaderboard_multi.json`，并刷新 `data/last_updated.json`，确保官网
  leaderboard 数据可访问且与当前结果目录一致。
- **Leaderboard 聚合脚本兼容性修复**：`scripts/aggregate_results.py` 新增字段归一化，自动对齐历史数据中的 `interconnect` /
  `intra_node_interconnect`，避免 schema 校验失败。

### Added

- CI 新增 `pytest tests/` 单元测试步骤，补齐 website 仓库的基础测试门禁。
- 新增 `tests/test_site_structure.py`，校验核心页面文件、首页关键标识和 `data/last_updated.json` 同步标记。

### Changed

- **[#22] `quickstart.sh` 安装策略统一**：确认网站仓库无 Python 包安装需求，quickstart.sh 专注于 git hooks 安装，符合统一规范

### Added

- 新增 `quickstart.sh`，执行后自动安装 `hooks/pre-commit` 与 `hooks/pre-push`
- 新增 `.github/workflows/ci.yml`，在 PR/Push 上执行 `pre-commit run --all-files`
- CI 新增 hooks 保护校验：校验 `pre-commit` / `pre-push` 包含 main 分支保护提示
- Leaderboard 增加 `Last updated` 显示（读取 `data/last_updated.json` / HF metadata）
- 新增 `data/last_updated.json` 作为 website 数据同步时间标记
- 新增 workflow 守护校验：`validate-sync-workflow.yml`，防止 `sync-hf-data.yml` 回退到 `self-hosted` 或错误 dispatch
  type
- Leaderboard 筛选新增 `Version` 下拉，自动拉取 `isagellm` 在 PyPI 上 `>=0.5.0.0` 的全部版本号用于过滤
- 首页与 README 新增 v0.5 发布意义说明文案（工程可用性）
- 新增统一版本元数据源 `data/version_meta.json`，集中维护首页发布文案、Quick Start 文案与包版本清单
- 新增首页元数据加载器 `assets/version-meta-loader.js` 与版本页渲染器 `assets/versions-page.js`
- 新增自动同步 workflow `sync-version-meta.yml`，定时/手动拉取 PyPI 最新版本并仅在变更时提交
- 新增 stale 版本检查脚本 `scripts/check_stale_versions.sh` 与 CI workflow `check-stale-versions.yml`
- 新增版本元数据维护文档 `docs/VERSION_METADATA.md`，明确单一来源、自动同步与回归检查流程
- 新增可维护的 stale 检查 allowlist 文件 `scripts/stale_version_allowlist.txt`
- 新增一致性检查脚本 `scripts/check_stale_versions.py`，校验 `version_meta` 与 `index/README/versions` 的绑定关系

### Fixed

- Leaderboard `Component Versions` 的版本对比逻辑调整：历史 benchmark 版本（低于 PyPI latest）显示为 `historical`，仅当
  benchmark 版本高于 PyPI latest 时标记 `⚠ mismatch`，避免所有历史结果都被误报不一致
- Workload 筛选改为 benchmark query 风格（`Q1`~`Q8`）并支持动态补充 legacy workload
- Leaderboard 筛选恢复 `All` 选项，支持按 `hardware/model/workload/precision` 任意组合过滤
- `sync-hf-data.yml` 的 `repository_dispatch` 事件类型改为 `benchmark-data-updated`（与 benchmark 发布流程一致）
- 修复 `sync-hf-data.yml` 被误回滚到 `self-hosted` runner 的问题，恢复为 `ubuntu-latest` 并启用 `contents: write`
- 修复 agent 指令中的命令错误（sage-dev gh → sagellm-dev gh）
- 修复页面中重复渲染两个 Performance Leaderboard 的问题（冲突残留导致重复 DOM）
- HF Data Loader 增加前端缓存（sessionStorage, TTL=5min），减少刷新时全量递归拉取导致的慢加载
- 移除 `index.html` 中脚本 URL 的硬编码版本参数，避免固定版本号带来的维护和认知问题
- 前端缓存 key 升级到 `sagellm_hf_leaderboard_cache_v2`，避免旧会话缓存导致看不到 Q1~Q8 / 新数据
- 前端缓存 key 再升级到 `sagellm_hf_leaderboard_cache_v3`，强制失效已缓存的旧少量数据
- HF Data Loader 增加 `last_updated` marker 校验：marker 变化时强制刷新数据，避免同步后继续命中旧缓存
- Leaderboard 主表新增 `Workload` 列，`all workloads` 模式下按 `Workload → Version` 排序，避免同版本多 workload
  混在一起难以识别
- Leaderboard 主表第一列版本号改为合并显示：连续相同版本仅首行显示版本编号，减少重复视觉噪音
- Leaderboard 主表移除 `Release Date` 独立列，改为在版本单元格中显示 `vX.Y.Z (release_date)`
- 趋势对比仅在单 workload 视图下启用；`all workloads` 视图禁用跨 workload 的趋势计算，避免误导
- `Component Versions` 面板改为显示 `sageLLM + benchmark + 各组件` 完整版本，并标注来源为 `entry.versions`
- `Component Versions` 面板重构为双源展示：`benchmark metadata` 与 `PyPI latest` 对比，并对不一致版本显式告警
- HF Data Loader 增加幂等键去重（`version+workload+model+hardware+precision+config`）并保留最新 `submitted_at`
  记录，降低重复上传导致的重复行和趋势噪音
- 修正命令名称：所有地方统一使用 `sagellm`（无连字符），包括演示动画和页面命令示例
- 修正架构图层级：KV Cache 从 L2 改为 L1（与 Backend/Comm 同级）
- 移除首页文案中的“3x 吞吐提升”表述，避免不准确性能宣称。
- 首页发布 banner 从 v0.4 宣传语更新为 v0.5 工程可用性说明文案
- Quick Start 区块从 v0.4 口径升级为 v0.5 口径，并统一示例命令为 `sagellm`
- `versions.html` 全量包版本与 PyPI 链接更新到最新 0.5.x 发布版本
- `versions.html` 从硬编码版本卡片改为动态读取 `version_meta.json` 渲染
- `README.md` 顶部发布文案与 Quick Start 区块改为由 `sync_version_meta.py` 按 `version_meta.json` 自动同步（单一来源）
- `sync-version-meta.yml` 改为在 `version_meta.json` 或 `README.md` 变化时才提交，避免手工漂移
- 清理 README 中的 demo 录制/嵌入说明。
- 调整架构图层级：Core/Control/Gateway 分别为 L2/L3/L4。
- Leaderboard 颜色语义优化：按指标语义统一趋势色（含高优/低优指标方向一致性）

### Added

- Ascend NPU engine implementation announcement (0.3.x release).
- Backend selection examples (`--backend ascend`).
- Updated demo recording instructions with Ascend NPU examples.

### Changed

- Leaderboard 版本展示策略更新：首页默认按聚合版本号（`X.Y.Z.x`）显示（`x`
  表示第四位合集），并在同组三位版本下自动选择表现最佳的四位版本结果；新增可展开入口查看该三位版本对应的完整四位版本明细结果。
- Leaderboard 表格版本列样式优化：`Latest`/`Baseline` 标识移动到版本号下方展示，减少横向占用，提升首页首屏完整可见性。
- 首页移动端适配增强：优化标题/容器/卡片/CTA 按钮在 `<=768px` 与 `<=480px` 的布局与间距，改善首屏可读性与触控可用性。
- Updated all PyPI package references to 0.3.x.x version.
- Enhanced 0.3 release banner: "Ascend NPU 引擎已实现".
- Updated badge: "Ascend NPU Native" (was "Ascend Optimized").
- Updated Quick Start examples with Ascend backend support.
- Updated architecture diagram: Backend box now shows "CPU/CUDA/Ascend".
- Updated demo description: "CPU/CUDA/Ascend backends available".
- Leaderboard 增强：新增 Baseline 徽章、`vs Prev`/`vs Base` 双对比指标展示与多行指标排版

### Removed

- 删除阶段性说明文档：`docs/CHANGES_SUMMARY.md`

## [0.2.0.0] - 2025-01-15

### Added

- Initial public website with architecture diagram.
- Live terminal demo using asciinema player.
- Multi-language support (English/Chinese).
- OpenAI-compatible API showcase.

### Changed

- Improved responsive design for mobile devices.

## [0.1.0.0] - 2024-12-01

### Added

- Initial website structure and landing page.
