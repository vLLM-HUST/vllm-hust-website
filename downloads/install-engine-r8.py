#!/usr/bin/env python3
"""Install the published r8 sources under pip's official distribution names.

Maintained in vLLM-HUST/vllm-hust-engine; the website serves an identical copy.
No model import, device initialization, source recompilation or private download.
"""

import argparse
import base64
import csv
from email.parser import BytesParser
import hashlib
import importlib.metadata as metadata
import io
import json
import os
from pathlib import Path, PurePosixPath
import platform
import subprocess
import sys
import tarfile
import zipfile

VERSION = "2026.11.17.8"
RELEASE = "full-answer-b1-20261117-r8"
SDK_SHA256 = "3f7eacc177cc70c1d1b20312157c47dbe11b4068b1b20631f026f34d3e34754a"  # pragma: allowlist secret -- public SDK checksum
SDK_BYTES = 124347355
TAG = "cp312-cp312-linux_aarch64"
CRITICAL = {
    "torch": "2.13.0+cpu",
    "torch-npu": "2.13.0rc1",
    "transformers": "5.14.1",
    "triton-ascend": "3.6.0",
    "tokenizers": "0.22.2",
}
ASCEND_ENTRY_POINTS = """[vllm.platform_plugins]
ascend = vllm_ascend:register

[vllm.general_plugins]
ascend_kv_connector = vllm_ascend:register_connector
ascend_model_loader = vllm_ascend:register_model_loader
ascend_service_profiling = vllm_ascend:register_service_profiling
ascend_model = vllm_ascend:register_model

[ms_service_metric.providers]
vllm-ascend = vllm_ascend.observability:get_metric_provider
"""
BOOTSTRAP = '''"""The frozen Ascend compatibility hook; never import Torch at startup."""
import importlib.util
from pathlib import Path
def install_compatibility():
    path = Path(__file__).parent / "sdk/runtime/compat/sitecustomize.py"
    spec = importlib.util.spec_from_file_location("_hust_r8_compatibility", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
'''


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_sdk(archive):
    """Read only regular, uniquely named files; never extract untrusted paths."""
    result = {}
    with tarfile.open(archive) as source:
        seen = set()
        for member in source:
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or not path.parts:
                raise ValueError("Unsafe SDK archive path")
            if str(path) in seen:
                raise ValueError("Duplicate SDK archive member")
            seen.add(str(path))
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError("SDK archive contains a link or special file")
            result[str(path)] = source.extractfile(member).read()
    return result


def metadata_bytes(name, version, dependencies=()):
    text = (
        f"Metadata-Version: 2.2\nName: {name}\nVersion: {version}\n"
        "Summary: Frozen vLLM-HUST r8 runtime\nRequires-Python: >=3.12,<3.13\n"
        "License: Apache-2.0\n"
    )
    text += "".join(f"Requires-Dist: {dep}\n" for dep in dependencies)
    return (text + "\n").encode()


def wheel(out, name, version, files, package_metadata, entry_points=None):
    normalized = name.replace("-", "_")
    directory = f"{normalized}-{version}.dist-info"
    entries = dict(files)
    entries[directory + "/METADATA"] = package_metadata
    entries[directory + "/WHEEL"] = (
        "Wheel-Version: 1.0\nGenerator: vllm-hust-frozen-installer\n"
        f"Root-Is-Purelib: false\nTag: {TAG}\n"
    ).encode()
    if entry_points:
        entries[directory + "/entry_points.txt"] = entry_points
    record = io.StringIO(newline="")
    writer = csv.writer(record, lineterminator="\n")
    for path, data in sorted(entries.items()):
        value = (
            base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip("=")
        )
        writer.writerow([path, "sha256=" + value, len(data)])
    writer.writerow([directory + "/RECORD", "", ""])
    entries[directory + "/RECORD"] = record.getvalue().encode()
    target = out / f"{normalized}-{version}-{TAG}.whl"
    with zipfile.ZipFile(target, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, data in sorted(entries.items()):
            item = zipfile.ZipInfo(path, date_time=(2026, 11, 17, 0, 0, 0))
            item.external_attr = 0o100644 << 16
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, data)
    return target


def build_wheels(files, out):
    profile = json.loads(files["deployment.json"])
    if profile["release"] != RELEASE:
        raise ValueError("SDK release is not r8")
    pins = json.loads(files["provenance/installed-files.json"])
    for path, expected in pins.items():
        if path not in files or digest(files[path]) != expected:
            raise ValueError("Frozen source changed: " + path)
    print(f"[r8] Verified {len(pins)} frozen runtime files", flush=True)
    versions = profile["host_contract_qualification"]["installed_metadata"]
    core_metadata = BytesParser().parsebytes(
        files["runtime/engine-core/vllm.egg-info/PKG-INFO"]
    )
    if core_metadata["Name"] != "vllm" or core_metadata["Version"] != versions["vllm"]:
        raise ValueError("Frozen vllm distribution identity mismatch")
    dependencies = core_metadata.get_all("Requires-Dist", [])
    # Keep runtime requirements, but do not advertise unbundled upstream extras.
    dependencies = [
        d for d in dependencies if "extra ==" not in d and "extra==" not in d
    ]
    dependencies.append(f"vllm-hust-runtime=={VERSION}")
    namespace_wheels = []
    for name, prefix, ep, requires in [
        (
            "vllm",
            "runtime/engine-core/",
            files["runtime/engine-core/vllm.egg-info/entry_points.txt"],
            dependencies,
        ),
        (
            "vllm-ascend",
            "runtime/ascend/",
            ASCEND_ENTRY_POINTS.encode(),
            [
                f"vllm=={versions['vllm']}",
                f"vllm-hust-runtime=={VERSION}",
                *[f"{key}=={value}" for key, value in CRITICAL.items()],
            ],
        ),
    ]:
        print(f"[r8] Building local {name} wheel", flush=True)
        namespace = name.replace("-", "_")
        contents = {
            p[len(prefix) :]: data
            for p, data in files.items()
            if p.startswith(prefix + namespace + "/")
        }
        if namespace + "/__init__.py" not in contents:
            raise ValueError("Missing frozen namespace " + namespace)
        contents[f"{namespace}-{versions[name]}.dist-info/licenses/LICENSE"] = files[
            "runtime/engine-core/LICENSE"
        ]
        namespace_wheels.append(
            wheel(
                out,
                name,
                versions[name],
                contents,
                metadata_bytes(name, versions[name], requires),
                ep,
            )
        )
    # Preserve the SDK and its MODs byte-for-byte. Only the compatibility finder
    # is active globally; model-specific MODs use the frozen evaluation launcher.
    runtime = {"vllm_hust_runtime/sdk/" + p: data for p, data in files.items()}
    print("[r8] Building runtime/MOD support wheel", flush=True)
    runtime["vllm_hust_runtime/__init__.py"] = BOOTSTRAP.encode()
    runtime[f"vllm_hust_runtime-{VERSION}.dist-info/licenses/LICENSE"] = files[
        "runtime/engine-core/LICENSE"
    ]
    runtime["vllm_hust_runtime.pth"] = (
        b"import vllm_hust_runtime; vllm_hust_runtime.install_compatibility()\n"
    )
    namespace_wheels.append(
        wheel(
            out,
            "vllm-hust-runtime",
            VERSION,
            runtime,
            metadata_bytes("vllm-hust-runtime", VERSION),
        )
    )
    report = {
        "schema": "vllm-hust-official-namespace-install/v1",
        "release": RELEASE,
        "package_version": VERSION,
        "sdk_sha256": SDK_SHA256,
        "verified_runtime_files": len(pins),
        "versions": versions,
        "wheels": {p.name: digest(p.read_bytes()) for p in namespace_wheels},
        "native_imports_tested": False,
        "model_started": False,
    }
    (out / "build.json").write_text(json.dumps(report, indent=2) + "\n")
    return namespace_wheels, report


def preflight():
    if (
        sys.platform != "linux"
        or platform.machine() != "aarch64"
        or sys.version_info[:2] != (3, 12)
    ):
        raise ValueError("Requires CPython 3.12 / Linux aarch64 / CANN 9.1.0")
    if sys.prefix == sys.base_prefix:
        raise ValueError("Run with the Python of the target virtual environment")
    for name, expected in CRITICAL.items():
        try:
            actual = metadata.version(name)
        except metadata.PackageNotFoundError:
            actual = "missing"
        if actual != expected:
            raise ValueError(
                f"Install qualified dependencies first: {name} expected {expected}, found {actual}"
            )


def admit_requirements(wheels):
    # pip is required for installation; its vendored parser avoids a new dependency.
    from pip._vendor.packaging.requirements import Requirement

    records = []
    for path in wheels:
        with zipfile.ZipFile(path) as archive:
            name = next(
                n
                for n in archive.namelist()
                if n.endswith(".dist-info/METADATA") and "/sdk/" not in n
            )
            records.append(BytesParser().parsebytes(archive.read(name)))
    supplied = {r["Name"].lower().replace("_", "-") for r in records}
    failures = []
    for record in records:
        for text in record.get_all("Requires-Dist", []):
            req = Requirement(text)
            if req.name.lower().replace("_", "-") in supplied or (
                req.marker and not req.marker.evaluate({"extra": ""})
            ):
                continue
            try:
                actual = metadata.version(req.name)
                if req.specifier and not req.specifier.contains(
                    actual, prereleases=True
                ):
                    failures.append(f"{req} (installed {actual})")
            except metadata.PackageNotFoundError:
                failures.append(f"{req} (missing)")
    if failures:
        raise ValueError(
            "Runtime dependencies must be satisfied before replacement: "
            + "; ".join(sorted(set(failures)))
        )


def verify_installed(report):
    """Fresh process: verify actual resolution and every installed source byte."""
    code = r"""
import hashlib,importlib.metadata as m,importlib.util as u,json,sys,sysconfig
from pathlib import Path
expected=json.loads(sys.argv[1]);site=Path(sysconfig.get_path('platlib')).resolve()
result={}
for name,module,prefix in [('vllm','vllm','runtime/engine-core/'),('vllm-ascend','vllm_ascend','runtime/ascend/')]:
    d=m.distribution(name)
    if d.version!=expected['versions'][name]:raise ValueError('Wrong distribution: '+name)
    spec=u.find_spec(module)
    if not spec or Path(spec.origin).resolve()!=site/module/'__init__.py':raise ValueError('Shadowed namespace: '+module)
    result[module]=spec.origin
    sdk=site/'vllm_hust_runtime/sdk'
    pins=json.loads((sdk/'provenance/installed-files.json').read_bytes())
    for path,sha in pins.items():
        if path.startswith(prefix+module+'/'):
            if hashlib.sha256((site/path[len(prefix):]).read_bytes()).hexdigest()!=sha:raise ValueError('Installed source mismatch: '+path)
    if name=='vllm':
        eps=[e for e in d.entry_points if e.group=='console_scripts' and e.name=='vllm']
        if len(eps)!=1 or eps[0].value!='vllm.entrypoints.cli.main:main':raise ValueError('Wrong vllm command')
        cli=Path(sysconfig.get_path('scripts'))/'vllm'
        if not cli.is_file() or not cli.read_bytes().startswith(b'#!'):raise ValueError('Missing vllm command')
if {'torch','torch_npu','vllm','vllm_ascend'} & set(sys.modules):raise ValueError('Native modules imported by installer')
print(json.dumps(result))
"""
    env = {k: v for k, v in os.environ.items() if k not in ("PYTHONPATH", "PYTHONHOME")}
    p = subprocess.run(
        [sys.executable, "-I", "-c", code, json.dumps(report)],
        check=True,
        text=True,
        capture_output=True,
        env=env,
    )
    return json.loads(p.stdout)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="New directory for wheels, before/after receipts and logs",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Create wheels without changing the environment",
    )
    args = parser.parse_args(argv)
    if not args.build_only:
        preflight()
    else:
        if (
            sys.platform != "linux"
            or platform.machine() != "aarch64"
            or sys.version_info[:2] != (3, 12)
        ):
            raise ValueError("Build on CPython 3.12 / Linux aarch64; no ABI retagging")
    if args.out.exists() or args.out.is_symlink():
        raise ValueError("Use a new --out directory")
    if metadata.version("vllm-hust-engine") != VERSION:
        raise ValueError(f"First install vllm-hust-engine=={VERSION}")
    package = metadata.distribution("vllm-hust-engine")
    archive = Path(package.locate_file("vllm_hust_engine/payload/sdk-r8.tar.gz"))
    if (
        archive.stat().st_size != SDK_BYTES
        or digest(archive.read_bytes()) != SDK_SHA256
    ):
        raise ValueError("Published SDK archive hash mismatch")
    files = read_sdk(archive)
    args.out.mkdir(parents=True)
    wheels, report = build_wheels(files, args.out)
    if args.build_only:
        print(json.dumps(report, indent=2))
        return
    admit_requirements(wheels)
    print("[r8] Dependencies admitted; replacing packages with pip", flush=True)
    before = {
        d.metadata["Name"]: d.version
        for d in metadata.distributions()
        if d.metadata["Name"]
    }
    (args.out / "before.json").write_text(json.dumps(before, indent=2) + "\n")
    # All artifacts exist and passed source/hash checks before pip touches old packages.
    command = [
        sys.executable,
        "-m",
        "pip",
        "--isolated",
        "install",
        "--no-index",
        "--no-deps",
        "--force-reinstall",
        *[str(p.resolve()) for p in wheels],
    ]
    with (args.out / "pip-install.log").open("w") as log:
        print(f"[r8] pip log: {args.out / 'pip-install.log'}", flush=True)
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(
            f"pip failed; see {args.out / 'pip-install.log'}; retain wheels and the before.json receipt"
        )
    report["installed_namespaces"] = verify_installed(report)
    report["status"] = "official_namespaces_replaced"
    report["mods_activation"] = (
        "Use the frozen r8 launcher; generic vllm serve does not select the Qwen35 MOD stack"
    )
    (args.out / "installed.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        OSError,
        RuntimeError,
        metadata.PackageNotFoundError,
        subprocess.CalledProcessError,
    ) as error:
        print("R8_INSTALL_ERROR: " + str(error), file=sys.stderr)
        sys.exit(2)
