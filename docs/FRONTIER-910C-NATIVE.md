# 910C Native vLLM Performance

Independent model-specific engineering settings, not the historical official fixed-target baseline.
The first setting is `910c-native-dsv4-flash-w8a8-random8k1k-20261014`: DeepSeek V4-Flash-0731 W8A8
on one 910C host, TP4/DP4/EP16. Each run allocates 16 logical dies across eight physical packages.
The per-chip chart denominator is **16 logical dies**, not eight packages.

Source: [benchmark PR279](https://github.com/vLLM-HUST/vllm-hust-benchmark/pull/279), pinned to
`d2fee2579f34723c3e0bac40a744a9dcc5caceb5`. Rebuild additively with
`scripts/import_910c_native_frontier.py PATH_TO_REPORT`; existing cohort imports are refused. The
importer verifies every source checksum, reassembles lossless raw result shards, and checks zero
errors, exact token counts and reconstructed mean TPOT before deriving the chart coordinate.

All 11 observations are retained: host06 C1/2/4/8/16/32/64/128/256 and host07 C32/512. Each host has
its own group and concurrency line; do not pool the two C32 observations or join hosts into a
fixed-configuration sweep. Existing chart controls can reveal all points or just trade-off vertices.

X is the linear P90 quantile of per-request `(output_tokens - 1) / sum(ITLs)`, not inverse P90 TPOT,
inverse mean TPOT, or the percentile of individual streamed chunks. SSE chunks can contain several
tokens; their count does not replace actual output-token count. Y is native output throughput per
all 16 dies. The metadata retains both hardware counts and the original throughput.

The workload is synthetic random tokens, fixed8192 input/1024 output, prefix caching off, 8 warmups.
It is not SWE, natural-language capacity, model quality or API revenue. Target uses decode graphs;
DSpark K7 draft uses eager execution. This explicitly disclosed engineering scenario does not alter
formal leaderboard admission or assign an official-baseline ID. Request sample counts differ by C
and low-C tails are exploratory. C512 exceeds the 256 execution slots and includes queue pressure.

Future models get their own measured model/revision/workload cohorts under the same 910C naming
family. Downloaded weights alone do not create a score or an empty public scenario. Existing models,
cohorts, archive withdrawals and historical baseline metadata remain unchanged.

Checks: `node --test tests/leaderboard_910c_native.test.cjs` and
`node scripts/verify_910c_native_browser.cjs http://127.0.0.1:8784` against a local static server.
The browser check verifies exact point downloads and responsive layout at desktop/mobile widths;
Playwright screenshots go to `/tmp`, not the repository.
