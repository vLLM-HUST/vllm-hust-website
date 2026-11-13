"use strict";
(async () => {
  try {
    const sourcePath = document.querySelector('meta[name="standard-source"]').content;
    const response = await fetch(sourcePath, {cache: "no-store"});
    if (!response.ok) throw new Error(`source HTTP ${response.status}`);
    const source = await response.json();
    const path = "data/dataset-standard-v1/standard.json";
    const entry = source.files.find(item => item.website_path === path);
    if (!entry || !/^[a-f0-9]{40}$/.test(source.commit)) throw new Error("missing pinned source");
    const dataResponse = await fetch(`./${path}`, {cache: "no-store"});
    if (!dataResponse.ok) throw new Error(`standard HTTP ${dataResponse.status}`);
    const raw = await dataResponse.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), b => b.toString(16).padStart(2, "0")).join("");
    if (digest !== entry.sha256 || raw.byteLength !== entry.bytes) throw new Error("standard checksum mismatch");
    const data = JSON.parse(new TextDecoder().decode(raw));
    if (data.standard_id !== "five-datasets-20261113-v1" || data.datasets.length !== 5) throw new Error("unknown standard");
    const guideSourcePath = document.querySelector('meta[name="run-guide-source"]').content;
    const guideSourceResponse = await fetch(guideSourcePath, {cache: "no-store"});
    if (!guideSourceResponse.ok) throw new Error("run guide source unavailable");
    const guideSource = await guideSourceResponse.json();
    const guidePath = "data/dataset-run-guide-v1.json";
    const guideEntry = guideSource.files.find(item => item.website_path === guidePath);
    if (!guideEntry || !/^[a-f0-9]{40}$/.test(guideSource.commit)) throw new Error("missing pinned run guide");
    const guideResponse = await fetch(`./${guidePath}`, {cache: "no-store"});
    if (!guideResponse.ok) throw new Error("run guide unavailable");
    const guideRaw = await guideResponse.arrayBuffer();
    const guideDigest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", guideRaw)), b => b.toString(16).padStart(2, "0")).join("");
    if (guideDigest !== guideEntry.sha256 || guideRaw.byteLength !== guideEntry.bytes) throw new Error("run guide checksum mismatch");
    const guide = JSON.parse(new TextDecoder().decode(guideRaw));
    if (guide.standard_id !== data.standard_id || guide.standard_sha256 !== digest || guide.modes.length !== 2) throw new Error("run guide standard mismatch");
    if (document.body.dataset.page === "dataset-entrypoints") {
      window.vllmHustTestSummary.render({data, guide, source, entry, digest, guideSource, guideEntry, guideDigest});
      return;
    }
    window.vllmHustStandardGuide.render({data, guide, source, entry, digest, guideSource, guideEntry, guideDigest});
  } catch (error) {
    if (document.body.dataset.page === "dataset-entrypoints") {
      window.vllmHustTestSummary.fail(error);
      return;
    }
    window.vllmHustStandardGuide.fail(error);
  }
})();
