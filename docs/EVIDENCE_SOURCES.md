# Canonical evidence sources

Website measurements are published from `vLLM-HUST/vllm-hust-benchmark`, with the deployed
`data/benchmark-source-manifest.json` binding the source commit and every data-file digest. Website
code and documentation must not introduce new copies of datasets, run logs or measured result files.

Current MOD evidence download links:

- [KV Arrival: G0 formal stop](https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/tag/g0-issue17-stop-20260901-v2)
- [KV Arrival: WaveMat raw provenance](https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/tag/wavemat-m0-raw-20260824-v1)
- [KV Arrival: M2 closure](https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/tag/m2-issue3-closure-evidence-20260811)
- [MuxPD: paired Goodput evidence](https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/tag/evidence-tp4-goodput-20261011)
- [MuxPD: grouped-prefill diagnostics](https://github.com/vLLM-HUST/vllm-hust-benchmark/releases/tag/evidence-tp4-groupfx-20261012)

These are preserved historical experiments, not new admissions, performance certification or proof
that the separate midterm KV state-isolation concern is resolved. Original statuses, failures and
pairing boundaries remain authoritative. Custody receipts live in benchmark
`archive/mod-releases-20261021/`.

Software wheels, source distributions and MOD installation bundles remain in their implementation
repositories. Their Release links must not be redirected to experiment archives merely because both
are downloadable attachments.

The required `No data PRs in website` check also invokes the pinned organization policy. It inspects
metadata only, checks complete pagination and renamed source paths, and flags measurement-like prose
for review. Heuristics are not complete: human review is still required for arbitrary filenames and
embedded results.
