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

For the sibling Benchmark settings view, read
[the settings handoff](../../../../../docs/BENCHMARK-SETTINGS.md). It consumes a separate production
snapshot. Fletcher authorized the first native/BetterScale Qwen35 AgentX points as explicitly
labeled 15-minute smoke results, not formal results. Do not derive settings admission, prices, or
MOD activation from the historical run table. The pure model and browser checks exercise the
contract without using accelerator capacity.

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

Fletcher superseded the fixed-configuration main-chart lines on2026-09-25: show one independent
Pareto frontier per baseline/MOD, crossing allowed parallel settings and concurrency within the
selected cohort. Default to frontier vertices only; the right-sidebar checkbox restores all
dominated dots when unselected and survives language/cohort changes. Choose whole-run vertices,
never separately best X/Y. No global dashed line; filter changes recompute each group independently.
Failed-correctness points cannot enter or dominate a boundary, exact coordinate ties share one
stable line vertex, and singletons have no line. Original concurrency-series metadata and static
diagnostic sweeps retain their fixed-setting meaning. Browser QA independently checks group
membership, vertices and filters.

The same instruction withdraws BetterScale AE separation from all Frontier cohorts. Four formerly
visible points moved to `archived_points` with `display_withdrawal`; existing archives and metric
extracts stay intact. Future additive importers must not resurrect withdrawn IDs. This is not the
ordinary co-located BetterScale TP/DP/EP matrix, which remains displayed.

Independent authorized campaigns can add points to the same SWE cohort. Import by point/run ID and
preserve unrelated points, metric evidence and accepted prepared-file variants; replacing the whole
cohort with one campaign's local inventory loses published results. Fetch before publication and
resolve concurrent updates additively. A later interrupted window does not supply a score: preserve
earlier completed windows only with a verified timing boundary, continuous ownership guard evidence
and owned cleanup, and record the later interruption separately.

Fletcher's later September24 instruction selects the best complete BetterScale run for identical
configurations to reduce repeat noise. Before publishing newly imported repeats, use
`scripts/curate_frontier_repeats.py` and `docs/FRONTIER-REPEAT-SELECTION.md`: highest observed
throughput/chip chooses one whole run, with compared IDs and inferior complete points preserved in
`archived_points`. Never combine separately best throughput and P90. Source/configuration, model,
protocol, measurement window and concurrency stay distinct; existing observed prompt/occupancy
fields are outcomes, not configuration keys. Native points and other campaigns' unlike settings
remain intact. This is an explicit repeat-selection exception to displaying every observation, not
authority to drop a slower configuration or overwrite another campaign's inventory.

A September24 CI review exposed horizontal overflow after switching the mobile run table from
Chinese to English: document395px versus390px viewport, with `#view-frontier` extending to394.91px.
Local390px passed, but320px reproduced383px content. The culprit was the nonwrapping three-button
view switch, not the wide table inside its horizontal scroll container. Let the switch wrap while
preserving complete labels/counts; do not hide overflow or weaken the document-width assertion. The
run-browser check now includes320px with the language switch and retains bounded, unclipped layout
offenders plus a failure screenshot, so a remote-only layout failure carries actionable geometry
instead of another blind rerun.

Fletcher's latest September27 UI uses **并发服务规模 / Concurrent service scale** checkboxes, not the
earlier single-choice slider. All observed scales start checked; empty means no points. Allow
same-chart overlays but keep dominance and tie deduplication within cohort × MOD/group × depth.
Depth1 is solid/filled, depth2 dashed/hollow; legends name the scale. The popup reports C concurrent
requests and C×D active sessions, not C×D simultaneous requests. MOD / Group has a Select all /
Deselect all toggle: partial/empty becomes all, all becomes empty, without changing MTP or scale
filters. Preserve selections across language changes and reset on model/workload changes. Hide
depth1 static-curve links unless depth1 alone is checked. Downloads retain actual metadata.

AgentX is retired from active Frontier choices at Fletcher's request. Its cohort-level
`display_withdrawal` excludes its points from rendered choices/counts without deleting historical
records or breaking SWE provenance links. Do not resurrect it while importing new data or confuse
this withdrawal with the separate legacy Runs table.

The same September27 correction merges the unified Native campaign's25 SWE points into the existing
Qwen35 chart. Do not create another same-named model button merely for its ModelScope checkpoint
identifier. Preserve actual checkpoint/runtime/tool revisions per point and the original cohort in
`archived_cohorts`; `evidence.original_cohort_id` records the presentation move. Campaign-native
matched comparisons remain the authority for MOD speedups, not arbitrary cross-campaign pairing.

For DeepSeek V4 Flash INT8, enter `docs/FRONTIER-DSV4-SWE.md`. Its separate cohort uses the official
DSV4 encoder and 24 clean DSparkK5 windows, not Qwen tokens or BF16 weights. TP has four total
seats; DP has16. Preserve plateau/regression points and the explicit C64 omission rather than
implying a hardware ceiling. The append-only importer and separate metric extract retain existing
archives. Model/precision choices now live inside a native disclosure on the selected model tag; QA
must open the trigger before selecting a model, and checks Escape, outside dismissal, mobile bounds
and exact downloaded DSV4 coordinates.

For depth-control-only changes, use `scripts/verify_leaderboard_depth_browser.py` for bounded
responsive/multi-selection/isolation checks. The full Frontier checker downloads every historical
point in four views and took about20 minutes; do not make that exhaustive traversal the default for
a small selector edit. Keep the full check for evidence/export changes.

On October1 Fletcher explicitly restored the historical FULL-cache E36/R36 C32 observation
(`qwen35-sweprefix-cache-width-full-tp2-c32-d1-20260928`,613.88tokens/s/chip) from commit `85f6d48`
to the main SWE comparison. It is not part of the fixed E16/R20 C1–C16 sweep. Fletcher subsequently
unified C32 and E16/R20 under one **BetterScale** tag/checkbox: slot counts may be tuned for the
workload and do not create another MOD identity. The group is selected by default; graph mode,
execution/resident seats, balanced attention and cache policy belong in the popover. The original
metrics, run ID and configuration were unchanged; the C32 full-cache point moved out of the cache
study, while its incremental-cache peer remains there.

Fletcher then requested a connected BetterScale frontier: the main chart uses group Pareto vertices
across workload-tuned slots, within cohort and rotation depth, rather than its fixed-configuration
concurrency line. Other MODs retain measured-series lines. Fletcher clarified that the rationale
belongs only in the source comment at checkbox construction, not on the webpage: slot capacity is
tunable, C32 uses E36/R36, and both are one configuration family. Keep immutable load/configuration
evidence intact.

On October1 PR#340 excluded C32 again by restricting the main display whitelist to complete C1–C16
sweeps. Fletcher accepted that main-chart scope and instead requested the six-point BetterScale
C1–C32 line in **BetterScale residency and cache studies**, alongside only Native vLLM752a3a5 /
Ascend9bf964c FULL_AND_PIECEWISE C1–C16. The study references the eleven existing records through
`comparison_point_ids`; do not duplicate or move measurements, resurrect C32 in the main whitelist,
invent a native C32 value, or connect unrelated cache-ablation dots. All six BetterScale points are
joined in concurrency order, with E16/R20 versus E36/R36 retained in their original configurations.
Download the source cohort and the study separately. The bounded browser check is
`scripts/verify_betterscale_study_browser.cjs`.

On October6 Fletcher explicitly requested publication of the fixed E36/R36 concurrency campaign. The
main BetterScale group now additionally admits `swe-betterscale-e36-r36-cann901-knee-20261006`:
C32/36/37/40 with complete repeats archived under the existing whole-run best-of rule. This is an
extension of the earlier main-chart scope, not reinstatement of historical standalone C32. See
`docs/FRONTIER-QWEN35-CONCURRENCY-KNEE.md`; do not present the C37 overload cliff as physical device
capacity. The next investigation increases execution and residency together. Metadata-only raw-byte
replacement of tokenizer path and transformers version exactly reconstructs historical8044561f from
prepared3879dff; historical client8bb99eb and runtime identity still differ.

The later October6 width extension adds eight valid900s observations/six retained configurations
through C56; see `docs/FRONTIER-QWEN35-CONCURRENCY-WIDTH.md`. Capacity64 is an explicit source
patch, not unchanged96cd03a. Keep E/R-specific series IDs even though one BetterScale Pareto group
spans those capacities; singleton settings do not imply fixed-configuration sweeps. The first C56
window was contaminated by a parallel retrieval helper retaining another server's port and is
excluded, not a poorer repeat. Two300s cache-observer diagnostics are also not ranking scores.
Preserve the corrected endpoint receipts and the distinct source/configuration/card/co-run context
when importing new observations. Measured C48–C52 TTFT degradation is budget/workload-specific, not
a hardware limit.
