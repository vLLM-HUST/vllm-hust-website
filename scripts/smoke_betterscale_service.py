"""Run ONE displayed command on an already admitted Ascend host, not a benchmark.

The caller owns the eight-card lease, native CANN environment and descendant
supervision. Output stays in its run capsule; no service or input survives exit.
"""

import argparse
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request


def main(args):
    argv = json.loads(args.commands.read_text())[args.layout]
    assert argv[:3] == ["vllm", "serve", "/models/DeepSeek-V4-Flash"]
    argv[2] = str(args.model)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "command.json").write_text(json.dumps(argv, indent=2) + "\n")
    base = "http://127.0.0.1:8000"
    with (args.output / "server.log").open("w") as log:
        server = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 900
            while True:
                if server.poll() is not None:
                    raise RuntimeError(
                        f"Server exited before READY: {server.returncode}"
                    )
                try:
                    with urllib.request.urlopen(
                        base + "/health", timeout=2
                    ) as response:
                        if response.status == 200:
                            break
                except (urllib.error.URLError, TimeoutError):
                    pass
                if time.monotonic() > deadline:
                    raise TimeoutError("Server did not become ready within 900 seconds")
                time.sleep(3)
            payload = dict(
                model="dsv4", prompt="What is 2 + 2?", max_tokens=32, temperature=0
            )
            request = urllib.request.Request(
                base + "/v1/completions",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=180) as response:
                reply = json.load(response)
            assert reply["choices"] and reply["usage"]["completion_tokens"] > 0
            assert isinstance(reply["choices"][0]["text"], str)
            (args.output / "result.json").write_text(
                json.dumps(
                    dict(
                        status="PASS",
                        scope="READY, health and one short HTTP completion; not performance or quality acceptance",
                        layout=args.layout,
                        response=reply,
                    ),
                    indent=2,
                )
                + "\n"
            )
            print("PASS: health and short completion", flush=True)
        finally:
            server.terminate()
            try:
                server.wait(timeout=30)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commands", required=True, type=Path)
    parser.add_argument("--layout", choices=("dp8", "tp8"), default="dp8")
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    main(parser.parse_args())
