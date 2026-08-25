# vLLM-HUST Plugin Standard 1.0

This specification defines the minimum development and operations contract for a vLLM-HUST
plugin. It complements the plugin catalog: the catalog explains what extensions are planned or
available, while this document explains how a conforming extension is built and operated.

## 1. Scope

A conforming plugin is an independently versioned Python distribution that extends vLLM through a
supported Python entry-point group. It installs without modifying the vLLM-HUST source tree and can
be enabled, verified, disabled, and removed through a documented process.

Compiler backends, model-conversion tools, benchmark suites, deployment managers, and offline
analysis tools are adjacent assets unless they register a vLLM runtime entry point.

## 2. Entry-point groups

Choose the narrowest supported group:

| Group | Intended use | Process scope |
| --- | --- | --- |
| `vllm.general_plugins` | General runtime registration and extensions | API, engine-core, and worker processes |
| `vllm.platform_plugins` | Out-of-tree hardware platforms | Platform initialization in all relevant processes |
| `vllm.io_processor_plugins` | Input and output processors | API process |
| `vllm.stat_logger_plugins` | Statistics loggers | API process in asynchronous serving mode |

`vllm.platform_plugins` is reserved for hardware-platform implementations. A compiler, kernel
library, model-preparation utility, or benchmark is not a platform plugin merely because a runtime
uses it.

## 3. Required package structure

```text
<plugin-repository>/
├── pyproject.toml
├── README.md
├── CHANGELOG.md
├── src/<package>/
│   ├── __init__.py
│   └── plugin.py
└── tests/
    ├── test_entry_point.py
    ├── test_registration.py
    └── test_lifecycle.py
```

The package must declare one stable plugin identity:

```toml
[project]
name = "<distribution-name>"
version = "<version>"

[project.entry-points."vllm.general_plugins"]
<plugin-id> = "<package>.plugin:register"
```

The distribution name, import package, and plugin ID may differ, but each must remain stable within
a release line and must be documented together.

## 4. Registration contract

Registration must be re-entrant because vLLM can load plugins in multiple processes and can invoke
the same registration path more than once.

```python
_REGISTERED = False


def register() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    # Install one narrow runtime hook.
    _REGISTERED = True
```

A conforming registration function:

- installs the narrowest practical hook;
- produces the same result when called repeatedly;
- does not duplicate patches, threads, sockets, files, or global state;
- validates required configuration before serving requests;
- emits one activation record containing plugin ID and version;
- fails visibly when a required hook or compatibility condition is unavailable; and
- does not contain machine-specific paths, ports, device IDs, credentials, or model locations.

## 5. Compatibility and configuration

Each release documents:

- distribution version, import package, plugin ID, entry-point group, and callable;
- supported vLLM version range and the tested vLLM-HUST commit;
- supported platform and Python requirements;
- incompatible plugins or mutually exclusive runtime modes;
- every plugin-owned configuration variable, type, default, and validation rule; and
- safe fallback and rollback behavior.

Configuration names must use a plugin-specific prefix. Secrets must not appear in source, logs,
manifests, command examples, or generated artifacts.

## 6. Build, install, and discovery

Build a wheel and install it into the exact Python environment used by the serving processes on
every node:

```bash
export BUILD_PYTHON=/path/to/build/python
export RUNTIME_PYTHON=/path/to/serving/python
export PLUGIN_WHEEL=/path/to/plugin.whl

"${BUILD_PYTHON}" -m build
"${RUNTIME_PYTHON}" -m pip install "${PLUGIN_WHEEL}"
```

Before startup, verify that the expected entry point is discoverable from that same interpreter:

```bash
"${RUNTIME_PYTHON}" -c \
  'from importlib.metadata import entry_points; print([(e.name, e.value) for e in entry_points(group="vllm.general_plugins")])'
```

Installation alone does not prove activation.

## 7. Enable and start

Production services use an explicit allowlist:

```bash
export PLUGIN_ID=your-plugin-id
export MODEL=your-model
export PORT=your-port

VLLM_PLUGINS="${PLUGIN_ID}" vllm serve "${MODEL}" --port "${PORT}"
```

Multiple plugin IDs are comma-separated. If `VLLM_PLUGINS` is unset, vLLM loads every discovered
plugin. If it is set to an empty string, vLLM loads none.

All service-manager, container, model, port, and device values remain deployment inputs. They must
not be embedded in a plugin or in shared launch tooling.

## 8. Verify

Activation requires all of the following:

1. The intended entry point is discoverable in every serving environment.
2. Registration logs identify the plugin ID and version without exposing secrets.
3. The server reaches its readiness endpoint.
4. At least one functional request completes correctly.
5. Plugin-owned health, counters, or receipts are available when the plugin exposes them.

The standard readiness probe is:

```bash
curl --fail --silent "http://127.0.0.1:${PORT}/v1/models"
```

A smoke result validates discovery and lifecycle only. A performance claim requires a matched
baseline and treatment with the same model, requests, runtime, topology, and hardware allocation.

## 9. Stop and disable

vLLM plugins are process-scoped; Standard 1.0 does not define hot unload.

To disable a plugin:

1. Gracefully stop the owning service through its supervisor or send the foreground process its
   normal termination signal.
2. Wait for API, engine-core, and worker processes to exit.
3. Confirm plugin-owned threads, sockets, files, shared memory, and device resources are released.
4. Remove the plugin ID from the explicit allowlist, or set `VLLM_PLUGINS=""` to load none.
5. Restart and verify the baseline path.

Do not use broad process-name termination as a plugin shutdown mechanism.

For a directly owned process whose PID was recorded at startup, graceful termination is:

```bash
kill -TERM "${SERVER_PID}"
wait "${SERVER_PID}"
```

For a supervised deployment, use the supervisor's scoped stop operation instead of signaling a
child process behind the supervisor.

## 10. Remove and roll back

Only uninstall after every consuming process has stopped:

```bash
export PLUGIN_DISTRIBUTION=your-distribution-name
"${RUNTIME_PYTHON}" -m pip uninstall "${PLUGIN_DISTRIBUTION}"
```

Then verify that the entry point is absent, restart the baseline with an explicit allowlist, run the
readiness probe, and retain the previous wheel and configuration until rollback verification is
complete.

## 11. Conformance tests

A plugin may be presented as **vLLM-HUST conforming** only when automated tests cover:

- wheel build and installation into a clean environment;
- entry-point discovery;
- registration called twice in one process;
- registration in the required process roles;
- enabled startup and readiness;
- disabled startup and readiness;
- invalid configuration and compatibility rejection;
- graceful shutdown and cleanup; and
- baseline restart after disable or uninstall.

The plugin README must contain exact build, install, enable, start, verify, stop, disable, uninstall,
and rollback instructions for the released distribution.
