# 贡献者数据更新

贡献统计来自公开仓库的默认分支。运行时 fork 使用组织资料库中的 fork-only 归属规则， 独立优化项目使用其默认分支提交记录。核心范围包含三个运行时仓库及官网插件工坊收录、
可公开核验的推理优化项目。默认分支历史或统计范围变化时，结果可能与旧快照不同。

更新前应在独立检出中获取远端默认分支，补全浅克隆，并确保提交和文件对象完整。 不要将未刷新的本地 main 分支当作最新数据。采集器位于组织资料库 `.github` 的
`scripts/update_contributor_leaderboard.py`。

姓名、GitHub 账号、导师和研究方向属于审核资料，不能被提交作者昵称覆盖。 新发现的作者别名应以 GitHub 提交的 author 账号核实。自动化和共用账号不参与个人排名，
身份未确认的作者也不能自动进入成员名单。历史成员及离组原因不写入公开数据。

取得统计 JSON 和采集来源 JSON 后，在网站仓库运行：

```bash
python3 scripts/refresh_contributor_snapshot.py --stats collected-contributors.json --sources collected-sources.json
python3 scripts/sync_member_roster.py --check
python3 -m pytest -q tests/test_refresh_contributor_snapshot.py tests/test_member_roster.py
```

来源 JSON 记录 `collected_at` 和 `repositories`；每个仓库记录 `repository`、`branch`、 `commit_url`，运行时 fork 还记录
`upstream_commit_url`。当前快照将这些信息保存在 `contribution_collection` 中，同时保留 `contributions_updated_at`。
快照日期不会因为再次同步较旧名册而回退。

审核合并结果后，将网站 `data/core_contributors.json` 同步到组织资料库
`profile/core_contributors.json`。本地生成数据不等于发布官网，发布仍需遵循仓库部署流程。

BetterScale 属于运行时核心仓库，不能只计入全仓库统计。2026-10-09 修正了该遗漏，并将田景远（CubeLander）归入核心成员。补入的核心统计沿用已有采集边界
`852c10663e703f853c81435d6fd89a6c8affdef3`，按采集器相同的非 merge、禁用 rename 检测和单提交 50k
行过滤规则计算；未混用之后的提交。后续更新采集器的 `INDEPENDENT_OPTIMIZATION_REPOS` 时须包含
`BetterScale`，避免重新漏掉此运行时；成员测试会阻止该归类回退。
