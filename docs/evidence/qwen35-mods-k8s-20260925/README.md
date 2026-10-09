# Common runtime overlays and identity receipts

These overlays are shared by the native and BidKV arms. See the
[campaign report](../../FRONTIER-QWEN35-MODS-K8S.md) for versions, configuration, qualification and
measured results.

- Apply `core-common.patch.gz` to core commit `752a3a504485790a2e8491cacbb35c137339ad34`. It
  contains the neutral preemption API backport and the independent Mamba accepted-token feedback
  buffer.
- Apply `ascend-feedback-mailbox.patch.gz` to the Python backend at commit
  `9bf964cb4b87c8cd0d6852c41a55b3c29711fa95`. The measured environment used the matching official
  0.25.1rc1 A2 wheel plus this Python overlay; its compiled kernels were not rebuilt or replaced.
- `frontier_worker.py.txt` preserves the exact executed worker source bytes; copy it as
  `frontier_worker.py` to use `--worker-cls frontier_worker.Worker`. It supports only the V1
  SD-layout ABI and rejects V2/DS inputs.
- `launch-bidkv.sh.txt` preserves the candidate launcher, enabling the BidKV utility and policy on
  the same common runtime.
- `launch-native.sh.txt` preserves the executed baseline launcher, including CANN environment setup
  and graph/MTP settings.
- `model-manifest.json` records SHA256 and byte size of each executed model file. All 22 entries
  match the official ModelScope tree at revision 712cf743.
- `workload-equivalence.json` records the metadata-only transformation that exactly reproduces the
  historical prepared-workload SHA256.

The patches are gzip-compressed to preserve every unified-diff context byte through text-formatting
checks. Decompress with `gzip -dc` before `git apply`.

Preserve the CANN environment when adding the worker directory to PYTHONPATH. Set
`VLLM_VERSION=0.25.1` for the backend's exact-version selector; retain actual patched core metadata
when recording the run. The experiment directory and port are deployment-specific and appear in each
downloaded configuration.

The common overlays are qualified for this experiment's V1/SD, asynchronous Mamba-align graph
configuration. They are not a certification of other layouts or cache modes. The public metrics
extract records the original raw-request artifact hash; complete request token/timing artifacts
remain with the measurement owner.
