# OP01 attention boundary · local Frontier draft

This is a local draft generated from ten valid 900-second runs: OFF/ON at C1, C2, C4, C8 and C16.

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
  output-throughput run in each mode; all five records remain under op01-evidence.
- No PR or external publication was performed.
