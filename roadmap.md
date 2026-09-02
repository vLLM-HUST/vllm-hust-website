# vLLM-HUST Website Roadmap

Last reviewed: 2026-09-02

This roadmap covers the public website, its published data contracts, and evidence-backed project
reporting. Machine-specific operations, private service state, credentials, resource allocation, and
personal workspace details do not belong in this repository.

## Publishing principles

- Treat structured data as the source of truth and generate page content from it.
- Keep Chinese and English content semantically aligned.
- Publish only claims supported by a directly accessible repository, manifest, test, report,
  benchmark, paper, pull request, or release.
- Distinguish executable compatibility from source scaffolds and inspection-only repositories.
- Never infer maturity or performance from repository names, commit counts, simulated results, or
  static checks.
- Publish privacy-sanitized benchmark projections while retaining traceable repository-relative
  evidence paths.
- Do not publish machine identifiers, internal runner names, personal absolute paths, local service
  state, process identifiers, credentials, or private infrastructure details.

## Website and navigation

- Keep the home page, achievements, contributors, versions, plugins, issues, dataset validation, and
  leaderboard pages consistent about project scope and evidence standards.
- Maintain responsive desktop and narrow-screen layouts in both languages.
- Verify navigation, search, filters, expandable sections, and external links before each release.
- Show a specific reason when public data is unavailable or still awaiting verification; never
  render an empty label, `undefined`, or an unsupported generic claim.

## Plugin ecosystem

- Maintain one canonical record for every displayed MOD, including repository, maintainers, guidance
  relationships, maturity, compatibility, prerequisites, workload tags, public effect, and evidence.
- Keep internal advisors distinct from external advisors and external contributors.
- Require an explicit host, version range, platform scope, and prerequisites before describing a
  plugin as installable or available.
- Show inspection commands only for repositories that support inspection; do not present a launch
  command for an inspection-only or source-scaffold repository.
- Recheck repository accessibility, manifests, releases, and evidence links as part of scheduled
  metadata refreshes.

## Leaderboard and benchmark data

- Preserve the benchmark repository as the canonical source and publish a deterministic,
  privacy-sanitized projection on the website.
- Keep valid measurements, missing coverage, rejected runs, and true zero/error results as distinct
  states.
- Admit performance claims only when workload, engine revision, plugin revision, model, precision,
  hardware scope, runtime parameters, and evidence are sufficient for reproduction.
- Do not turn CPU smoke tests, replay, simulation, projection, or static validation into hardware
  performance claims.
- Continue automated checks for stale targets, incompatible same-spec groups, missing trend points,
  and accidental exposure of local environment metadata.

## Contributors and achievements

- Refresh public repository metrics from their authoritative sources.
- Keep people, GitHub identities, affiliations, and advisor relationships explicit and avoid merging
  identities without confirmation.
- Link achievement claims to current upstream pull requests, releases, papers, reports, or other
  direct evidence rather than duplicating time-sensitive status text in this roadmap.
- Preserve previously verified BidKV, DiffSpec, LatchMoE, and other project records unless newer
  evidence explicitly supersedes them.

## Release validation

Before merging a website release:

1. Validate every JSON file against its schema and run the full page-specific test suite.
1. Confirm expected item counts and required fields in all structured collections.
1. Exercise both languages, search, filters, workload navigation, and expandable content.
1. Render every main page at desktop and narrow-screen widths and check for clipping or overflow.
1. Check canonical repositories and evidence links for accessibility.
1. Scan published HTML, Markdown, JSON, and generated assets for internal environment identifiers,
   personal paths, empty display values, and unsupported claims.
1. Verify the deployed assets and data with cache bypassing after publication.

## Follow-up policy

- Fix complete, evidence-supported work in the main branch rather than leaving it in a long-lived
  task branch.
- Open an issue only when reliable public evidence, owner confirmation, or an external repository
  change is still required.
- Each follow-up issue should name the affected record, the exact missing contract or evidence, and
  the person or repository best placed to resolve it.
