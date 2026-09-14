# Present BetterScale execution results

Enter here when updating BetterScale's case study, importing new measurements, or connecting it to
site navigation.

- `betterscale.html` is the bilingual detail page. Its entry is an ordinary `.workshop-card` in
  `plugins.html`, not a featured banner. The `betterscale` component in `data/ecosystem.json` joins
  the same catalog renderer, search and filters as other MODs. `documentation_url` points to the
  detail page. Its sole workload tag is `distributed_pipeline` (displayed as 分布式 / Distributed).
- Fletcher replaced the old StateHarbor prototype: `stateharbor.public_surface` is false and its
  workload/community entries are removed. Historical registry identity remains, but it must not
  appear in the public MOD grid or search. There are still 22 visible MODs. Do not add a homepage or
  achievements entry.
- BetterScale is public under Apache-2.0 as of 2026-09-14. The normal card footer links to GitHub;
  the detail page also links source from its hero and integration section. Public metadata refresh
  may query the repository and display observed metrics. Keep generic private-repository handling
  for other components; do not remove it.
- `data/betterscale-results.json` is the curated public measurement snapshot; `docs/BETTERSCALE.md`
  explains comparators, methods and provenance. Keep chart numbers and scope consistent with the
  snapshot. Both repeat observations are visible, not averaged into one flattering number. The chart
  axis is 0–70 ms.
- The MOD catalog registration is explicitly requested by Fletcher. It does not admit these
  measurements to the official fixed-target leaderboard. The website is a renderer, not
  classification authority; see `.vllm-hust/repository-profile.json`.
- The implementation repository is now `vLLM-HUST/BetterScale` (public), renamed from
  `strengthen-dsv4`. Public `vllm-betterscale==0.3.0` is on PyPI; `betterscale.worker.Worker`
  aliases the same qualified `strengthen_dsv4` class. The card quickstart and detail page own
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
