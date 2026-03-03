import json
import time
import sys


def create_cast_file(filename):
    # Header
    events = []

    # Metadata
    header = {
        "version": 2,
        "width": 100,
        "height": 24,
        "timestamp": int(time.time()),
        "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    }

    # Helper to add output event
    # Format: [time, type, data]
    # type "o" is stdout
    current_time = 0.0

    def type_command(cmd, speed=0.1):
        nonlocal current_time
        # Prompt
        events.append(
            [
                current_time,
                "o",
                "\u001b[1;32muser@sagellm\u001b[0m:\u001b[1;34m~\u001b[0m$ ",
            ]
        )
        current_time += 0.5

        for char in cmd:
            events.append([current_time, "o", char])
            current_time += speed

        events.append([current_time, "o", "\r\n"])
        current_time += 0.2

    def print_output(text, speed=0.0):
        nonlocal current_time
        if speed == 0:
            events.append([current_time, "o", text + "\r\n"])
            current_time += 0.05
        else:
            for char in text:
                events.append([current_time, "o", char])
                current_time += speed
            events.append([current_time, "o", "\r\n"])

    def stream_tokens(text, token_speed=0.02):
        nonlocal current_time
        # Simulate token generation (words or subwords)
        import re

        # Fix: terminal needs \r\n for new line, regular string has only \n
        text = text.replace("\n", "\r\n")
        tokens = re.split(r"(\s+)", text)
        for token in tokens:
            if not token:
                continue
            events.append([current_time, "o", token])
            current_time += token_speed

    # 1. Type the command
    type_command('sage-llm run -p "Explain quantum physics" --backend ascend')

    # 2. Output header (Match real v0.4 output exactly)
    print_output("\r\n\u001b[1m🚀 sageLLM Inference\u001b[0m\r\n", 0)
    print_output("  Model: \u001b[36mdeepseek-coder-33b\u001b[0m", 0)
    print_output("  Backend: ascend", 0)
    print_output("  Prompt: Explain quantum physics", 0)
    print_output("", 0)

    # 3. Logs (Simulate real logs - match actual output format)
    def log(source, msg):
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S,") + "200"
        print_output(f"{timestamp} - {source} - INFO - {msg}", 0)

    log(
        "sagellm_core.llm_engine",
        "LLMEngine created: model=deepseek-coder-33b, backend=ascend, comm=auto",
    )
    print_output("Loading model...", 0)
    current_time += 0.5
    log("sagellm_core.llm_engine", "Starting LLMEngine with model: deepseek-coder-33b")
    log(
        "sagellm_backend.providers.ascend", "AscendBackendProvider initialized on npu:0"
    )
    log("sagellm_backend.registry", "Created provider: ascend -> Huawei Ascend 910B")
    log("sagellm_core.llm_engine", "Backend initialized: ascend (Huawei Ascend 910B)")
    current_time += 0.3
    log("sagellm_core.llm_engine", "Loading tokenizer...")
    current_time += 0.2
    log("sagellm_core.llm_engine", "Model loaded: deepseek-coder-33b")
    log("sagellm_core.llm_engine", "LLMEngine started successfully")

    # 4. Output label (match real format: label on one line, content on next)
    print_output("📝 Output:", 0)
    current_time += 0.2

    # 5. Streaming Output
    response_text = "Quantum physics studies matter and energy at the most fundamental, atomic levels. It describes phenomena like superposition, entanglement, and wave-particle duality that govern subatomic particles."
    stream_tokens(response_text, 0.06)

    events.append([current_time, "o", "\r\n\r\n"])
    current_time += 0.2

    # 6. Metrics (match real format)
    print_output("📊 Metrics:", 0)
    print_output("   TTFT: 45.2 ms", 0)
    print_output("   Throughput: 80.0 tokens/s", 0)

    current_time += 0.5
    log("sagellm_core.llm_engine", "Stopping LLMEngine")
    log("sagellm_core.llm_engine", "LLMEngine stopped")

    # Done
    events.append([current_time, "o", "\r\n"])
    current_time += 2.0

    # Write file
    with open(filename, "w") as f:
        f.write(json.dumps(header) + "\n")
        for event in events:
            f.write(json.dumps(event) + "\n")


if __name__ == "__main__":
    create_cast_file(sys.argv[1] if len(sys.argv) > 1 else "demo.cast")
