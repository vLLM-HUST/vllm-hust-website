# OP01 raw evidence

This directory contains the public raw artifacts for the ten formal OP01 points in
PR #354: OFF/ON at C1, C2, C4, C8 and C16.

Each run directory contains the `config.json`, `summary.json` and raw
`requests.jsonl` referenced by the corresponding point's `run_id`. The SHA256
values in `data/leaderboard_frontier_swe_evidence.json` are the hashes of these
files. The selected C8 run is the median output-throughput run from five valid
runs per mode; the four additional repeats remain local supporting evidence.

`qwen35.json` is the prepared workload snapshot used by the formal runs. The two
server logs are campaign-level logs and are not point-isolated activation logs.

The benchmark source snapshot used by the server matches
[swe-prefix-reuse commit 695dd8b1ab280145627a108b434f7a54cca05810](https://github.com/vLLM-HUST/swe-prefix-reuse/tree/695dd8b1ab280145627a108b434f7a54cca05810).
