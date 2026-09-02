# Version Metadata Maintenance

## Source of Truth

- All release banner, Quick Start copy, and project repository revisions are managed in
  `data/version_meta.json`.
- Do not edit release/quickstart copy directly in `README.md` for normal updates.
- For `vllm-hust`, do not reuse package versions from the SageLLM/ivllm repository family. The
  website should identify the current vllm-hust repository revision or a verified vllm-hust release.
- The default assumption is that `vllm-hust` may eventually upstream some of its optimizations back
  to official `vllm`. Version copy should therefore preserve upstream mergeability semantics instead
  of implying a permanent, independently versioned downstream product line.
- Development builds may carry upstream prerelease or dev identifiers. Avoid presenting an old PyPI
  package version as the current project version unless it is explicitly the artifact being
  discussed.

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

1. Refresh the curated public snapshot with `python scripts/refresh_site_status.py --refresh`. Set
   `GH_TOKEN` through the environment for authenticated GitHub rate limits; never put it in files.
   All requests must succeed before either data file is written. Review both resulting diffs.

1. Edit copy fields under `release` / `quickstart` only when guidance changes. The seven source
   repositories are explicitly allowlisted in the refresh script; do not infer runtime compatibility
   from their independent `main` heads. `source_commit_url` contains the full immutable commit;
   `version` is its short display label. `source_updated_at` is the commit date, while `updated_at`
   is the API verification time. `registry` is historical PyPI identity, not deployment approval.

1. Run sync script:

   ```bash
   python scripts/sync_version_meta.py
   ```

1. Validate stale/version consistency:

   ```bash
   bash scripts/check_stale_versions.sh
   ```

1. Run `python scripts/refresh_site_status.py --check` and the regression tests, then commit the
   reviewed updates (`data/issues.json`, `data/version_meta.json`, `README.md`). Push to main for
   Pages.

## Curated issue history and freshness

- `data/issues.json` is a curated subset, not a complete live issue tracker. Open issues alone count
  in active metrics. Closed records remain in a collapsed archive with GitHub state and merge dates.
- `curated_at` records when the historical progress/acceptance evidence was assembled; refreshes
  preserve those fields. GitHub closure or PR merge does not mark acceptance criteria as met.
- `last_updated` is the latest successful GitHub verification. Both Issues and Versions warn when
  their timestamp is invalid, in the future, or more than seven days old. Follow source links for
  real-time status. API failure leaves the previous snapshot intact rather than publishing zeros.
- Refresh does not mutate upstream issues, PRs, production receipts, or runtime deployments.

## Automation

- Workflow: `.github/workflows/sync-version-meta.yml`

  - Runs on schedule and manual dispatch
  - Renders the README block from reviewed metadata
  - Never replaces source snapshots with PyPI versions
  - Commits only when file content changes

- Workflow: `.github/workflows/site-status-check.yml`

  - Daily read-only API comparison plus seven-day age guard; failure is an actionable drift alert
  - Never auto-approves a new registry release or publishes a new production compatibility pair
  - Maintainers run the refresh command above, review, test and push; the browser warns meanwhile

- Workflow: `.github/workflows/check-stale-versions.yml`

  - Blocks stale version rollback and metadata inconsistency in CI

## Browser regression

The `ci` browser job serves the exact checkout and checks five pages at 1440×1000 and 390×844, under
both system color preferences. It checks real composed text contrast, visible anchors, keyboard
disclosure/filter focus, language persistence, archived issue metrics, and Versions error, empty and
stale states. Those failure cases use explicit request fault injection; normal screenshots use the
unmodified page data. Achievements must not request leaderboard or contributor datasets.

To repeat against the deployed site, install Playwright and its Chromium, then run:

```bash
python -m pip install playwright
python -m playwright install chromium
python scripts/verify_site_browser.py --url https://vllm-hust.sage.org.ai/
```

Screenshots and computed values go under `output/playwright/site-repair/` (ignored runtime output).
`--browser` can select an existing Chromium executable. Each navigation and assertion has a bounded
timeout; no `networkidle` wait is used.

## Stale-reference allowlist

- File: `scripts/stale_version_allowlist.txt`
- Add one regex per line for known exceptions when stale check should ignore a line.
- Keep allowlist minimal to avoid masking real regressions.
