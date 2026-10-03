# utility-victim: Qwen3.5 SWE C16 OFF/ON measurements

This change adds six measured observations to
[Benchmark settings](https://vllm-hust.sage.org.ai/leaderboard-runs.html?setting=utility-victim-qwen35-bf16-swe-c16-m65-20261002#settings).
Choose **Qwen3.5-35B-A3B (local checkpoint)** and **utility-victim OFF/ON · C16 · 3 repeats**. This
is a fixed-concurrency comparison, not a C1–C16 sweep. All six records are visible as independent
points without connecting lines. They do not enter the canonical checkpoint's unified concurrency
chart. The public link becomes available after this change is merged and the website is deployed.

## Result and scope

All six 900-second SWE windows passed the client protocol checks with zero failed requests. Each ON
run has four patch-installation events and one first-use `runtime_effective` event. The utility
branch changed victim selection; that event explicitly says `actual_kv_freed_verified=false`. It is
not a count of all selections or verified freed bytes.

| Repeat | OFF total tok/s | ON total tok/s | OFF decode P90 tok/s | ON decode P90 tok/s | OFF TTFT P95 ms | ON TTFT P95 ms |    OFF preemption delta | ON preemption delta |
| ------ | --------------: | -------------: | -------------------: | ------------------: | --------------: | -------------: | ----------------------: | ------------------: |
| r1     |         172.520 |        146.997 |               19.119 |              19.158 |        9829.220 |       5973.185 |                     311 |                 188 |
| r2     |         170.858 |        154.364 |               19.228 |              19.434 |       11623.996 |       6022.103 | 0 (unverified snapshot) |                 184 |
| r3     |         174.847 |        157.122 |               19.497 |              19.158 |        9861.555 |       5575.902 |                     338 |                 199 |

Arithmetic mean total throughput is **172.741 tok/s OFF** and **152.828 tok/s ON**: ON is **11.53%
lower**, calculated as `(mean_ON / mean_OFF - 1) * 100`. Each individual pair has lower ON
throughput and lower ON TTFT P95. This is an observed trade-off, not an overall performance
improvement, statistical significance or a result for other loads. Decode speed is approximately
unchanged. Per-chip throughput is the total divided by two. The chart retains each original
observation; it does not plot these arithmetic means or average request percentiles across runs.
Repeats were OFF then ON, without reverse-order confirmation.

Preemption deltas come from the exact `vllm:num_preemptions_total` samples captured before and after
the client invocation. Their interval includes drain and is not the strict throughput window.
OFF-r2's supplied after file contains zero, while the handwritten experiment notes repeat r1's
311/188 values. The import preserves the actual zero sample as **unverified**, does not substitute
r1's value, and makes no r2 preemption-reduction claim. No missing or suspect count is repaired by
inference. The original notes' ON-r1 installation count of three is also superseded by the four
events present in its retained server log.

## Plugin and deployment

`vllm-hust-utility-victim` **0.1.0.dev2**, extension ID `org.vllm-hust.utility-victim`, extracts the
victim-selection mechanism from
[Ascend legacy PR 39](https://github.com/intellistream/vllm-ascend-hust-legacy-20260831/pull/39). It
is a local package; no public repository or PyPI release is asserted. It is distinct from the
existing BidKV catalog component, and its observations are not attributed to BidKV.

The measured backend is `core-contract-v1`: a local Core scheduler selector-interface patch plus the
plugin, not an upstream standard API and not a wheel-only unmodified-host deployment. Both arms use
this host interface. The plugin is disabled through its kill switch for OFF. The intended selector
ranks computed-token proxies with completion/preemption penalties; it does not itself verify
physical KV release or change the KV allocator.

Recorded launch configuration:

- Qwen3.5-35B-A3B local checkpoint, BF16, two Ascend 910B2 chips, TP2 with expert parallelism; PP1
  and DP1, no MTP.
- Context capacity 262144; maximum 16 requests; batch budget 8192 tokens; block size 128.
- `gpu_memory_utilization=0.65`, no prefix caching, chunked prefill, synchronous scheduling, FCFS,
  `mp` executor, custom all-reduce disabled.
- `FULL_DECODE_ONLY` graph configuration with capture sizes 1/2/4/8/16.
- Both arms: `ENABLE=1`, `BACKEND=core-contract-v1`, `EVIDENCE=1`, Ascend balance scheduling off.
  `VLLM_HUST_UTILITY_VICTIM_KILL_SWITCH=1` for OFF and `0` for ON.

The launch script's `KV_MEMORY_FRACTION=0.65` is passed to **gpu_memory_utilization**; it is not a
measurement that 65% of memory is KV cache. Exact redacted commands are in the point downloads.
Installed-version snapshots for five runs report vLLM `0.23.0+empty`, Ascend `0.23.0.post1`, and
plugin `0.1.0.dev2`. OFF-r1 lacks a separate versions/hardware file; its server log confirms v0.23.0
and TP2, while the campaign hardware/backend attribution uses the other five snapshots. This
inheritance is disclosed rather than presented as an independent receipt.

## Workload, timing and provenance limitations

The client is `swe-prefix-reuse` 0.1.2, Transformers 5.18.0, thinking enabled, seed 0, C16 and
session depth1. All six configs record the same prepared workload SHA256 and tokenizer fingerprint,
preserved in the evidence. The client appends actual generated token IDs with fixed source-derived
output budgets; the server runs greedy generation and ignores EOS to meet them. Fresh salts isolate
session plays. No per-run qualification receipt is retained.

The importer verifies raw request success/budgets, in-window completion counts, token chunks and the
two recorded percentile metrics. Throughput counts only token chunks received in `[0, 900)`; drained
tokens after the deadline get no credit. Decode P90 uses requests whose validated stream ends inside
the window, with `(N - 1) / (last_token - first_token)`. TTFT is converted from seconds to
milliseconds. No TPOT/E2E values are invented. This measures serving, not SWE answer quality.

Important missing provenance remains explicit:

- Client `server_metadata` is null. Server settings were recovered from the supplied launch logs.
- Exact measured model revision, runtime/plugin/client source commits and CANN version were not
  retained. The model revision marker `unrecorded-local-checkpoint` expresses missing identity; it
  is not a commit. Matching the canonical checkpoint or tokenizer is not independently proven.
- Original prepared workload bytes are not included in this import; configs retain its hash.
- No selected-device ownership/release receipt or independent answer-quality result is available.
- Configured 256K capacity is not measured full-256K prompt coverage. Actual maxima, reached turns,
  client occupancy and drain duration remain in each summary.
- A first-use event establishes that selection ran, not all selection counts, freed KV bytes or a
  causal explanation of the observed latency/throughput trade-off.

These limitations are why this publication uses a separate local-checkpoint fixed comparison. They
must be resolved before claiming exact reproducibility or membership of a stricter cohort.

## Evidence and deterministic import

- [Chart snapshot](../data/leaderboard_frontier.json): six points and the separate cohort.
- [Public evidence extract](../data/leaderboard_utility_victim_evidence.json): complete summaries,
  sanitized configs, metric mappings, plugin event payloads, preemption samples and SHA256/size
  manifests for the original per-run files.
- Full request-token streams, server logs, hardware and Prometheus files remain with the measurement
  owner in the utility-victim package's `results/` directory. Public file hashes refer to those
  original bytes, not the sanitized extracts. No machine paths or generated outputs are required in
  the public snapshot.

From the website checkout, using Python 3.11 or later:

```bash
python scripts/import_utility_victim.py --source /path/to/vllm-hust-utility-victim
node --test tests/leaderboard_frontier_model.test.cjs
```

The importer reads all six runs before writing, validates the recorded fixed configuration and
metric accounting, and replaces only this campaign's records. It preserves other campaigns and
rejects incomplete/invalid inputs. Re-importing identical source files produces identical JSON. The
60-second `off-smoke` probe is intentionally excluded from the 900-second comparison.
