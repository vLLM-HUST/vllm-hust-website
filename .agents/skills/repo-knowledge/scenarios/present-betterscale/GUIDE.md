# Present BetterScale execution results

Enter here when updating BetterScale's case study, importing new measurements, or connecting it to
site navigation.

- `betterscale.html` is a bilingual, static case study; `assets/betterscale.css` provides its visual
  language. Native `assets/site.js` owns language selection. Home and achievements link to it
  through a separate case-study feature.
- `data/betterscale-results.json` is the curated public measurement snapshot; `docs/BETTERSCALE.md`
  explains comparators, methods and provenance. Keep chart numbers and scope consistent with the
  snapshot. Both repeat observations are visible, not averaged into one flattering number. The chart
  axis is 0–70 ms.
- This page is not an entry in the official fixed-target leaderboard or canonical MOD registry.
  Adding a case study does not authorize changing their counters or importing incompatible results.
  The website is a renderer, not classification authority; see `.vllm-hust/repository-profile.json`.
- At initial publication preparation, the implementation repo is private and named
  `strengthen-dsv4`; BetterScale is the project name. The qualified Python namespace remains
  `strengthen_dsv4`. Do not advertise an unshipped package or create public links to inaccessible
  source. The rename was blocked by absent admin permission.
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
