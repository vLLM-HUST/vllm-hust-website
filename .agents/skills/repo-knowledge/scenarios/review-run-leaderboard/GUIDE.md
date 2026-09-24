# Review or extend the run-oriented leaderboard

Enter here for the independent `leaderboard-runs.html` review entry, task tags, per-run percentile
display, or importing sealed repeats into that entry.

Fletcher chose an additive review page on 2026-09-22: leave the legacy leaderboard, its scripts and
the production publication protocol alone until tutor review. Do not resume benchmark experiments
merely to work on this presentation.

Read [the review handoff](../../../../../docs/LEADERBOARD-RUNS-REVIEW.md) for the interface, module
boundaries, evidence rebuild command and executable checks. The scripts there are site/CI consumers,
not private knowledge-plane helpers.

The costly evidence distinction to preserve: the existing TP2 snapshot contains 16 aggregate rows,
while sealed submissions contain 32 raw runs. P95 comes from raw compressed results; aggregate
constraints and averaged repeat P95 are not request-distribution percentiles. `tbt_ms` is the
producer's TPOT alias, whereas offline batch latency is not TTFT. Missing old metrics must remain
missing.

Although the new campaign shares hardware, historical publications include B3 as well as B2.
Fletcher chose a single flat table on 2026-09-23: include current and historical records by default,
with an explicit hardware column instead of a global hardware selector. Hardware remains part of
model identity; parallel configuration must not be inferred from accelerator count alone.

Before changing MOD attribution, read the audit section in the review handoff. Resolve canonical
names/maintainers from the workshop's `data/ecosystem.json`; reviewed publication-ID associations
live in `data/leaderboard_mod_attributions.json`. A legacy PR checkpoint proves lineage, not runtime
activation. Missing activation stays unknown/related, never silently native. Legacy repositories
were archived under `intellistream/*-legacy-20260831`; current MOD `PROVENANCE.md` resolves their
old PR identities. In particular, PR #49 offload compatibility is not KV Tiering, and the native
MTP2 arm's BetterScale worker bridge is not evidence that it ran the BetterScale treatment.

For the sibling Frontier view, read
[the Frontier handoff](../../../../../docs/LEADERBOARD-FRONTIER.md). It consumes a separate
production snapshot. Fletcher authorized the first native/BetterScale Qwen35 AgentX points as
explicitly labeled 15-minute smoke results, not formal results. Do not derive Frontier admission,
prices, or MOD activation from the historical run table. The pure model and browser checks exercise
the contract without using accelerator capacity.

AgentX metric import uses the official output throughput field, not a reconstructed token count /
900 seconds or the separately exported benchmark-duration statistic: native observation/drain
accounting differs. Its request `inter_token_latency` is TPOT; Fletcher selected P90 request decode
speed as fixed X, taken from `output_token_throughput_per_user.p90`, not inverse P90 TPOT. Inverse
mean TPOT remains only in downloaded metrics, not as another selectable chart axis. Keep
smoke/formal in distinct workload IDs, retain all allocated chips in the Y denominator, and preserve
both TTFT tails. Public evidence is a curated metric-only extract, not a claim that full private
logs/source capsules were published.

When publishing a Frontier snapshot, update its fetch URL revision and the HTML asset versions
alongside the data. The public HTML response advertises a ten-minute cache lifetime; a source-side
match does not prove an existing browser has discarded the initial empty JSON. The snapshot fetch
uses revalidation too. The browser test deliberately serves an empty unversioned URL to protect this
boundary. For a rollout handoff, link a versioned page URL before `#frontier` so an old HTML cache
cannot keep loading the old scripts.

Fletcher simplified Frontier after reviewing the first points: model + precision is one tag,
workload/context is one fixed contract, and P90 decode speed / per-chip output are fixed axes. Do
not restore hardware/MOD/axis selectors, the lower configuration table or long evidence text. Point
clicks open a compact anchored popover; its download preserves the complete cohort/point JSON, so
removing visual clutter does not discard provenance. Browser QA checks exact downloaded values,
keyboard/outside dismissal and mobile popup bounds.

The capacity16 concurrency sweep adds nine valid observations; BetterScale C1 failed only official
metric-duration coverage and stays out of Frontier. Preserve the two initial max-seqs8 C4 points,
but do not mix them into the new curves. The arms use individually tuned explicit KV budgets
(native24.25 / FULL20.25GiB per chip), not equal-KV controls; source and native C16 functional
limitations stay in the downloadable parameters and `FRONTIER-QWEN35-CONCURRENCY.md`.

A compact curves link accepts a local, optionally versioned SVG path in the workload contract;
absence/unsafe paths hide it. The popup shows request limit and explicit KV beside C/MTP. With11
points, the old18px invisible hit circles intercepted nearby mobile points: adaptive nonoverlapping
hit circles plus nearest-dot click selection remove SVG paint-order bias, without moving data. Keep
keyboard access and exact downloaded-point checks; never bypass interception with forced QA clicks.
Static curves use official metrics, separate P50/P95 TTFT/TPOT, and label excluded coverage.

On 2026-09-24 Fletcher selected one throughput view for accepted-equivalent HF/ModelScope Qwen35
weights, MTP configurations and warmup variants. Keep one model/cohort visible; each point carries
its actual checkpoint revision and `evidence.benchmark_protocol`. Historical TP2 uses MTP2/AL2.63
and pressure10-v1; new eight-chip C64 uses MTP0 and mandatory snapshot primers only (v2). Do not
claim identical initial cache state or pool these observations as repeats. The popover names warmup
and MTP; downloads preserve full protocols. The five old eight-chip C16 points were withdrawn and
must not return. See `docs/FRONTIER-QWEN35-EXPERT-SMOKE.md` for the accepted C64 evidence. Existing
concurrency curves describe the historical TP2 series only, not the new C64 arms.

The C64 TP8/TP8EP8 points nearly coincide (sub-pixel X separation on mobile). Nearest-dot selection
alone cannot make both touch targets usable. The popup's nearby-config buttons disambiguate points
within12 screen pixels without jittering measurements. Browser QA clicks real chart coordinates and
uses that user-visible chooser when needed, never forced clicks or hidden direct state changes.

Fletcher clarified right-side filtering on 2026-09-24: a separate sidebar outside the white chart
card, with MOD and MTP checkbox rows. All choices start checked, no “all” option; choices within
rows union and rows intersect. Empty selection means no points. Unknown remains separate from
explicit MTP0. Mobile places it below the chart, not inside the top picker. Recompute the envelope
from visible points, close hidden selections, retain stable series colors and show visible/total
counts. Single workload is a static selected-style pill, not a disabled select or a long-press-only
interaction; show the selector only with multiple choices. Filters survive language re-render, reset
on model/workload changes, and never mutate point evidence. Browser QA exercises real controls,
point IDs, envelopes, empty/unknown states and the future multiple-workload path.

SWE Prefix Reuse has its own cohort; enter `docs/FRONTIER-QWEN35-SWE-PREFIX.md` for real-token
continuation and the repaired MTP2 C64 expert matrix. Prepared-file hashes can differ solely through
tokenizer path/version metadata: only accept the recorded variant after exact comparison of all
session IDs/deltas/output budgets, policy and tokenizer fingerprint. Preserve the actual per-run
file hash. The 0.1.0 salt-aware relay and0.1.1 equal-valued correlation header preserve the same
session affinity; do not relabel a client revision. Native EP is proven across all41 target/draft
layers, and TP8's32-slot capacity limitation stays explicit.

A publication check on2026-09-24 received HTTP403 for default Python urllib's User-Agent while a
browser User-Agent returned200 with exact published data. Distinguish transport rejection from stale
content/deployment delay before waiting on Pages. Confirm Pages status and the versioned HTML/data,
not merely HTTP access. The same update found existing mdformat drift in three Frontier guides; full
CI checks all files, unlike a changed-file hook run. Formatting those guides changes no protocol or
measured values.

Fletcher explicitly requested the fixed-configuration concurrency tradeoff lines in the Frontier
main chart, not only a separate SVG. Declare `load.concurrency_series` only for points whose serving
settings are held constant; solid lines connect visible C levels in order, while the dashed Pareto
envelope remains distinct. Never join by MOD color alone: legacy max-seqs8 C4 and capacity16 C4 are
different configurations. `render_swe_frontier_curves.py` checks the capacity16 settings and
produces the linked standalone plot. Browser QA checks line vertices against actual point
coordinates and filtering, alongside normal popover/download behavior.

Independent authorized campaigns can add points to the same SWE cohort. Import by point/run ID and
preserve unrelated points, metric evidence and accepted prepared-file variants; replacing the whole
cohort with one campaign's local inventory loses published results. Fetch before publication and
resolve concurrent updates additively. A later interrupted window does not supply a score: preserve
earlier completed windows only with a verified timing boundary, continuous ownership guard evidence
and owned cleanup, and record the later interruption separately.
