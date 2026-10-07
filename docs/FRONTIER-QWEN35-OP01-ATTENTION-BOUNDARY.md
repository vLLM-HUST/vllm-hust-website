# OP01 attention boundary · Frontier PR evidence

This PR (#354) contains ten valid 900-second runs: OFF/ON at C1, C2, C4, C8 and C16.

The measured host is vLLM 0.23.0+empty with vLLM-Ascend 0.23.0.post1, matching the operation record.
Every imported formal summary is valid and has zero failed requests.

## Limitations

- The measured prepared file hash is dff300…; it is added to this local draft as a
  content-equivalent variant because metadata normalization reconstructs the canonical 804456… hash.
  This does not independently prove tokenizer identity.
- Server logs were rotated on each restart. The retained ON/OFF logs are campaign-level artifacts,
  not point-isolated activation logs. Performance attribution to OP01 is therefore not marked
  verified.
- C8 has five valid formal runs in each mode. The public C8 point selects the median
  output-throughput run in each mode; the selected formal runs are published under
  op01-evidence, while the four additional repeats remain local supporting evidence.
- The benchmark snapshot used by the server matches public swe-prefix-reuse commit
  695dd8b1ab280145627a108b434f7a54cca05810: the remote pyproject, README, package
  initializer, runner, CLI, client and prepare source hashes match that commit.
- The installed MOD source is publicly available at
  https://github.com/xmdhb/vllm-hust-ascend-attention-boundary, pinned to package
  commit 3572713e7944ea877b22f2a8a6bb053f348bfd25. The installed host source
  commit remains f4eacc39cb85ec39024278fbaba1fbc23cbe981f; the point-level
  mod_sources field records the MOD package repository commit separately.
- The PR is open and not merged. Raw config/summary/requests artifacts and
  point-isolated server logs are still local evidence, not yet public HTTPS evidence.
