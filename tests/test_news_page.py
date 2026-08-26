import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_news_page_is_in_shared_navigation_and_directory() -> None:
    page = (ROOT / "news.html").read_text(encoding="utf-8")
    shell = (ROOT / "assets" / "site.js").read_text(encoding="utf-8")

    assert 'data-page="news"' in page
    assert 'data-source="./data/news.json"' in page
    assert "['news', './news.html', 'navNews']" in shell
    assert '<a href="./news.html" data-i18n-common="navNews">News</a>' in shell
    assert "navNews: 'News'" in shell
    assert "navNews: '新闻'" in shell


def test_ray_scaling_news_is_bilingual_and_source_backed() -> None:
    payload = json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))
    item = payload["items"][0]

    assert item["id"] == "yancanmao-ray-10000-node"
    assert item["date"] == "2026-08-25"
    assert item["featured"] is True
    assert "Mao Yancan" in item["title"]["en"]
    assert "毛言粲" in item["title"]["zh"]
    assert "10,000" in item["summary"]["en"]
    assert item["links"][0]["url"] == (
        "https://www.anyscale.com/blog/"
        "how-we-scaled-ray-from-batch-inference-to-10000-node-training-clusters"
    )


def test_new_organization_member_is_in_verified_snapshot() -> None:
    payload = json.loads((ROOT / "data" / "members.json").read_text(encoding="utf-8"))
    member = next(item for item in payload["members"] if item["login"] == "yancanmao")

    assert member["name"] == "Mao Yancan"
    assert member["profile_url"] == "https://github.com/yancanmao"
