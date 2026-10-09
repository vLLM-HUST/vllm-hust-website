# OP01 raw evidence

This directory contains the public raw artifacts for the ten displayed OP01 points in PR #354:
OFF/ON at C1, C2, C4, C8 and C16. Each displayed point is the pre-declared median-throughput
selection from three valid 900-second repeats.

Each run directory contains the `config.json`, `summary.json` and raw `requests.jsonl` referenced by
the corresponding displayed point's `run_id`. The SHA256 values in
`data/leaderboard_frontier_swe_evidence.json` are the hashes of these files. The other twenty valid
repeats remain represented in the evidence table but their raw artifacts are not part of this public
directory.

`qwen35.json` is the prepared workload snapshot used by the formal runs. The two server logs are
campaign-level logs and are not point-isolated activation logs.

The benchmark source snapshot used by the server matches
[swe-prefix-reuse commit 695dd8b1ab280145627a108b434f7a54cca05810](https://github.com/vLLM-HUST/swe-prefix-reuse/tree/695dd8b1ab280145627a108b434f7a54cca05810).
