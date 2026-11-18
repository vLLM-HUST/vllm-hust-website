"""Keep production data assembly separate from website data PRs."""

from pathlib import Path
import re
import runpy
import tomllib

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_pin_update_keeps_data_and_visibility_policy_independent():
    helper = runpy.run_path(str(ROOT / "scripts/update_benchmark_publication.py"))
    pins = {"publication_revision": "a" * 40, "visibility_policy_revision": "b" * 40}
    for name in helper["WORKFLOWS"]:
        text = (ROOT / ".github/workflows" / name).read_text()
        updated = helper["render"](text, pins)
        workflow = yaml.load(updated, Loader=yaml.BaseLoader)
        for job in workflow["jobs"].values():
            for step in job.get("steps", []):
                checkout = step.get("with", {})
                if checkout.get("repository") == "vLLM-HUST/vllm-hust-benchmark":
                    policy = checkout.get("path") in {
                        "publication-policy",
                        ".publication-policy",
                    }
                    expected = pins[
                        "visibility_policy_revision"
                        if policy
                        else "publication_revision"
                    ]
                    assert checkout["ref"] == expected, (name, checkout)
        assert helper["render"](updated, pins) == updated


def test_deployment_uses_only_merged_sources_and_validated_artifact():
    workflow = yaml.load(
        (ROOT / ".github/workflows/deploy-benchmark-pages.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    assert "pull_request" not in workflow["on"]
    assert workflow["on"]["push"]["branches"] == ["main"]
    assert workflow["permissions"] == {"contents": "read"}
    build = workflow["jobs"]["build"]
    checkouts = [
        step
        for step in build["steps"]
        if step.get("uses", "").startswith("actions/checkout@")
    ]
    assert len(checkouts) == 3
    assert checkouts[0]["with"]["ref"] == "${{ github.sha }}"
    # MOD catalog and Workshop statistics use the reviewed canonical snapshot.
    # Freeze the same reviewed data identity across
    # deployment and both CI workflows instead of advancing to an untested main.
    pins = tomllib.loads((ROOT / ".github/benchmark-publication.toml").read_text())
    benchmark_revision = pins["publication_revision"]
    assert checkouts[1]["with"]["ref"] == benchmark_revision
    policy_revision = pins["visibility_policy_revision"]
    assert checkouts[2]["with"]["ref"] == policy_revision
    assert checkouts[2]["with"]["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    assert checkouts[2]["with"]["sparse-checkout"] == "scripts/build_public_site.py"
    assert checkouts[2]["with"]["path"] == "publication-policy"
    for filename in (
        "ci.yml",
        "leaderboard-runs.yml",
        "midterm-browser.yml",
        "sync-plugin-workshop-metadata.yml",
        "plugin-effects-browser.yml",
    ):
        source = yaml.load(
            (ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader
        )
        for job in source["jobs"].values():
            source_paths = {
                step["with"]["path"]
                for step in job.get("steps", [])
                if step.get("with", {}).get("repository")
                == "vLLM-HUST/vllm-hust-benchmark"
                and step["with"].get("ref") == benchmark_revision
            }
            allowed_revisions = {benchmark_revision} | {
                f'"$(git -C {path} rev-parse HEAD)"' for path in source_paths
            }
            for step in job.get("steps", []):
                command = step.get("run", "")
                if "sync_website_publication.py" in command:
                    revisions = re.findall(r'--revision\s+("[^\"]*"|\S+)', command)
                    assert revisions
                    assert all(value in allowed_revisions for value in revisions), (
                        filename,
                        revisions,
                    )
                if (
                    step.get("with", {}).get("repository")
                    == "vLLM-HUST/vllm-hust-benchmark"
                ):
                    expected = (
                        policy_revision
                        if step["with"].get("path") == ".publication-policy"
                        else benchmark_revision
                    )
                    assert step["with"]["ref"] == expected
    assert all(step["with"]["persist-credentials"] == "false" for step in checkouts)
    assert checkouts[1]["with"]["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    scripts = "\n".join(step.get("run", "") for step in build["steps"])
    assert "rev-parse HEAD" in scripts
    assert "sync_website_publication.py publish" in scripts
    assert "sync_website_publication.py check" in scripts
    assert '--revision "$benchmark_commit"' in scripts
    assert "test_benchmark_publication.py" in scripts
    assert "git push" not in scripts and "git commit" not in scripts
    assert "build_public_site.py" in scripts
    assert "--website website --output public-site" in scripts
    steps = build["steps"]
    projection = next(
        i
        for i, step in enumerate(steps)
        if "build_public_site.py" in step.get("run", "")
    )
    upload = next(
        i
        for i, step in enumerate(steps)
        if step.get("uses", "").startswith("actions/upload-pages-artifact@")
    )
    assert projection < upload
    assert steps[upload]["with"]["path"] == "public-site"
    deploy = workflow["jobs"]["deploy"]
    assert deploy["needs"] == "build"
    assert deploy["permissions"] == {"pages": "write", "id-token": "write"}
    assert deploy["environment"]["name"] == "github-pages"


def test_source_eligibility_precedes_execution_and_provenance_is_uploaded():
    workflow = yaml.load(
        (ROOT / ".github/workflows/deploy-benchmark-pages.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    assert set(workflow["on"]) == {"push", "workflow_dispatch", "repository_dispatch"}
    steps = workflow["jobs"]["build"]["steps"]
    guard = next(
        i
        for i, s in enumerate(steps)
        if "verify_release_sources.py" in s.get("run", "")
    )
    publication = next(
        i
        for i, s in enumerate(steps)
        if "sync_website_publication.py publish" in s.get("run", "")
    )
    assert guard < publication
    assert '--presentation-revision "${{ github.sha }}"' in steps[guard]["run"]
    projection = next(
        i for i, s in enumerate(steps) if "build_public_site.py" in s.get("run", "")
    )
    provenance = next(
        i
        for i, s in enumerate(steps)
        if "deployment-provenance.json" in s.get("run", "")
    )
    upload = next(
        i
        for i, s in enumerate(steps)
        if s.get("uses", "").startswith("actions/upload-pages-artifact@")
    )
    assert projection < provenance < upload


def test_each_ci_job_verifies_sources_before_running_publication_code():
    workflow = yaml.load(
        (ROOT / ".github/workflows/ci.yml").read_text(), Loader=yaml.BaseLoader
    )
    for job in workflow["jobs"].values():
        steps = job["steps"]
        guard = next(
            i
            for i, step in enumerate(steps)
            if "verify_release_sources.py --benchmark-only" in step.get("run", "")
        )
        publisher = next(
            i
            for i, step in enumerate(steps)
            if "sync_website_publication.py publish" in step.get("run", "")
        )
        assert guard < publisher
