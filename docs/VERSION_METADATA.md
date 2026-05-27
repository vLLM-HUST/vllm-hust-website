# Version Metadata Maintenance

## Source of Truth

- All release banner, Quick Start copy, and package versions are managed in
  `data/version_meta.json`.
- Do not edit release/quickstart copy directly in `README.md` for normal updates.
- For `vllm-hust`, do not invent a detached `0.5.x.x` website-only version line. The recommended
  stable public release rule is `upstream.postN`, such as `0.17.2.post1`, so users can see both the
  upstream base and the HUST fork revision.
- The default assumption is that `vllm-hust` may eventually upstream some of its optimizations back
  to official `vllm`. Version copy should therefore preserve upstream mergeability semantics instead
  of implying a permanent, independently versioned downstream product line.
- Development or nightly builds may still carry upstream prerelease or dev identifiers, but the
  public website should explain that stable releases are expected to converge on the
  `upstream.postN` scheme.

## Leaderboard Version Display Contract

- Main leaderboard table version cells are intentionally compact summaries. They should optimize for
  scanability and keep composite stack versions in a concise, normalized form such as
  `v0.17.2.post1 + v0.18.0.post1`.
- Expanded leaderboard details are intentionally more detailed than the table. Detail-only version
  fields, including the displayed version summary, build variant summary, and component version
  rows, should preserve richer PEP-style detail whenever provenance is available, such as
  `v0.17.2.post1.d6fe8f2f + v0.18.0.post1.85927fef` or
  `v0.20.1rc1.dev314.64ff561c + v0.1.0.dev2792.c56ccf1e`.
- Only version substrings should change between the compact table view and the detailed panels.
  Labels, explanatory copy, and other non-version metadata should remain unchanged.
- Keep the compact table formatter and the detailed detail formatter as separate code paths. Do not
  reuse the detail formatter in the main table, and do not collapse detail views back to the compact
  formatter.
- Any future leaderboard version-rendering change must preserve this contract and update the
  regression coverage in `tests/test_site_structure.py`.

## Update Flow

1. Edit `data/version_meta.json` (copy fields under `release` / `quickstart`, package list under
   `packages`).

1. Run sync script:

   ```bash
   python scripts/sync_version_meta.py
   ```

1. Validate stale/version consistency:

   ```bash
   bash scripts/check_stale_versions.sh
   ```

1. Commit generated updates (`data/version_meta.json`, `README.md`).

## Automation

- Workflow: `.github/workflows/sync-version-meta.yml`

  - Runs on schedule and manual dispatch
  - Pulls latest versions from PyPI
  - Updates `data/version_meta.json` and generated README block
  - Commits only when file content changes

- Workflow: `.github/workflows/check-stale-versions.yml`

  - Blocks stale version rollback and metadata inconsistency in CI

## Allowlist

- File: `scripts/stale_version_allowlist.txt`
- Add one regex per line for known exceptions when stale check should ignore a line.
- Keep allowlist minimal to avoid masking real regressions.
