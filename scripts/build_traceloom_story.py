"""Extract a small, public-safe measured view; render SVGs from that snapshot.

Pass both Perfetto traces and the graph AugDB to refresh data. With no arguments,
regenerate the figures from the checked-in sanitized snapshot. No raw request or
scheduler identifiers, prompts, absolute clocks, or local paths are published.
"""

import argparse
import gzip
import html
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/traceloom-story.json"


def read_trace(path):
    with gzip.open(path, "rt") as source:
        return json.load(source)


def extract(deepseek, qwen, database):
    d = read_trace(deepseek)
    ds = [e for e in d["traceEvents"] if e.get("ph") == "X" and e.get("pid") == 110]
    layers = sorted(
        [e for e in ds if e["name"].startswith("layer ·")], key=lambda e: e["ts"]
    )
    events = [e for e in ds if e["cat"] == "traceloom.timeline_event"]
    # First three complete layer instances whose window has visible overlap.
    for i in range(len(layers) - 2):
        selected = layers[i : i + 3]
        start = selected[0]["ts"]
        end = max(e["ts"] + e["dur"] for e in selected)
        members = [
            e for e in events if start <= e["ts"] and e["ts"] + e["dur"] <= end + 1e-6
        ]
        if len({e["tid"] for e in members}) > 1 and end - start <= 1.3 * sum(
            e["dur"] for e in selected
        ):
            break
    else:
        raise ValueError("No complete multi-layer concurrent display window")
    structure = [
        e
        for e in ds
        if e["cat"] == "traceloom.structural_interval"
        and e["name"].split(" · ")[0] in {"layer", "attention", "moe"}
        and start <= e["ts"]
        and e["ts"] + e["dur"] <= end + 1e-6
    ]

    def interval(e, origin, **extra):
        return {
            "label": e["name"],
            "start_us": round(e["ts"] - origin, 6),
            "duration_us": e["dur"],
            **extra,
        }

    deep = {
        "capture": "DeepSeek-V4-Flash-0731-w8a8 / donor c32 / TP8 / rank 3 / 2026-09-12",
        "analyzer_version": "0.1.4",
        "analyzer_commit": "0d65fea",
        "selection": "First three consecutive complete layers with overlapping displayed events and inter-layer gaps below 30% of summed layer envelopes",
        "span_us": end - start,
        "layer_count_full_capture": len(layers),
        "rules": "deepseekv4.yaml + host-launch ordering",
        "boundary": "YAML-marked units, not scheduler steps. Same selected structural-event population in both panels, not the entire raw profiler.",
        "events": [
            interval(e, start, stream=e["args"]["stream_id"], lane=e["tid"] - 900000)
            for e in members
        ],
        "structure": [
            interval(e, start, depth=e["args"]["display_depth"]) for e in structure
        ],
    }
    q = read_trace(qwen)
    es = q["traceEvents"]
    qm = [
        e
        for e in es
        if e.get("cat") == "traceloom.timeline_event"
        and e.get("args", {}).get("replay_derived")
    ]
    launches = list(
        dict.fromkeys(e["args"]["launch_id"] for e in sorted(qm, key=lambda e: e["ts"]))
    )[:3]
    steps = {
        e["args"]["step_id"]: e
        for e in es
        if e.get("cat") == "traceloom.context.step_envelope"
    }
    c = sqlite3.connect(f"file:{Path(database).resolve()}?mode=ro", uri=True)
    origin = q["metadata"]["time_origin_ns"]
    graph = []
    for launch in launches:
        row = c.execute(
            "SELECT graph_event_id,start_ns,end_ns FROM traceloom_graph_launch WHERE launch_id=?",
            (launch,),
        ).fetchone()
        identities = c.execute(
            "SELECT DISTINCT step_id FROM traceloom_v_context_replay_launch WHERE launch_id=?",
            (launch,),
        ).fetchall()
        assert len(identities) == 1
        step = steps[identities[0][0]]
        member_events = [e for e in qm if e["args"]["launch_id"] == launch]
        assert len(member_events) == 339
        graph.append(
            {
                "step": step,
                "launch": {
                    "name": launch,
                    "ts": (row[1] - origin) / 1000,
                    "dur": (row[2] - row[1]) / 1000,
                },
                "members": member_events,
            }
        )
    c.close()
    start = min(g["step"]["ts"] for g in graph)
    end = max(g["step"]["ts"] + g["step"]["dur"] for g in graph)
    replay = {
        "capture": "Qwen3-0.6B / Ascend TP1 / graph / 2026-09-16",
        "analyzer_version": "0.1.4",
        "selection": "First three exact replay launches, joined to recorded step identity",
        "span_us": end - start,
        "replays_full_capture": 30,
        "members_per_replay": 339,
        "boundary": "Associated-device envelopes are not host scheduling time, busy time, or full step membership. Launch row is an evidence comparison, not an extra lane in the exported timeline.",
        "steps": [
            interval(g["step"], start, ordinal=g["step"]["args"]["ordinal"])
            for g in graph
        ],
        "launches": [interval(g["launch"], start) for g in graph],
        "members": [
            interval(e, start, launch_index=i)
            for i, g in enumerate(graph)
            for e in g["members"]
        ],
        "bodies": [
            interval(e, start, depth=e["args"]["display_depth"])
            for e in es
            if e.get("cat") == "traceloom.repeat_body_window"
            and e.get("args", {}).get("launch_id") in launches
            and e["args"]["display_depth"] == 2
        ],
    }
    return {"schema_version": "traceloom-story/v1", "deepseek": deep, "qwen": replay}


def render(snapshot):
    palette = {"layer": "#146c70", "attention": "#8054b0", "moe": "#bd7536"}

    def svg(name, span, rows):
        width, left, right, row_height = 1120, 160, 26, 48
        height = 80 + len(rows) * row_height
        scale = (width - left - right) / span
        out = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img"><title>{html.escape(name)}</title>',
            "<style>text{font-family:system-ui,sans-serif;font-size:13px;fill:#314e4b}.tick{font-size:11px;fill:#627a75}</style>",
            f'<rect width="{width}" height="{height}" fill="#fafcf9"/>',
        ]
        for i in range(6):
            x = left + (width - left - right) * i / 5
            out.append(
                f'<path d="M{x} 28V{height - 30}" stroke="#dce6df"/><text class="tick" x="{x}" y="18" text-anchor="middle">{span * i / 5000:.2f} ms</text>'
            )
        for row, (label, values, color) in enumerate(rows):
            y = 44 + row * row_height
            out.append(f'<text x="14" y="{y + 19}">{html.escape(label)}</text>')
            for e in values:
                x = left + e["start_us"] * scale
                w = e["duration_us"] * scale
                text = e["label"].split(" · ")[0]
                fill = palette.get(text, color)
                tip = html.escape(f"{e['label']}: {e['duration_us']:.3f} us")
                out.append(
                    f'<rect x="{x:.4f}" y="{y}" width="{w:.4f}" height="28" rx="1" fill="{fill}"><title>{tip}</title></rect>'
                )
                if w > 75:
                    short = (
                        text
                        if len(text) < int(w / 8)
                        else text[: max(1, int(w / 8) - 2)] + "…"
                    )
                    out.append(
                        f'<text x="{x + 7:.4f}" y="{y + 19}" style="fill:white;font-size:12px">{html.escape(short)}</text>'
                    )
        out.append("</svg>")
        return "".join(out) + "\n"

    d = snapshot["deepseek"]
    streams = sorted({e["stream"] for e in d["events"]})
    before = [
        (f"Stream {s}", [e for e in d["events"] if e["stream"] == s], "#537d83")
        for s in streams
    ]
    after = [
        (
            "Layer",
            [e for e in d["structure"] if e["label"].startswith("layer ·")],
            "#146c70",
        ),
        (
            "Attention / MoE",
            [e for e in d["structure"] if not e["label"].startswith("layer ·")],
            "#8054b0",
        ),
    ]
    after += [
        (
            f"Events · lane {lane + 1}",
            [e for e in d["events"] if e["lane"] == lane],
            "#537d83",
        )
        for lane in sorted({e["lane"] for e in d["events"]})
    ]
    q = snapshot["qwen"]
    qr = [
        ("Step evidence", q["steps"], "#146c70"),
        ("Launch evidence", q["launches"], "#bd7536"),
        ("Repeat bodies", q["bodies"], "#8054b0"),
        ("Exact members", q["members"], "#537d83"),
    ]
    for filename, title, span, rows in [
        ("deepseek-before", "DeepSeek: stream-grouped events", d["span_us"], before),
        (
            "deepseek-after",
            "DeepSeek: the same events, with marked structure",
            d["span_us"],
            after,
        ),
        (
            "qwen-replay",
            "Qwen: recorded step identity, graph launch and exact members",
            q["span_us"],
            qr,
        ),
    ]:
        (ROOT / f"assets/traceloom-{filename}.svg").write_text(svg(title, span, rows))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deepseek")
    parser.add_argument("--qwen")
    parser.add_argument("--graph-db")
    args = parser.parse_args()
    if any((args.deepseek, args.qwen, args.graph_db)):
        if not all((args.deepseek, args.qwen, args.graph_db)):
            parser.error("all three capture inputs are required")
        snapshot = extract(args.deepseek, args.qwen, args.graph_db)
        DATA.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    else:
        snapshot = json.loads(DATA.read_text())
    render(snapshot)


if __name__ == "__main__":
    main()
