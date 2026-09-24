"""Selection preserves run identity and refuses unlike comparison boundaries."""

import copy
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "curation", Path(__file__).parents[1] / "scripts/curate_frontier_repeats.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def point(name, throughput, speed):
    return {
        "id": name,
        "cohort_id": "same-workload",
        "configuration": {"mods": ["betterscale"], "parameters": {"source": "rev1"}},
        "load": {"concurrency": 4},
        "metrics": {"output_tps": throughput, "decode_p90_tps": speed},
        "evidence": {"status": "measured", "run_ids": [name]},
    }


def test_whole_winner_and_archive_are_preserved():
    data = {"points": [point("a", 10, 100), point("b", 20, 50)]}
    before = copy.deepcopy(data)
    result = module.curate(data)
    assert data == before
    assert [p["id"] for p in result["points"]] == ["b"]
    assert result["points"][0]["metrics"] == before["points"][1]["metrics"]
    assert result["archived_points"][0]["metrics"] == before["points"][0]["metrics"]
    assert result["points"][0]["frontier_selection"]["repeat_count"] == 2
    assert module.curate(result) == result


def test_different_boundaries_never_coalesce():
    original = point("a", 10, 100)
    others = []
    for index in range(5):
        p = point(str(index), 20, 50)
        if index == 0:
            p["cohort_id"] = "other-model-or-workload"
        elif index == 1:
            p["load"]["concurrency"] = 8
        elif index == 2:
            p["configuration"]["parameters"]["source"] = "rev2"
        elif index == 3:
            p["evidence"]["benchmark_protocol"] = {"duration": 3600}
        else:
            p["configuration"]["mods"] = []
        others.append(p)
    result = module.curate({"points": [original, *others]})
    assert len(result["points"]) == 6
    assert not result["archived_points"]


def test_missing_or_invalid_metrics_cannot_win():
    a, b = point("a", 10, 100), point("b", 1000, None)
    assert len(module.curate({"points": [a, b]})["points"]) == 2


def test_later_winner_retains_all_repeat_provenance():
    first = module.curate({"points": [point("a", 10, 100), point("b", 20, 50)]})
    first["points"].append(point("c", 30, 40))
    result = module.curate(first)
    assert result["points"][0]["frontier_selection"]["compared_point_ids"] == [
        "a",
        "b",
        "c",
    ]
    assert len(result["archived_points"]) == 2
    assert all(
        p["frontier_selection"]["selected_point_id"] == "c"
        for p in result["archived_points"]
    )


def test_observations_and_endpoint_labels_are_not_configuration_changes():
    a, b = point("a", 10, 100), point("b", 20, 50)
    for index, p in enumerate((a, b)):
        p["configuration"]["parameters"].update(
            observed_max_prompt_tokens=1000 + index,
            measured_mean_client_inflight=3.9 + index / 100,
            full_client_concurrency_fraction=0.9 + index / 100,
            server_command=[
                "serve",
                "$MODEL",
                "--port",
                str(8000 + index),
                "--served-model-name",
                p["id"],
            ],
        )
    assert [p["id"] for p in module.curate({"points": [a, b]})["points"]] == ["b"]


def test_different_measurement_windows_remain_separate():
    a, b = point("a", 10, 100), point("b", 20, 50)
    a["evidence"]["measurement_seconds"] = 900
    b["evidence"]["measurement_seconds"] = 3600
    assert len(module.curate({"points": [a, b]})["points"]) == 2


def test_reimporting_an_archived_run_does_not_duplicate_it():
    result = module.curate({"points": [point("a", 10, 100), point("b", 20, 50)]})
    result["points"].append(point("a", 10, 100))
    repeated = module.curate(result)
    assert len(repeated["points"]) == len(repeated["archived_points"]) == 1
    assert repeated["points"][0]["frontier_selection"]["repeat_count"] == 2
