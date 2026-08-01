# Leadership performance slide

The formal leadership slide is generated only from canonical leaderboard snapshots. The checked-in
snapshot is currently **not admissible**: it contains legacy/config-unverified records and no complete
compare group. Do not use it to produce a formal curve, and do not copy values from the historical
PPTX files in `output/`.

## Pinned public targets

`data/leadership_performance_targets.json` pins the three series to the benchmark repository's
versioned official-target registry. Every pin records `target_id`, `target_version`, `profile_id`, and
the SHA256 of the complete registry. A registry update therefore makes existing artifacts stale until
the pin is reviewed and updated.

The generator requires every canonical entry—not merely the plotted points—to pass these checks:

- `metadata.verified` is true;
- `target_id`, `target_version`, `profile_id`, and `target_registry_sha256` exactly match the active
  public registry entry;
- `same_spec.spec_id` equals `target_id`;
- model identity/precision/quantization, hardware vendor/chip/node count, and every resolved
  semantic server/client parameter match the pinned official target after benchmark canonical
  normalization (`host`, `port`, and runtime-local model paths are operational, not semantic);
- the explicit workload summary records positive input/output lengths, dataset, batch, and
  concurrency and agrees with the normalized client contract;
- the compare snapshot uses `leaderboard-compare-snapshot/v1` and has exactly one complete group for
  every pinned leadership target; each group scope must match model, hardware, precision, workload,
  topology, and setting signature, and at least two unique member IDs must resolve to already-admitted
  snapshot entries with the same target/workload; member engines must be unique and include the
  canonical `vllm` baseline plus `vllm-hust` current engine; `preferred_pair.left/right` must be
  distinct group members and bind current/baseline respectively;
- all Agent research online, ShareGPT online, and Random online series are present.

There is no compatibility fallback, legacy allowlist, interpolation, or missing-point substitution.

## Story file

The story file is versioned JSON with no performance numbers. It only maps a canonical `entry_id` to
presentation text and a real PR number. The PR number must match the entry's canonical GitHub
repository, URL, and full commit identity. The current canonical snapshot schema does not publish a
commit-bound pair/cohort identity, so `paired` attribution fails closed even if the story names a
base/head relationship. Until that schema exists, each admitted milestone must be cumulative and
bind an explicit checkpoint entry and commit boundary.

```json
{
  "schema_version": "leadership-performance-story/v1",
  "series": [
    {
      "workload": "agent-research-online",
      "milestones": [
        {
          "entry_id": "<canonical-entry-id>",
          "label": "<public optimization keyword>",
          "pr_number": 123,
          "repository": "vLLM-HUST/vllm-hust",
          "pr_url": "https://github.com/vLLM-HUST/vllm-hust/pull/123",
          "commit": "<full-40-hex-canonical-commit>",
          "attribution": {
            "kind": "checkpoint-cumulative",
            "boundary_id": "<stable-checkpoint-id>",
            "checkpoint_entry_id": "<canonical-entry-id>",
            "checkpoint_commit": "<full-40-hex-canonical-commit>"
          }
        }
      ]
    },
    {
      "workload": "sharegpt-online",
      "milestones": [
        {
          "entry_id": "<canonical-entry-id>",
          "label": "<public optimization keyword>",
          "pr_number": 124,
          "repository": "vLLM-HUST/vllm-hust",
          "pr_url": "https://github.com/vLLM-HUST/vllm-hust/pull/124",
          "commit": "<full-40-hex-canonical-commit>",
          "attribution": {
            "kind": "checkpoint-cumulative",
            "boundary_id": "<stable-checkpoint-id>",
            "checkpoint_entry_id": "<canonical-entry-id>",
            "checkpoint_commit": "<full-40-hex-canonical-commit>"
          }
        }
      ]
    },
    {
      "workload": "random-online",
      "milestones": [
        {
          "entry_id": "<canonical-entry-id>",
          "label": "<public optimization keyword>",
          "pr_number": 125,
          "repository": "vLLM-HUST/vllm-hust",
          "pr_url": "https://github.com/vLLM-HUST/vllm-hust/pull/125",
          "commit": "<full-40-hex-canonical-commit>",
          "attribution": {
            "kind": "checkpoint-cumulative",
            "boundary_id": "<stable-checkpoint-id>",
            "checkpoint_entry_id": "<canonical-entry-id>",
            "checkpoint_commit": "<full-40-hex-canonical-commit>"
          }
        }
      ]
    }
  ]
}
```

Do not add this file with placeholder IDs. Wait until the canonical snapshot contains the complete
admitted series, then record only real entry and PR identities.

## Generate and verify

Install the repository development dependencies in the existing environment; do not create a local
virtual environment. Then run:

```bash
python3 scripts/build_leadership_performance_slide.py \
  --snapshot-dir data \
  --registry ../vllm-hust-benchmark/leaderboard-data/official-targets.json \
  --registry-checksum ../vllm-hust-benchmark/leaderboard-data/official-targets.sha256 \
  --target-pin data/leadership_performance_targets.json \
  --story path/to/admitted-story.json \
  --benchmark-repo ../vllm-hust-benchmark \
  --benchmark-commit <full-benchmark-commit-sha> \
  --output-dir output/leadership-performance
```

The benchmark commit must exist in the local benchmark checkout, and the registry plus all snapshot
bytes must exactly match that commit's tree. The command writes SVG, PNG, PPTX, and a provenance JSON
sidecar only after all admission checks pass. SVG metadata, a PNG `tEXt` chunk, PPTX core
properties/footer, and the sidecar identify the registry, story, commit/tree, and snapshot source.
Story labels are audited before SVG/PNG rendering, and the finished PPTX XML text layer is audited
again. Publishing uses a same-filesystem staging set and restores the previous four files if a
mid-publish replacement fails.

To detect a changed registry, target pin, story, snapshot, benchmark commit, or output bytes without
regenerating:

```bash
python3 scripts/build_leadership_performance_slide.py <same-arguments> --check-stale
```

The current 21 legacy/config-unverified entries are expected to fail before rendering. That failure is
the intended safety behavior until benchmark cleanup and paired reruns are complete.
