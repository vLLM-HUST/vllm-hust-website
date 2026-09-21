# Present BetterScale execution results

Enter here when updating BetterScale's case study, importing new measurements, or connecting it to
site navigation.

- `betterscale.html` is the bilingual detail page. Its entry is an ordinary `.workshop-card` in
  `plugins.html`, not a featured banner. The `betterscale` component in `data/ecosystem.json` joins
  the same catalog renderer, search and filters as other MODs. `documentation_url` points to the
  detail page. Its sole workload tag is `distributed_pipeline` (displayed as 分布式 / Distributed).
- Fletcher replaced the old StateHarbor prototype: `stateharbor.public_surface` is false and its
  workload/community entries are removed. Historical registry identity remains, but it must not
  appear in the public MOD grid or search. Keep the other MOD entries intact. Do not add a homepage
  or achievements entry.
- BetterScale is public under Apache-2.0 as of 2026-09-14. The normal card footer links to GitHub;
  the detail page also links source from its hero and integration section. Public metadata refresh
  may query the repository and display observed metrics. Keep generic private-repository handling
  for other components; do not remove it.
- `data/betterscale-results.json` is the curated public measurement snapshot; `docs/BETTERSCALE.md`
  explains comparators, methods and provenance. Keep chart numbers and scope consistent with the
  snapshot. Both repeat observations are visible, not averaged into one flattering number. The
  matched-cycle chart axis is 0–70 ms; `service_http` separately owns the reused HTTP results.
- The MOD catalog registration is explicitly requested by Fletcher. It does not admit these
  measurements to the official fixed-target leaderboard. The website is a renderer, not
  classification authority; see `.vllm-hust/repository-profile.json`.
- The implementation repository is now `vLLM-HUST/BetterScale` (public), renamed from
  `strengthen-dsv4`. Public `vllm-betterscale==0.4.1` is on PyPI; `betterscale.worker.Worker` is
  defined directly in `src/betterscale/worker.py`. The card quickstart and detail page own
  installation and bounded TP8/DP8 commands. Link source evidence to its original measurement
  commit, not a moving main branch. The first rename attempt lacked admin permission; Fletcher
  completed the rename and the canonical URL was verified through GitHub.
- TP draft and receipt studies isolate different increments. Never add their percentages or label
  the combined progression a direct stock-to-final A/B. DP compares dual endpoints against
  producer/metadata inside a DP FULL engine; its draft remains eager. Unprofiled cycle gains are not
  service-throughput gains.
- The drawing is explicitly a mechanism schematic, not an actual timeline. The unprofiled ~1.2 ms
  interval does not supersede separate profiled ~10 ms gaps. OpenCompass results cover 32 retrieval
  items, not the complete suite.

Run `python scripts/verify_betterscale_browser.py --url http://127.0.0.1:8769` against a local
static server, with Playwright/Chromium in a documentation-only environment. It checks both
languages and viewport widths, visible repeated values, bar scales and entry links, and writes local
screenshots under `output/playwright/betterscale/`. These screenshots are QA evidence, not site
assets. Run the repository's Python tests and applicable pre-commit checks. Do not install website
dependencies into an inference runtime.

0.3.1 adds only DP startup preparation; installation links follow that version. Its HTTP result
reuses qualified run155 (+39.63% vs native DP), while TP retains the 0.3.0 path (+35.17% vs native
TP). `docs/BETTERSCALE.md` links the versioned source report. Do not rewrite the existing
cycle-study snapshot as a new HTTP benchmark or claim a fresh wheel NPU run; Fletcher stopped that
redundant rerun.

## Keep the installation panel executable

The BetterScale quickstart in `assets/plugins-page.js` includes the complete DP8 command and an
expandable TP8 alternative, not just a Worker flag. The only shared renderer change is an optional
alternative block; other MODs keep their existing commands. `scripts/check_betterscale_install.py`
checks both panel/page command copies against the installed public package's CPU admission. The
separate `betterscale-package` CI job installs the PyPI wheel with --no-deps on Python3.12 and
exports the checked argv. CPU CI never claims an NPU service boot.

For a real startup-only check use `scripts/smoke_betterscale_service.py` with that argv artifact, an
explicit model path and the normal Ascend environment, under the home lease and existing
selected-card/descendant supervisor. It verifies health and one short completion, not throughput or
retrieval quality. Do not reuse an old performance matrix to claim this HTTP smoke is a new
benchmark.

DP8 startup smoke163 passed with the public0.3.1 wheel and the exported MOD command (only model path
replaced). All8 native EngineCore_DP initialization records, HTTP200 and32 output tokens were
present; exit0, no collision and8-card release. Python custom READY/prepared info messages were
absent under native logging; use native readiness plus HTTP evidence, not a required custom-log
count. Native peer-disconnect errors occurred during supervised teardown after success. The source
snapshot and current smoke script have identical ASTs (format-only difference). No new TP8 boot or
quality/performance qualification is implied.

BetterScale is the public product name from its first release. The0.3.2 package uses only
`betterscale`; do not reintroduce a former-name banner, alias explanation or private-prototype
migration instructions in installation copy. Historical measurement commits and capsule IDs retain
their real identities. Namespace consolidation does not reset release numbers or generate new
performance claims.

## Physical capacity release 0.4

Capacity is a separate section/data object, not a new throughput comparison. Commands omit fixed KV
bytes and fractions and admit a 512Ki input+output ceiling. TP ~14.94GiB/rank and DP ~7.9GiB/rank
are different native layouts. The 96.84% pressure observation is **TP dummy**; three running
requests include partial prefill, not three complete 448Ki histories resident. Real quality is 32
retained retrieval items; DP heavy pressure timed out. APC and preemption recovery are not qualified
by that capacity result. Keep these distinctions in both languages.

The final package passes the displayed-command checker. Browser checks include the capacity section
in both languages and desktop/mobile viewports; no need for another NPU run for site edits.

## Native prefix reuse 0.4.1

The normal TP/DP commands now enable prefix caching. The separate prefix-reuse section and JSON
object own runs194/195: each layout cold32/32 and warm32/32, positive warm hits and identical output
sequences; DP also passes16 repeated requests, two per engine. This is existing native APC
compatibility, not a new cache implementation or throughput comparison. DP uses engine-local caches:
the qualified cold/warm pairs used the native X-data-parallel-rank header. Explain session affinity
instead of promising cache hits under arbitrary load balancing. Historical0.4 capacity measurements
remain APC-off; preemption remains unresolved.

## Qwen27 mixed serving study (September 18)

The separate `#qwen-swe` section, `data/betterscale-qwen-swe.json` and
`docs/BETTERSCALE-QWEN-SWE.md` own the Qwen3.8-27B TP2 study. Do not put these measurements into the
DSV4 snapshot, PyPI0.4.1 availability claim, official leaderboard, homepage or achievements.
Fletcher confirmed the checkpoint's public name; `qwen3_5_text` describes its architecture, not a
different name.

Source4d08136, same-pair ABBA, eight selected complete Open-SWE-Traces sessions, 78 requests /20,648
output tokens at every C1/C2/C4/C8 limit. Both arms enable APC and native AIV; MTP off. Clear cache
after warmup/before every cohort and record actual cached tokens. The cancelled APC-off run is not
the control. Both APCon arms reused247,296 tokens at C1/C2/C4 and238,080 at C8, in each repeat.
Pooled gains13.15/14.89/17.85/21.36%; both observations, including native C8's119.74/125.99
variance, remain visible. HTTP TPOT summarizes per-request averages, not token-gap percentiles. This
is serving, not SWE task accuracy.

The browser checker compares all rendered Qwen throughput, repeated and latency values against the
separate snapshot, including mobile/desktop and both languages. Source deployment needs the
qualified native libraries; do not replace the DSV4 installation instructions with an unqualified
Qwen PyPI command. Public website publication still requires approval of the exact prepared copy.

Deployment observation: the public host injects a Cloudflare analytics script before `</body>`, so
raw HTML byte equality can fail even when all source content is live. Preserve a diff and exclude
only that identified hosting injection when comparing; do not broadly ignore script differences. The
observed CSS CDN cache lifetime was four hours; version changed stylesheet URLs in the HTML. During
Pages rollout, poll with a disposable query nonce rather than warming the final public version URL
with old content. Then verify the final entry URL itself. The Qwen rollout uses
`betterscale.html?v=152dac8#qwen-swe`; published HTML, CSS, JSON and methods match approved source.
Local rendered desktop/mobile EN/ZH tests passed; direct remote Chromium hit ERR_EMPTY_RESPONSE in
this environment, so live verification used HTTP content identity instead of claiming a live-browser
pass.

## Unified step-efficiency presentation (September 19)

The leading `#step-efficiency` table and Qwen/DSV4 SVGs use the separate
`data/betterscale-{qwen,dsv4}-steps.json` snapshots. `docs/BETTERSCALE-STEPS.md` owns methods,
configuration and exclusions. Headline numbers are decode **step rate** gains, not output token/s.
Qwen has22actual points; DSV4 has19TP +14DP. DSV4's two hollow-square candidate points have only
2valid cohorts from one startup; other arm/points have at least4. Preserve those limits and the37
excluded staggered derived cohorts. No historical snapshot was relabeled or service experiment
rerun.

`#graph-execution` distinguishes Qwen's mostly inside-forward decode improvement from DSV4's
between-target-forward improvement, which includes useful draft/sampling and is not pure idle.
Legacy incremental studies and service/quality/capacity sections remain in collapsed archives.
`assets/betterscale.js` opens enclosing details for old hash links; do not break published anchors.
The browser checker verifies headline ranges against the snapshots, loads both SVGs, checks old hash
reveal and validates all retained evidence on desktop/mobile in both languages. Full vector figures
open separately for small-screen inspection. This is source-result evidence, not a new Qwen PyPI
installation claim or official leaderboard entry.

## Direct installation commands (0.5.0)

The integration section now separates DSV4 and Qwen installation, complete launch, and request
checks. Both use PyPI0.5.0; Qwen's `python -m betterscale serve-qwen` launcher supplies packaged
native paths and pre-startup FIA preload. Do not restore source-only/manual-library instructions as
the normal user route. A pinned existing Linux/aarch64 Ascend runtime and local model weights remain
prerequisites. Historical performance numbers are not new0.5.0 measurements.

The MOD panel links directly to `#install-qwen`; DSV4 still has both full commands. Website CPU CI
assembles the sdist's prebuilt ARM payload and explicitly cross-installs its local wheel into a
target directory for Python/config inspection only. It never loads native ARM code. Actual
installed-service qualification belongs to BetterScale. Keep displayed command/version checks and
the browser checker aligned; cache-version assertions should require a versioned asset URL, not
freeze an obsolete nonce.

## MTP2 APC boundary increment (September 20, publication draft)

`#qwen-mtp-apc` is a compact collapsed increment beside Qwen MC2, not a replacement for the main
step curves. `data/betterscale-qwen-mtp-apc.json` and `docs/BETTERSCALE-QWEN-MTP-APC.md` retain all
measured cohorts and the shifted-input cache mechanism. Both arms are BetterScale MTP2, not native
vLLM. Same pair, same-day sequential runs, not ABBA; synthetic shared-prefix3073–3129 input /64
output tokens, APC on,6GiB KV. Output throughput includes prefill. C8 104.38→305.92tok/s (2.93×),
TTFT2.51→0.27s; do not relabel these as SWE, step-rate, released-wheel, or official-leaderboard
claims.

The lookahead-aware hash restores3072 rather than1536 cached tokens when the next token matches.
Changed lookahead still retreats a checkpoint. Cold/warm text and branch checks cover1536/3072
boundaries, not exhaustive state equivalence. Explicit MTP2 prototype only; K3 FIA failure remains
unresolved. Keep product install commands unchanged. Browser QA checks rendered values against the
snapshot and captures the new section in both languages at desktop/mobile widths. Exact public copy
still needs Fletcher's approval before publication; this entry is not proof of deployment.
