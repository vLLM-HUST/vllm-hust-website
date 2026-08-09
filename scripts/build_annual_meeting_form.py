#!/usr/bin/env python3
"""Build a polished annual-meeting report form from the supplied DOCX template."""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DCTERMS = "http://purl.org/dc/terms/"
NS = {"w": W, "dcterms": DCTERMS}


FIELDS = {
    0: ["张书豪"],
    1: ["华中科技大学计算机科学与技术学院"],
    2: ["教授"],
    4: [
        "张书豪，华中科技大学计算机科学与技术学院教授，主持科技部重大项目课题，"
        "入选国家自然科学基金优秀青年科学基金项目（海外），华为东湖青年学者。"
        "加入华中科技大学前，曾任新加坡南洋理工大学助理教授，并在德国柏林工业大学"
        "从事博士后研究。长期从事并行与分布式系统、数据流处理和大模型推理系统研究，"
        "近年来聚焦状态管理驱动的推理系统优化，重点关注大模型推理引擎、分布式推理服务、"
        "KV Cache与中间状态管理、服务调度及算子与内核优化。在SIGMOD、VLDB、ICDE、"
        "NeurIPS、SC、TKDE、VLDB Journal、Nature Communications等国际期刊和会议"
        "发表论文50余篇。"
    ],
    5: ["面向国产AI算力的大模型推理引擎优化"],
    6: [
        "本报告聚焦国产AI算力上的大模型推理引擎优化。面向长上下文、MoE和多租户服务等"
        "典型场景，报告分析跨节点互联效率、多级存储与KV状态管理、模型压缩与硬件执行协同"
        "等关键挑战，并介绍团队在新一代人工智能国家科技重大专项中的阶段性探索。",
        "报告将从系统软件栈出发，介绍三类技术：面向国产异构互联的统一通信抽象与执行优化；"
        "面向长上下文服务的KV缓存前缀复用、分层驻留卸载与缓存感知路由；面向国产硬件特性的"
        "混合精度量化、KV动态量化与稀疏化协同优化。结合昇腾平台Qwen系列模型和vLLM-HUST"
        "开源实践，报告还将讨论推理引擎在可观测性、基准测试、持续集成与多硬件适配方面的"
        "工程化路径。",
    ],
}


def qn(local: str) -> str:
    return f"{{{W}}}{local}"


def _set_cell_text(cell: ET.Element, paragraphs: list[str]) -> None:
    template_paragraphs = cell.findall("./w:p", NS)
    if not template_paragraphs:
        raise ValueError("Template cell has no paragraph to clone")

    paragraph_properties = []
    run_properties = []
    for paragraph in template_paragraphs:
        ppr = paragraph.find("./w:pPr", NS)
        run = paragraph.find("./w:r", NS)
        rpr = run.find("./w:rPr", NS) if run is not None else None
        paragraph_properties.append(copy.deepcopy(ppr) if ppr is not None else None)
        run_properties.append(copy.deepcopy(rpr) if rpr is not None else None)

    for paragraph in template_paragraphs:
        cell.remove(paragraph)

    for index, text in enumerate(paragraphs):
        source_index = min(index, len(paragraph_properties) - 1)
        paragraph = ET.Element(qn("p"))
        if paragraph_properties[source_index] is not None:
            paragraph.append(copy.deepcopy(paragraph_properties[source_index]))
        run = ET.SubElement(paragraph, qn("r"))
        if run_properties[source_index] is not None:
            run.append(copy.deepcopy(run_properties[source_index]))
        text_element = ET.SubElement(run, qn("t"))
        text_element.text = text
        cell.append(paragraph)


def _rewrite_document(xml: bytes) -> bytes:
    root = ET.fromstring(xml)
    table = root.find(".//w:tbl", NS)
    if table is None:
        raise ValueError("Template does not contain the expected table")
    rows = table.findall("./w:tr", NS)
    if len(rows) != 7:
        raise ValueError(f"Expected 7 template rows, found {len(rows)}")

    for row_index, paragraphs in FIELDS.items():
        cells = rows[row_index].findall("./w:tc", NS)
        if len(cells) != 2:
            raise ValueError(f"Expected 2 cells in row {row_index}, found {len(cells)}")
        _set_cell_text(cells[1], paragraphs)

    # The original abstract row reserves nearly four inches even when the text is
    # shorter. Reduce only that minimum height so the polished form fits one A4
    # page; the table grid, portrait, borders, margins, and typography stay intact.
    height = rows[6].find("./w:trPr/w:trHeight", NS)
    if height is not None:
        height.set(qn("val"), "2800")

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _rewrite_core_properties(xml: bytes) -> bytes:
    root = ET.fromstring(xml)
    modified = root.find("dcterms:modified", NS)
    if modified is not None:
        modified.text = (
            dt.datetime.now(dt.timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def build(source: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        suffix=".docx", dir=output.parent, delete=False
    ) as handle:
        temporary = Path(handle.name)

    try:
        with (
            ZipFile(source) as source_zip,
            ZipFile(temporary, "w", ZIP_DEFLATED) as output_zip,
        ):
            for item in source_zip.infolist():
                data = source_zip.read(item.filename)
                if item.filename == "word/document.xml":
                    data = _rewrite_document(data)
                elif item.filename == "docProps/core.xml":
                    data = _rewrite_core_properties(data)
                cloned = ZipInfo(item.filename, date_time=item.date_time)
                cloned.compress_type = ZIP_DEFLATED
                cloned.external_attr = item.external_attr
                cloned.create_system = item.create_system
                output_zip.writestr(cloned, data)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
