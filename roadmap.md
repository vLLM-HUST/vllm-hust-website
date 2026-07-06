# vLLM-HUST Website / Upstream / Twin Roadmap

Last updated: 2026-07-06 08:39 CST

## Current Status

### Website and Achievements Page

- The achievements page has been updated and pushed with upstream PR links and current status labels.
- Latest pushed website commit observed locally: `f91b2b2 Update upstream PR statuses on achievements page`.
- Local working tree still has unrelated, uncommitted local data:
  - `data/core_contributors.json`
  - `reports/`
- Do not include those local data/report changes in unrelated commits unless they are intentionally reviewed.

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

All five vLLM-Ascend PRs are mergeable, have DCO/lint/docs checks passing, and are mainly waiting for official review.

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
  - Unsigned local probes return Slack signature/timestamp errors, which means the FastAPI routes exist.
- Slack monitor notification configuration exists in `.env`:
  - bot token is set
  - target user id is set
  - token values were intentionally not recorded here.
- Codex Slack MCP reminder creation failed twice with MCP startup timeout, so the Codex-side Slack connector is not currently usable.
- `sage-faculty-twin-site.service` is inactive.
- `sage-faculty-twin-tunnel.service` is inactive/disabled.
- `cloudflared-sage-local-235b.service` is active, so at least one Cloudflare tunnel process is running.

NPU/resource snapshot:

- `npu-smi info` reported NPU0 with about 53 GB HBM used by `VLLMEngineCor` PID `3268768`.
- NPU1-7 showed only low baseline HBM in `npu-smi`, but many vLLM-related Docker containers and user services are present.
- Do not restart the Qwen3-32B twin vLLM engine until NPU allocation is intentionally decided.

## Next Actions

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

- Decide whether to free the NPUs required by the Qwen3-32B twin engine or temporarily retarget twin to a smaller model.
- If using the current Qwen3-32B config, verify `VLLM_ENGINE_TP_SIZE=4` and reserve four intended Ascend devices before starting.
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

- Keep the monitor timer disabled/inactive while the twin engine is intentionally paused, otherwise it may repeatedly attempt recovery.

### Slack / Public Entry

- The app-side Slack routes exist. The remaining question is the external path from Slack to the app.
- Confirm whether the active `cloudflared-sage-local-235b.service` already routes `https://twin.sage.org.ai/slack/commands/twin` to the app or to the local site proxy.
- If the Cloudflare route expects the local site proxy, start it:

```bash
systemctl --user start sage-faculty-twin-site.service
systemctl --user status sage-faculty-twin-site.service --no-pager
```

- If using the older `sage-faculty-twin-tunnel.service`, confirm it is still the intended tunnel before enabling it, because another Cloudflare tunnel is already active.
- For Slack notifications from the monitor, test only after the intended Slack target is confirmed. Avoid printing bot tokens in logs.
- For Codex-side Slack reminders, retry only after the Slack MCP connector is available again; current error was MCP startup timeout.

### Cleanup / Hygiene

- There are many old vLLM containers and some defunct engine/worker processes. Do not bulk-kill them without checking which benchmark or paper run owns each one.
- If NPU memory is unexpectedly occupied, identify the owning process/container first:

```bash
npu-smi info
ps -fp <pid>
sudo -n docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

- Keep tokens and API keys out of logs, markdown files, Git commits, and screenshots.
