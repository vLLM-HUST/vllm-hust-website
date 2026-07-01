# PyPI Release Remediation

This note tracks the cleanup needed after the website briefly mixed unrelated
package metadata into the vllm-hust release surface.

## Current State

- `vllm-hust` is the only vllm-hust PyPI package currently visible from the
  public index, and it only has the old `0.17.2.post1` release.
- `vllm-ascend-hust` and `vllm-hust-benchmark` do not currently resolve from
  `pip index versions` in this workspace.
- The website no longer treats external SageLLM package names as vllm-hust
  packages and no longer displays the old `vllm-hust` package as the current
  project version.

## Publishing Rules

- Publish only packages owned by the vllm-hust project line.
- Do not use external SageLLM package prefixes for vllm-hust artifacts.
- Do not present an old PyPI release as the current project version.
- Use a token scoped to the target PyPI project or organization; do not reuse
  tokens from unrelated repositories.

## Candidate Packages

| Package | Source repository | Status |
| --- | --- | --- |
| `vllm-hust` | `vLLM-HUST/vllm-hust` | Needs a new PyPI release |
| `vllm-ascend-hust` | `vLLM-HUST/vllm-ascend-hust` | Publish only after confirming package ownership and build readiness |
| `vllm-hust-benchmark` | `vLLM-HUST/vllm-hust-benchmark` | Optional; publish only if the benchmark CLI should be installed from PyPI |

## Required Credentials

Set one of the following in the current shell before uploading:

```bash
export TWINE_USERNAME=__token__
export TWINE_PASSWORD="<vllm-hust scoped PyPI token>"
```

or, if using `uv publish`:

```bash
export UV_PUBLISH_TOKEN="<vllm-hust scoped PyPI token>"
```

## Build And Upload

Run from the repository being published:

```bash
python -m pip install --upgrade build twine
python -m build
python -m twine check dist/*
python -m twine upload dist/*
```

For heavy packages such as `vllm-hust`, build in the intended release
environment and verify that the generated wheel imports cleanly before upload.

## Post-Publish Website Update

After the new PyPI release exists:

1. Update `data/version_meta.json` from `pending-republish` to the verified
   package version.
2. Restore the version page copy from "pending release" to the concrete release.
3. Keep the achievements page free of package-version cards unless the release
   evidence is precise and auditable.
4. Run:

   ```bash
   node --check assets/versions-page.js
   python -m pytest tests/test_site_structure.py
   bash scripts/check_stale_versions.sh
   ```

## External Package Cleanup

PyPI package deletion or deprecation requires project owner permissions and is
not available through ordinary package upload tokens. For externally owned
packages that used a misleading vllm-hust-like prefix:

1. Log in as a PyPI owner or maintainer for each affected project.
2. If safe, delete accidental releases from the PyPI project release page.
3. If deletion is not safe, update the PyPI project description to mark it as
   deprecated and point users to the correct SageLLM package name.
4. Publish any replacement packages under the SageLLM namespace before
   deprecating the old names.

