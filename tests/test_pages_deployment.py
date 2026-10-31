"""Keep production data assembly separate from website data PRs."""

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]


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
    assert checkouts[0]["with"]["ref"] == "main"
    # Benchmark #572 refreshes MOD effects and preserves the joint measurement.
    # Freeze the same reviewed data identity across
    # deployment and both CI workflows instead of advancing to an untested main.
    benchmark_revision = (
        "c7e0ad58ec9f5793f91509a8783e26ccbe1a04fe"  # pragma: allowlist secret
    )
    assert checkouts[1]["with"]["ref"] == benchmark_revision
    policy_revision = (
        "8c2cfc3d2a78f334e113d38e5dd3c5f0272e373e"  # pragma: allowlist secret
    )
    assert checkouts[2]["with"]["ref"] == policy_revision
    assert checkouts[2]["with"]["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    assert checkouts[2]["with"]["sparse-checkout"] == "scripts/build_public_site.py"
    assert checkouts[2]["with"]["path"] == "publication-policy"
    for filename in (
        "ci.yml",
        "midterm-browser.yml",
        "sync-plugin-workshop-metadata.yml",
        "plugin-effects-browser.yml",
    ):
        source = yaml.load(
            (ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader
        )
        for job in source["jobs"].values():
            for step in job.get("steps", []):
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
