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
    assert len(checkouts) == 2
    assert all(step["with"]["ref"] == "main" for step in checkouts)
    assert all(step["with"]["persist-credentials"] == "false" for step in checkouts)
    assert checkouts[1]["with"]["repository"] == "vLLM-HUST/vllm-hust-benchmark"
    scripts = "\n".join(step.get("run", "") for step in build["steps"])
    assert "rev-parse HEAD" in scripts
    assert "sync_website_publication.py publish" in scripts
    assert "sync_website_publication.py check" in scripts
    assert '--revision "$benchmark_commit"' in scripts
    assert "test_benchmark_publication.py" in scripts
    assert "git push" not in scripts and "git commit" not in scripts
    deploy = workflow["jobs"]["deploy"]
    assert deploy["needs"] == "build"
    assert deploy["permissions"] == {"pages": "write", "id-token": "write"}
    assert deploy["environment"]["name"] == "github-pages"
