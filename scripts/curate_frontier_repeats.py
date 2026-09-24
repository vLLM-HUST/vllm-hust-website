#!/usr/bin/env python3
"""Keep one whole, measured BetterScale run per exactly identical configuration.

Conservative: different source/configuration or protocol metadata remain separate.
The archive retains complete superseded points; metric evidence is never removed.
"""

import argparse
import copy
import json
import math
from collections import defaultdict
from pathlib import Path


def curate(snapshot):
    result = copy.deepcopy(snapshot)
    groups = defaultdict(list)
    for point in result["points"]:
        config, evidence = point["configuration"], point["evidence"]
        if "betterscale" not in config["mods"] or evidence["status"] != "measured":
            continue
        metrics = point["metrics"]
        if not all(
            isinstance(metrics.get(key), (float, int))
            and not isinstance(metrics[key], bool)
            and math.isfinite(metrics[key])
            and metrics[key] > 0
            for key in ("output_tps", "decode_p90_tps")
        ):
            continue
        # These existing fields describe observed outcomes, not serving settings.
        comparable = copy.deepcopy(config)
        params = comparable["parameters"]
        for name in (
            "observed_max_prompt_tokens",
            "measured_mean_client_inflight",
            "full_client_concurrency_fraction",
        ):
            params.pop(name, None)
        command = params.get("server_command", [])
        for option in ("--port", "--served-model-name"):
            if option in command:
                command[command.index(option) + 1] = "$RUN_LABEL"
        protocol = copy.deepcopy(evidence.get("benchmark_protocol"))
        if isinstance(protocol, dict):
            protocol.pop("old_point_id", None)  # historical import provenance
        # All model/source/hardware/topology/capacity/protocol settings stay strict.
        key = json.dumps(
            [
                point["cohort_id"],
                comparable,
                point["load"],
                protocol,
                evidence.get("measurement_seconds"),
                evidence.get("profile"),
            ],
            sort_keys=True,
        )
        groups[key].append(point)
    removed = set()
    archive = result.setdefault("archived_points", [])
    for rows in groups.values():
        if len(rows) < 2:
            continue
        winner = min(rows, key=lambda p: (-p["metrics"]["output_tps"], p["id"]))
        compared = {p["id"] for p in rows}
        for p in rows:
            compared.update(
                p.get("frontier_selection", {}).get("compared_point_ids", [])
            )
        for old in archive:
            if old["id"] in compared:
                old["frontier_selection"]["selected_point_id"] = winner["id"]
        winner["frontier_selection"] = {
            "policy": "best observed output tokens/s/chip among exactly identical BetterScale configurations; entire winning run retained",
            "compared_point_ids": sorted(compared),
            "repeat_count": len(compared),
            "scope": "Observed best-of, not a repeatability estimate or a synthetic combination of metric maxima",
        }
        for point in rows:
            if point is winner:
                continue
            point["frontier_selection"] = {
                "policy": "superseded identical-configuration repeat",
                "selected_point_id": winner["id"],
            }
            existing = next((p for p in archive if p["id"] == point["id"]), None)
            if existing is None:
                archive.append(point)
            else:
                if (
                    existing["metrics"] != point["metrics"]
                    or existing["configuration"] != point["configuration"]
                ):
                    raise ValueError(f"Changed archived run identity: {point['id']}")
                existing["frontier_selection"] = point["frontier_selection"]
            removed.add(point["id"])
    result["points"] = [p for p in result["points"] if p["id"] not in removed]
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    args = parser.parse_args()
    original = json.loads(args.snapshot.read_text())
    result = curate(original)
    args.snapshot.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Archived {len(original['points']) - len(result['points'])} inferior repeats"
    )
