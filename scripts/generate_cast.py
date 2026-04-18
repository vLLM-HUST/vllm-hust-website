from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


PROMPT = "\u001b[1;32muser@vllm-hust\u001b[0m:\u001b[1;34m~\u001b[0m$ "


def _http_get(url: str) -> str:
    with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
        return resp.read().decode("utf-8")


def _safe_get(url: str) -> str:
    try:
        return _http_get(url)
    except urllib.error.HTTPError as exc:
        return f"HTTP {exc.code}: {exc.reason}"
    except Exception as exc:  # noqa: BLE001
        return f"ERROR: {exc}"


def create_cast_file(filename: str, *, base_url: str, model: str, port: int) -> None:
    events: list[list[object]] = []
    header = {
        "version": 2,
        "width": 100,
        "height": 24,
        "timestamp": int(time.time()),
        "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    }
    current_time = 0.0

    def emit(text: str, *, speed: float = 0.0) -> None:
        nonlocal current_time
        if speed <= 0:
            events.append([current_time, "o", text])
            current_time += 0.08
            return
        for char in text:
            events.append([current_time, "o", char])
            current_time += speed

    def newline(lines: str = "") -> None:
        emit(lines.replace("\n", "\r\n") + "\r\n")

    def type_command(cmd: str, *, speed: float = 0.055) -> None:
        nonlocal current_time
        emit(PROMPT)
        current_time += 0.35
        emit(cmd, speed=speed)
        emit("\r\n")
        current_time += 0.25

    health_body = _safe_get(f"{base_url}/health").strip()
    models_body = _safe_get(f"{base_url}/v1/models").strip()

    type_command("pip install vllm-hust")
    newline("Collecting vllm-hust")
    newline("Successfully installed vllm-hust")
    newline()

    type_command(f"vllm-hust serve --backend cpu --model {model} --port {port}")
    newline("🌐 Starting vllm-hust Gateway...")
    newline(f"📦 Model: {model}")
    newline("🖥️  Backend: cpu")
    newline(f"✅ OpenAI-compatible API ready at http://localhost:{port}")
    newline()

    type_command(f"curl http://localhost:{port}/health")
    newline(health_body)
    newline()

    type_command(f"curl http://localhost:{port}/v1/models")
    newline(models_body)
    newline()

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        f.write(json.dumps(header, ensure_ascii=False) + "\n")
        for event in events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a website cast from a live vllm-hust service"
    )
    parser.add_argument("output", nargs="?", default="demos/vllm-hust-inference.cast")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--model", default="sshleifer/tiny-gpt2")
    parser.add_argument("--port", type=int, default=8888)
    args = parser.parse_args()
    create_cast_file(
        args.output,
        base_url=args.base_url.rstrip("/"),
        model=args.model,
        port=args.port,
    )


if __name__ == "__main__":
    main()
