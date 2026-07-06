# vLLM-HUST Website / Upstream / Twin Roadmap

Last updated: 2026-07-06 14:30 CST

## Current Status

### Website and Achievements Page

- The achievements page has been updated and pushed with upstream PR links and current status
  labels.
- Latest pushed website commit observed locally:
  `f91b2b2 Update upstream PR statuses on achievements page`.
- Local working tree still has unrelated, uncommitted local data:
  - `data/core_contributors.json`
  - `reports/`
- Do not include those local data/report changes in unrelated commits unless they are intentionally
  reviewed.

### Leaderboard and Benchmark Data

Observed on 2026-07-06:

- The leaderboard now includes serving trend workloads in the default all-workload view, including
  `*-online`, `*-throughput`, `*-latency`, and multi-chip `*-2chip` / `*-4chip` variants.
- Filter labels were localized so the Chinese page should consistently show `全部` instead of a
  mixture of `all` and Chinese labels.
- The default throughput trend chart uses an automatic broken Y-axis when high-throughput workloads
  would otherwise flatten the lower-throughput series.
- Missing trend points are intentionally represented as missing values, not as `0.0 tok/s`.
- Online deployment for the latest null-value fix was verified against
  `leaderboard-public-20260706-broken-axis2`.
- GitHub Pages deployments have intermittently failed with `Deployment failed, try again later.`;
  rerunning the Pages job has recovered the deployment.
- Local `tests/test_site_structure.py` can fail on
  `test_leaderboard_data_is_benchmark_snapshot_mirror` when the sibling
  `/home/shuhao/vllm-hust-benchmark/leaderboard-data/snapshots` tree is not synced with website
  `data/`. GitHub CI does not hit that local-only mismatch unless the sibling benchmark checkout is
  present.

Known data and experiment issues to keep tracking:

- `prefix-repetition-online @ 7fa0e3ed4b` was previously flagged as suspect because recorded
  workload metadata and same-spec client parameters did not match the official 4096/256 workload.
  It should remain excluded or be rerun with the official same-spec configuration.
- Early `random-online` W8A8/`dtype=auto` points should not be mixed into the FP16 trend line.
- Multi-chip current-main data around `ceec19` / `e068` showed high error rate or severe TTFT
  regression and needs root-cause analysis before it is interpreted as a stable performance result.
- Some right-side multi-chip workloads, especially current sonnet-throughput variants, still need
  explicit completeness checks before concluding that data is final.
- Future benchmark backfill should use an isolated vLLM-HUST checkout and explicit NPU allocation.
  Do not switch PRs in the user's active optimization checkout.

### Official Upstream PRs

vLLM:

- [vLLM #41449](https://github.com/vllm-project/vllm/pull/41449)
  - Head: `14f3feec1d6adfc5b84fb7dda165686f5fa22be5`
  - State: mergeable, non-draft, review required.
  - Checks: DCO, Meta check, and Mergify Summary are green.
  - Blocker: official `pre-run-check` requires `ready` or `verified` label.
- [vLLM #41507](https://github.com/vllm-project/vllm/pull/41507)
  - Head: `877c3ddc96082311c04aed2b98a112a7a5d5953a`
  - State: mergeable, non-draft, review required.
  - Checks: DCO, Meta check, and Mergify Summary are green.
  - Blocker: official `pre-run-check` requires `ready` or `verified` label.
- [vLLM #47622](https://github.com/vllm-project/vllm/pull/47622)
  - State: mergeable but still draft.
  - Blocker: official `pre-run-check` requires `ready` or `verified` label.
- [vLLM #47623](https://github.com/vllm-project/vllm/pull/47623)
  - State: mergeable but still draft.
  - Blocker: official `pre-run-check` requires `ready` or `verified` label.

vLLM-Ascend:

- [vLLM-Ascend #8958](https://github.com/vllm-project/vllm-ascend/pull/8958)
- [vLLM-Ascend #10735](https://github.com/vllm-project/vllm-ascend/pull/10735)
- [vLLM-Ascend #11417](https://github.com/vllm-project/vllm-ascend/pull/11417)
- [vLLM-Ascend #11422](https://github.com/vllm-project/vllm-ascend/pull/11422)
- [vLLM-Ascend #11449](https://github.com/vllm-project/vllm-ascend/pull/11449)

All five vLLM-Ascend PRs are mergeable, have DCO/lint/docs checks passing, and are mainly waiting
for official review.

### Faculty Twin / Slack Runtime

Observed on 2026-07-06:

- `sage-faculty-twin-app.service`
  - Active and serving on `127.0.0.1:55601`.
- `sage-faculty-twin-vllm-openai-proxy.service`
  - Active and serving on `127.0.0.1:18001`.
- `vllm-hust-auth-proxy.service`
  - Active and serving on `127.0.0.1:18080`.
- `sage-faculty-twin-vllm-engine.service`
  - Inactive/dead since 2026-06-30.
  - This matches the intended pause because the Qwen3-32B twin engine needs NPU capacity.
- Direct upstream engine endpoint `127.0.0.1:8000` is not listening.
- Current inference check fails:
  - `check_twin_inference.py --mode completion` returns HTTP 500 through the proxy.
- `sage-faculty-twin-inference-monitor.service`
  - Failed.
- `sage-faculty-twin-inference-monitor.timer`
  - Enabled but inactive/dead; last trigger was 2026-06-24.
- Slack routes are registered in the app:
  - `/slack/commands/twin`
  - `/slack/events`
  - Unsigned local probes return Slack signature/timestamp errors, which means the FastAPI routes
    exist.
- Slack monitor notification configuration exists in `.env`:
  - bot token is set
  - target user id is set
  - token values were intentionally not recorded here.
- Codex Slack MCP reminder creation failed twice with MCP startup timeout, so the Codex-side Slack
  connector is not currently usable.
- `sage-faculty-twin-site.service` is inactive.
- `sage-faculty-twin-tunnel.service` is inactive/disabled.
- `cloudflared-sage-local-235b.service` is active, so at least one Cloudflare tunnel process is
  running.

NPU/resource snapshot:

- `npu-smi info` reported NPU0 with about 53 GB HBM used by `VLLMEngineCor` PID `3268768`.
- NPU1-7 showed only low baseline HBM in `npu-smi`, but many vLLM-related Docker containers and user
  services are present.
- Do not restart the Qwen3-32B twin vLLM engine until NPU allocation is intentionally decided.

## Next Actions

### Leaderboard / Benchmark Follow-up

Data quality and audit:

- Build or run a repeatable coverage audit that checks every visible x-axis version against every
  displayed series. The audit should distinguish three states explicitly: valid point, missing point,
  and true zero/error result.
- Generate a short report from that audit before each data PR, especially for all-workload and
  multi-chip views.
- Keep suspect rows marked or excluded with written reasons instead of silently deleting or mixing
  incompatible specs.
- Reconcile website `data/leaderboard_*.json` with benchmark snapshot files under
  `/home/shuhao/vllm-hust-benchmark/leaderboard-data/snapshots` so the local mirror test can pass
  again.

Single-card backfill:

- Use only NPU0 for single-card reruns unless the user explicitly approves wider allocation.
- Run backfill only from an isolated checkout dedicated to benchmark work.
- Rerun `prefix-repetition-online @ 7fa0e3ed4b` with the official 4096/256 same-spec setup or keep
  the old row marked suspect/invalid.
- Recheck `random-online`, `sharegpt-online`, `instructcoder-online`, `agent-research-online`,
  `visionarena-online`, `sonnet-throughput`, `sharegpt-throughput`, and `random-latency` from left
  to right by x-axis version after every backfill import.

Multi-chip analysis:

- Do not start new 2-chip or 4-chip runs while the active constraint is NPU0-only.
- When multi-chip capacity is approved, prioritize reproducing the `ceec19` / `e068` high error or
  TTFT regression before adding more broad coverage.
- For each multi-chip regression claim, record workload, chip count, commit/version, error rate,
  TTFT, TPOT/TBT, throughput, `enforce_eager`, `gpu_memory_utilization`, `max_model_len`,
  `max_num_seqs`, model path, and tensor-parallel size.
- Missing current sonnet-throughput 2-chip/4-chip points should be treated as missing coverage, not
  performance conclusions, until rerun or explicitly waived.

Frontend and release validation:

- Add an automated trend-chart smoke check that catches missing values becoming `0.0`, all-workload
  data disappearing, and broken-axis mapping regressions.
- Before merging chart changes, verify at least these views: single-chip all workloads, single-chip
  each workload, multi-chip all workloads, and sonnet-throughput multi-chip.
- After deployment, verify the live `leaderboard.html` cache token and live `assets/leaderboard.js`
  content with no-cache requests.
- If Pages returns `Deployment failed, try again later.`, rerun the Pages workflow and verify the
  live asset token after success.

### Upstream PR Follow-up

- Ask vLLM maintainers to add `ready` or `verified` to #41449 and #41507 so official CI can run.
- Decide when #47622 and #47623 should leave draft state.
- After #47622/#47623 are ready, ask for `ready` or `verified` there as well.
- Continue tracking vLLM-Ascend #8958/#10735/#11417/#11422/#11449 for review feedback.

Useful commands:

```bash
gh pr view 41449 --repo vllm-project/vllm --json mergeable,mergeStateStatus,statusCheckRollup,labels,reviewDecision
gh pr view 41507 --repo vllm-project/vllm --json mergeable,mergeStateStatus,statusCheckRollup,labels,reviewDecision
gh pr view 8958 --repo vllm-project/vllm-ascend --json mergeable,mergeStateStatus,statusCheckRollup,labels,reviewDecision
```

### Twin Inference Recovery

- Decide whether to free the NPUs required by the Qwen3-32B twin engine or temporarily retarget twin
  to a smaller model.
- If using the current Qwen3-32B config, verify `VLLM_ENGINE_TP_SIZE=4` and reserve four intended
  Ascend devices before starting.
- After NPU capacity is available, start the engine and proxy through the project manager:

```bash
cd /home/shuhao/sage-faculty-twin
./manage.sh start --with-vllm-engine --with-vllm-proxy
./manage.sh check-inference
```

- If inference is healthy, re-enable the monitor:

```bash
systemctl --user reset-failed sage-faculty-twin-inference-monitor.service
systemctl --user start sage-faculty-twin-inference-monitor.timer
systemctl --user status sage-faculty-twin-inference-monitor.timer --no-pager
```

- Keep the monitor timer disabled/inactive while the twin engine is intentionally paused, otherwise
  it may repeatedly attempt recovery.

### Slack / Public Entry

- The app-side Slack routes exist. The remaining question is the external path from Slack to the
  app.
- Confirm whether the active `cloudflared-sage-local-235b.service` already routes
  `https://twin.sage.org.ai/slack/commands/twin` to the app or to the local site proxy.
- If the Cloudflare route expects the local site proxy, start it:

```bash
systemctl --user start sage-faculty-twin-site.service
systemctl --user status sage-faculty-twin-site.service --no-pager
```

- If using the older `sage-faculty-twin-tunnel.service`, confirm it is still the intended tunnel
  before enabling it, because another Cloudflare tunnel is already active.
- For Slack notifications from the monitor, test only after the intended Slack target is confirmed.
  Avoid printing bot tokens in logs.
- For Codex-side Slack reminders, retry only after the Slack MCP connector is available again;
  current error was MCP startup timeout.

### Cleanup / Hygiene

- There are many old vLLM containers and some defunct engine/worker processes. Do not bulk-kill them
  without checking which benchmark or paper run owns each one.
- If NPU memory is unexpectedly occupied, identify the owning process/container first:

```bash
npu-smi info
ps -fp <pid>
sudo -n docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

- Keep tokens and API keys out of logs, markdown files, Git commits, and screenshots.
