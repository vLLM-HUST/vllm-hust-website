"""Check the installed public wheel and the exact displayed launch commands on CPU.

This does not start vLLM or certify accelerator execution. The separate service
smoke consumes the exported command on an admitted Ascend host.
"""

import argparse
import html
import importlib.metadata
import json
from pathlib import Path
import re
import shlex
import subprocess
from types import SimpleNamespace as NS


def commands(root):
    page = (root / "betterscale.html").read_text().split('id="integration"', 1)[1]
    blocks = re.findall(r"<pre><code>(vllm serve.*?)</code></pre>", page, re.S)
    assert len(blocks) == 2
    result = {}
    for block in blocks:
        command = html.unescape(block)
        subprocess.run(["bash", "-n"], input=command, text=True, check=True)
        argv = shlex.split(command.replace("\\\n", ""))
        layout = "dp8" if "--data-parallel-size" in argv else "tp8"
        result[layout] = argv
    script = (root / "assets/plugins-page.js").read_text()
    panel = script.split("    betterscale: {", 1)[1].split("    bidkv: {", 1)[0]
    copies = re.findall(r"command: String.raw`(.*?)`", panel, re.S)
    assert len(copies) == 2
    for block in copies:
        install, command = block.split("\n", 1)
        assert install == "python -m pip install --no-deps vllm-betterscale==0.3.2"
        argv = shlex.split(command.replace("\\\n", ""))
        assert argv in result.values(), "MOD and detail-page commands drifted"
    return result


def check(argv, layout):
    from betterscale.config import validate_worker_config

    def option(name, default=None):
        return argv[argv.index(name) + 1] if name in argv else default

    dp = layout == "dp8"
    spec = json.loads(option("--speculative-config"))
    graph = json.loads(option("--compilation-config"))
    extra = json.loads(option("--additional-config"))
    assert argv[:3] == ["vllm", "serve", "/models/DeepSeek-V4-Flash"]
    assert option("--worker-cls") == "betterscale.worker.Worker"
    assert option("--distributed-executor-backend") == "mp"
    assert "--async-scheduling" in argv
    assert option("--host") == "127.0.0.1" and option("--port") == "8000"
    assert option("--served-model-name") == "dsv4"
    assert option("--dtype") == "bfloat16"
    assert int(option("--kv-cache-memory-bytes")) == (8 if dp else 12) * 1024**3
    assert graph["cudagraph_capture_sizes"] == (
        [6, 12, 132, 264, 516, 1026] if dp else [24, 4128]
    )
    assert graph["max_cudagraph_capture_size"] == (1026 if dp else 4128)
    if dp:
        assert option("--data-parallel-size-local") == "8"
    # The real package's CPU admission function consumes these parsed settings.
    # Fixed model metadata describes the documented checkpoint, not a loaded model.
    validate_worker_config(
        NS(
            parallel_config=NS(
                tensor_parallel_size=int(option("--tensor-parallel-size")),
                data_parallel_size=int(option("--data-parallel-size", "1")),
                pipeline_parallel_size=1,
                enable_expert_parallel="--enable-expert-parallel" in argv,
                decode_context_parallel_size=1,
                prefill_context_parallel_size=1,
            ),
            scheduler_config=NS(
                max_num_seqs=int(option("--max-num-seqs")),
                max_num_batched_tokens=int(option("--max-num-batched-tokens")),
                scheduler_cls=None,
            ),
            model_config=NS(
                max_model_len=int(option("--max-model-len")),
                quantization=option("--quantization"),
                hf_config=NS(
                    model_type="deepseek_v4",
                    num_hidden_layers=43,
                    hidden_size=4096,
                    n_routed_experts=256,
                ),
            ),
            speculative_config=NS(**spec, rejection_sample_method="standard"),
            additional_config=extra,
            cache_config=NS(
                enable_prefix_caching="--no-enable-prefix-caching" not in argv
            ),
            load_config=NS(load_format="auto"),
            compilation_config=NS(cudagraph_mode=graph["cudagraph_mode"]),
        )
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    import betterscale
    from betterscale.compat import pins

    dist = importlib.metadata.distribution("vllm-betterscale")
    assert dist.version == betterscale.__version__ == "0.3.2"
    assert not dist.requires and not dist.entry_points
    assert pins()["source_files"]
    root = Path(__file__).resolve().parents[1]
    launch = commands(root)
    for layout, argv in launch.items():
        check(argv, layout)
    if args.output:
        args.output.write_text(json.dumps(launch, indent=2) + "\n")
    print(
        "PASS: public wheel installed; pins loaded; TP8/DP8 displayed commands agree and pass package admission (CPU only)"
    )


if __name__ == "__main__":
    main()
