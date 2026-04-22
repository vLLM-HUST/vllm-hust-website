# vllm-hust-website Copilot Instructions

## 仓库信息

| 字段     | 值                                          |
| -------- | ------------------------------------------- |
| 仓库名   | vllm-hust-website                           |
| 可见性   | **Public** (公开仓库)                       |
| 主要职责 | vllm-hust 公开展示网站 - 演示材料和营销页面 |

## 🚫 Python 环境约束（强制）

- 永远不要创建 `.venv` 或 `venv`，也不要建议用户创建。
- 永远不要执行 `python -m venv`、`uv venv`、`virtualenv`、`source .venv/bin/activate` 等命令。
- 所有测试、lint、脚本执行必须复用当前已配置的 conda 环境。
- 如需运行 Python 命令，优先使用当前已激活的 conda 环境或显式使用 `conda run -n vllm-hust ...`。
- 如果脚本默认要求创建 virtualenv，必须跳过该步骤并继续使用现有 conda 环境。

## 🎯 仓库定位

**这是 vllm-hust 项目的公开展示仓库**，用于：

1. **展示推理速度**：通过 asciinema 终端录屏展示实时推理
1. **营销材料**：功能特性、架构优势、使用场景
1. **快速入门**：CLI 命令示例、安装指南
1. **社区入口**：提供文档链接、GitHub 链接

**核心原则**：

- ✅ **仅包含演示材料** - 无源代码、无敏感信息
- ✅ **MIT 许可证** - 演示材料开源
- ✅ **独立部署** - 可通过 GitHub Pages 访问

## 📦 仓库结构

```
vllm-hust-website/
├── index.html              # 主页（渐变背景 + asciinema 播放器）
├── demos/                  # 终端录屏文件
│   └── vllm-hust-inference.cast
├── assets/                 # 图片、CSS、视频等
├── README.md               # 仓库说明
├── LICENSE                 # MIT 许可证
└── .gitignore
```

## 🚨 重要限制

### ❌ 禁止内容

1. **禁止** 包含任何源代码（Python/C++/CUDA）
1. **禁止** 包含配置文件（含敏感信息）
1. **禁止** 引用私有仓库链接
1. **禁止** 暴露内部架构细节

### ✅ 允许内容

1. **允许** asciinema 终端录屏（`.cast` 文件）
1. **允许** HTML/CSS/JavaScript（前端展示）
1. **允许** 功能特性描述（营销文案）
1. **允许** CLI 命令示例（公开命令）

## 📝 CHANGELOG 更新规则（强制）

**🚨 每次解决 issue 必须更新 CHANGELOG！**

### 更新规则

- ✅ **必须** 每次解决一个 issue 时更新 `CHANGELOG.md`
- ✅ **必须** 在 `[Unreleased]` 部分添加本次改动
- ✅ **必须** 使用正确的分类（Added/Changed/Fixed/Removed）
- ✅ **必须** 在每次 commit 前更新 CHANGELOG

**注意**：本仓库为公开展示仓库，无需 PyPI 发布，但仍需维护 CHANGELOG 以追踪网站更新历史。

### CHANGELOG 格式

遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 规范：

```markdown
## [Unreleased]

### Added
- 新增的演示或功能

### Changed
- 改动的页面或文案

### Fixed
- 修复的问题

### Removed
- 移除的内容
```

### 示例工作流

```bash
# 1. 解决 issue 并修改页面
vim index.html

# 2. 更新 CHANGELOG.md（强制！）
vim CHANGELOG.md
# 在 [Unreleased] 部分添加：
# ### Added
# - 新增性能测试演示录屏

# 3. 提交改动
git add .
git commit -m "feat: add performance demo"

# 4. 推送到 main-dev
git push origin main-dev
```

## 🎬 演示录屏规范

### 录制要求

- 使用 `asciinema` 录制终端
- 分辨率：100 列 x 24 行
- 展示内容：
  - CLI 命令执行
  - 推理速度展示
  - 流式输出效果

### 文件命名

```
demos/
├── vllm-hust-inference.cast      # 推理演示
├── vllm-hust-quickstart.cast     # 快速入门
├── vllm-hust-api-gateway.cast    # API 网关演示
└── vllm-hust-multi-model.cast    # 多模型切换
```

### 播放器配置

```javascript
AsciinemaPlayer.create("demos/xxx.cast", element, {
  cols: 100,
  rows: 24,
  autoPlay: true,
  loop: true,
  idleTimeLimit: 2, // 跳过长时间空闲
});
```

## 🎨 设计规范

### 品牌色彩

- 主色调：渐变紫色 (#667eea → #764ba2)
- 强调色：白色文字 + 半透明背景
- 卡片背景：纯白色 (#fff)

### 响应式设计

- 移动端优先
- 网格布局：`grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`
- 断点：适配手机、平板、桌面

## 📝 内容更新流程

### 添加新演示

1. 录制 `.cast` 文件（或使用脚本生成）
1. 放入 `demos/` 目录
1. 在 `index.html` 中添加播放器
1. 提交并推送到 GitHub

### 更新文案

- 直接编辑 `index.html`
- 保持专业、简洁的营销语言
- 突出国产算力适配（Huawei Ascend）

## 🚀 部署

### GitHub Pages

1. 在 GitHub 仓库 Settings → Pages
1. Source: `main` 分支，根目录
1. 访问: `https://<username>.github.io/vllm-hust-website/`

### 本地预览

```bash
# Python 简单服务器
python3 -m http.server 8000

# Node.js serve
npx serve .

# 访问 http://localhost:8000
```

## 🔗 关联仓库

| 仓库                      | 可见性      | 关系             |
| ------------------------- | ----------- | ---------------- |
| `intellistream/vllm-hust` | Public/Fork | 推理运行时主仓库 |
| `vllm-hust-website`       | Public      | 本仓库           |

## 开发规范

- 纯静态网站（HTML/CSS/JS）
- 无需构建工具（直接部署）
- 使用 CDN 加载第三方库（asciinema-player）
- 保持轻量级（首页加载 < 1MB）

## 相关文档

- **主文档仓库**：vllm-hust-docs
- **asciinema**: https://asciinema.org/
- **GitHub Pages**: https://pages.github.com/

______________________________________________________________________

## 🔄 贡献工作流程（强制）

### 工作流程步骤

**必须严格遵循以下步骤，不允许跳过：**

1. **创建 Issue** - 描述问题/需求/改进

   ```bash
   gh issue create \
     --title "[Category] 简短描述" \
     --label "enhancement" \
     --body "详细描述"
   ```

   - **必须** 添加相关的 label
   - **必须** 描述清楚问题/需求

1. **开发修复** - 在本地分支解决问题

   ```bash
   git fetch origin main-dev
   git checkout -b feature/#123-short-description origin/main-dev

   # 进行开发，确保演示材料准确完整
   ```

   - **必须** 从 `main-dev` 分支创建开发分支
   - **必须** 分支名包含 issue 号：`feature/#123-xxx`
   - **必须** 演示材料清晰、完整

1. **发起 Pull Request** - 提交代码供审查

   ```bash
   git push origin feature/#123-short-description
   gh pr create \
     --base main-dev \
     --head feature/#123-short-description \
     --title "Feature: [简短描述]"
   ```

   - **必须** 针对 `main-dev` 分支发起 PR

1. **代码审查与合并** - 等待审批后合并到 main-dev

   - **必须** 至少一名维护者审批才能合并
   - **必须** 合并到 `main-dev` 分支

______________________________________________________________________

**维护者**: IntelliStream Team **许可证**: MIT License (仅限演示材料)

## 🛠️ GitHub Issue 管理

优先使用标准 `gh` 命令管理 GitHub issues，避免继续传播旧工具名。

### 常用命令

```bash
# ⚠️ 创建新 issue（当前有 bug，建议暂时使用 gh CLI）
# Bug: sage-dev gh create 会报错但实际创建成功，导致重复 issue
# 临时方案：使用 gh issue create
gh issue create \
  --title "[Category] 描述" \
  --label "label1,label2" \
  --body "详细描述"

# 查看仓库的所有开放 issues
gh issue list --repo intellistream/{repo_name}

# 为单个 issue 分配给用户
gh issue edit <issue_number> --repo intellistream/{repo_name} --add-assignee <username>

# 批量分配 issues 给同一用户
gh issue edit <issue_number> --repo intellistream/{repo_name} --add-assignee <username>

# 查看单个 issue 的详细信息
gh issue view <issue_number> --repo intellistream/{repo_name}
```

### 详细说明

如需批量自动化，可在后续单独维护新的 dev-hub 工具说明，但不再沿用旧的 sagellm 命名。

### ⚠️ 注意事项

- 需要安装与当前工作流匹配的开发工具包
- 需要安装 GitHub CLI（`gh`）并通过认证

## Git Hooks（强制 - Mandatory）

🚨 **所有开发者必须安装 pre-commit 和 pre-push hooks，绝对不允许跳过。**

### 安装要求

1. 克隆仓库后，**第一件事**必须运行 `./quickstart.sh` 安装 Git hooks
1. 如果仓库提供 `hooks/` 目录，必须确保 `.git/hooks/pre-commit` 和 `.git/hooks/pre-push` 已正确链接或复制
1. 每次 `git commit` 和 `git push` 都必须经过 hooks 检查（ruff format / ruff check / pytest 等）

### 禁止绕过 Hooks

- ❌ **禁止** 使用 `git commit --no-verify` 或 `git push --no-verify` 跳过 hooks
- ❌ **禁止** 删除、禁用或修改 `.git/hooks/pre-commit` / `.git/hooks/pre-push`
- ❌ **禁止** 通过任何方式（环境变量、配置等）绕过 hooks 检查
- ⚠️ `--no-verify` 仅在极端特殊情况下允许（如修复 CI 基础设施本身），且必须在 commit message 中注明原因

### Copilot Agent 行为规范

- ✅ 执行 `git commit` 或 `git push` 时，**永远不要**添加 `--no-verify` 标志
- ✅ 如果 hooks 检查失败，必须先修复问题再提交，而不是绕过 hooks
- ✅ 帮助开发者设置 hooks 时，推荐运行 `./quickstart.sh`
