#!/usr/bin/env python3
"""Download fixed Engine sources, then run inference with automatic live logs."""

import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import sys
import tarfile
import urllib.parse
import urllib.request
import uuid

REPOSITORY = "vLLM-HUST/vllm-hust-engine"
COMMIT = '3c08084c64f44d96a8b17a376889fd2e3308bac2'  # pragma: allowlist secret -- fixed artifact identity
ASSET_ID = 751875930  # pragma: allowlist secret -- fixed artifact identity
ASSET_BYTES = 591189  # pragma: allowlist secret -- fixed artifact identity
ASSET_SHA256 = 'd27a7e2a1606a6ecf8935e48dc5c33dd276e396e4de422e93ca9a9226df40086'  # pragma: allowlist secret -- fixed artifact identity
MANIFEST_SHA256 = '0d81110910b3b8c2a122d9b7987ed08faa948888d5fadbcdc1d2ba672ae2c33a'  # pragma: allowlist secret -- fixed artifact identity
PREFIX = 'vllm-hust-engine'  # pragma: allowlist secret -- fixed artifact identity


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def token(env_file=None):
    for key in ("GH_TOKEN", "GITHUB_TOKEN"):
        if os.environ.get(key):
            return os.environ[key]
    if env_file is not None:
        candidates = [env_file]
        if not env_file.is_file():
            raise ValueError("Credential file does not exist: " + str(env_file))
    else:
        candidates = []
        for start in (Path.cwd(), Path(__file__).resolve().parent):
            candidates += [p / ".env" for p in (start, *start.parents)]
        candidates.append(Path.home() / ".env")
    for path in dict.fromkeys(candidates):
        if not path.is_file():
            continue
        values = {}
        for line in path.read_text().splitlines():
            match = re.match(
                r"^\s*(?:export\s+)?(GH_TOKEN|GITHUB_TOKEN)\s*=\s*(.*)$", line
            )
            if match:
                parts = shlex.split(match[2], comments=True, posix=True)
                if len(parts) == 1 and parts[0]:
                    values[match[1]] = parts[0]
        for key in ("GH_TOKEN", "GITHUB_TOKEN"):
            if key in values:
                return values[key]
    raise ValueError(
        "Set GH_TOKEN/GITHUB_TOKEN, use --env-file, or add a GitHub key to .env"
    )


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result is not None:
            target = urllib.parse.urlparse(newurl)
            if target.scheme != "https":
                raise ValueError("Refusing non-HTTPS asset redirect")
            if target.netloc != urllib.parse.urlparse(req.full_url).netloc:
                result.remove_header("Authorization")
        return result


def verify_tools(root):
    root = root.resolve()
    manifest = root / "DEPLOYMENT-TOOLS.json"
    if manifest.is_symlink() or sha(manifest) != MANIFEST_SHA256:
        raise ValueError("Engine tools manifest differs from externally fixed digest")
    data = json.loads(manifest.read_bytes())
    if (data["repository"], data["commit"]) != (REPOSITORY, COMMIT):
        raise ValueError("Engine tools version differs")
    expected = set(data["files"]) | {"DEPLOYMENT-TOOLS.json"}
    actual = {
        str(p.relative_to(root))
        for p in root.rglob("*")
        if p.is_file() or p.is_symlink()
    }
    if actual != expected:
        raise ValueError("Engine tools file inventory changed")
    for name, digest in data["files"].items():
        path = root / name
        if (
            path.is_symlink()
            or not path.resolve().is_relative_to(root)
            or sha(path) != digest
        ):
            raise ValueError("Engine tools file changed: " + name)
    return root


def extract(archive_path, out):
    with tarfile.open(archive_path) as archive:
        total = 0
        seen = set()
        for item in archive:
            path = PurePosixPath(item.name)
            if (
                path.is_absolute()
                or ".." in path.parts
                or not path.parts
                or path.parts[0] != PREFIX
            ):
                raise ValueError("Unsafe Engine archive path")
            if item.isdir():
                continue
            if not item.isfile() or len(path.parts) < 2 or item.name in seen:
                raise ValueError("Unsafe or duplicate Engine archive member")
            seen.add(item.name)
            total += item.size
            if total > 50 * 1024**2:
                raise ValueError("Engine tools archive exceeds size bound")
            target = out.joinpath(*path.parts[1:])
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(item) as source, target.open("xb") as dest:
                shutil.copyfileobj(source, dest)
    return verify_tools(out)


def ensure(cache, env_file=None, explicit=None):
    if explicit is not None:
        return verify_tools(explicit)
    cache.mkdir(parents=True, exist_ok=True)
    with (cache / "engine-tools.lock").open("a+b") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        dest = cache / ("engine-tools-" + COMMIT)
        if dest.exists():
            return verify_tools(dest)
        archive = cache / (ASSET_SHA256 + ".tar.gz")
        if not archive.exists():
            request = urllib.request.Request(
                "https://api.github.com/repos/"
                + REPOSITORY
                + "/releases/assets/"
                + str(ASSET_ID),
                headers={
                    "Authorization": "Bearer " + token(env_file),
                    "Accept": "application/octet-stream",
                    "User-Agent": "vllm-hust-third-party-bootstrap",
                },
            )
            partial = cache / ("download-" + uuid.uuid4().hex + ".partial")
            with (
                urllib.request.build_opener(SafeRedirect()).open(
                    request, timeout=120
                ) as response,
                partial.open("xb") as stream,
            ):
                shutil.copyfileobj(response, stream)
            if partial.stat().st_size != ASSET_BYTES or sha(partial) != ASSET_SHA256:
                raise ValueError("Fixed Engine Release asset checksum mismatch")
            partial.rename(archive)
        if archive.stat().st_size != ASSET_BYTES or sha(archive) != ASSET_SHA256:
            raise ValueError("Cached Engine Release asset changed")
        attempt = cache / ("engine-tools-attempt-" + uuid.uuid4().hex)
        attempt.mkdir()
        extract(archive, attempt)
        attempt.rename(dest)
        return verify_tools(dest)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog="Canonical inference entrypoint: vLLM-HUST/vllm-hust-engine/one_click.py. 评分说明：若选择HLE/Frontier，脚本复用同一份Qwen3.5-35B-A3B权重，在单独的固定B1阶段为两臂答案辅助评分，无需另备模型或外部裁判服务。评分增加整轮耗时，但其流量不计solver吞吐、TTFT/TPOT或单位token成本。这是同模型辅助评分，不是独立模型验证；裁判未决保留在分母并单列，不等同引擎请求失败。MMLU200使用固定答案和规则评分。 验收：一个固定数据集满足同一项目标全部条件即可；不要求五项均达标，不跨数据集拼接指标，专项要求另判。 MMLU-Pro is the frozen200 subset of source test12032; generation seed0 is not a sampling seed.",
    )
    parser.add_argument(
        "--engine-tools",
        type=Path,
        help="Explicit tools directory; must match the same externally pinned manifest",
    )
    parser.add_argument(
        "--tools-cache",
        type=Path,
        default=Path.home() / ".cache/vllm-hust-engine/bootstrap",
    )
    parser.add_argument("--env-file", type=Path)
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify fixed tools; SDK/weights are verified by --prepare-only before inference",
    )
    args, forwarded = parser.parse_known_args(argv)
    root = ensure(
        args.tools_cache.expanduser().resolve(), args.env_file, args.engine_tools
    )
    if args.verify_only:
        print(
            json.dumps(
                {
                    "commit": COMMIT,
                    "tools_verified": True,
                    "model_loaded": False,
                    "native_qualified": False,
                }
            )
        )
        return 0
    if not any(x == "--model" or x.startswith("--model=") for x in forwarded):
        forwarded += ["--model", "/models/Qwen3.5-35B-A3B"]
    if not any(x == "--out" or x.startswith("--out=") for x in forwarded):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        forwarded += ["--out", str(Path(__file__).parent / "runs" / stamp)]
    if args.env_file:
        forwarded += ["--env-file", str(args.env_file.resolve())]
    # Replace this wrapper: signals reach the actual controller, which waits for
    # its owned children to clean up before sealing evidence.
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH="")
    os.execve(
        sys.executable,
        [sys.executable, str(root / "one_click.py"), *forwarded],
        env,
    )


if __name__ == "__main__":
    raise SystemExit(main())
