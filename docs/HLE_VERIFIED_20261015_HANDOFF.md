# HLE-Verified results handoff

The dataset-validation page presents author-published Gold 668 and Revision 1143 separately;
Uncertain 689 is excluded. Correct/all selected: 156/668 (23.35%) and 313/1143 (27.38%). Qwen is
both solver and substitute judge; original HLE prompts/schema, single trial, strict complete JSON
grading. This is development evaluation, not official leaderboard replication or V5.5 acceptance.

72 judge truncations remain unresolved in the full denominator. They are not confirmed wrong. 1071
solver truncations were passed to the judge, not automatically marked incorrect. Both limits are
visible beside the score table. Modality and subject breakdowns retain the same denominators.

Four separate bench groups: Gold text200, Revision text200, Gold image93, Revision image118.
Original images are retained. Output budget256, temperature0, seed0, thinking=false, EOS allowed;
rate inf, no client concurrency cap. TTFT includes queueing. Server max_num_seqs16 is not client
concurrency. All per-request input counts match service tokenization, including images. Bench omits
the accuracy system prompt and uses the server template once; it is not an accuracy replay or
cold-cache test.

The always-visible runtime panel contains 20 verified fields. The evidence panel links all three
original result tables and manifests as byte-preserving gzip files. Full weights, image digest and
local model revision are not verified. No B1 or performance improvement claim.

Generate the website data from the companion benchmark report directory:

```bash
python scripts/import_hle_verified_handoff.py \
  ../vllm-hust-benchmark/reports/hle-verified-qwen35-20261015
node --test tests/hle_verified_handoff.test.cjs
```

Public evidence excludes raw question/image/answer payloads and cannot independently regrade cases.
The importer verifies all six original table/manifest hashes before writing downloads; JS tests
validate bindings, scores, breakdowns, modality counts, runtime, escaping and error rendering. The
standalone HLE client remains local. This PR must not be merged automatically.
