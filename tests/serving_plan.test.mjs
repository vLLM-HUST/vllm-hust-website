import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../assets/serving-plan/calc.mjs";
import { readFileSync } from "node:fs";
const base = {
  output: 675.4005555555556,
  input: null,
  priceOut: 3.2,
  priceIn: 0.4,
  utilization: 100,
  hours: 1,
  days: 30,
  cost: null,
};
test("measured per-card output is not divided by TP twice", () => {
  const r = calculate(base);
  assert.ok(Math.abs(r.value - 7.7806144) < 1e-8);
  assert.equal(r.peakIn, 0);
  assert.equal(r.expense, null);
  assert.equal(r.difference, null);
});
test("month scaling, explicit costs, utilization and billing input", () => {
  let r = calculate({
    ...base,
    hours: 720,
    cost: 4000,
    utilization: 50,
    input: 1000,
  });
  assert.equal(r.expense, 4000);
  assert.ok(Math.abs(r.value - (7.7806144 + 1.44) * 720 * 0.5) < 1e-8);
  assert.ok(r.breakEven > 60 && r.breakEven < 61);
  assert.equal(r.difference, r.value - 4000);
});
test("zero utilization does not erase rent; zero prices avoid division by zero", () => {
  let r = calculate({ ...base, cost: 720, utilization: 0 });
  assert.equal(r.value, 0);
  assert.equal(r.expense, 1);
  assert.equal(r.difference, -1);
  assert.equal(calculate({ ...base, priceOut: 0, cost: 1 }).breakEven, null);
});
test("invalid inputs rejected", () => {
  for (const changes of [
    { cost: -1 },
    { output: NaN },
    { input: -1 },
    { days: 0 },
    { utilization: 101 },
    { priceOut: Infinity },
    { output: 1e308 },
    { hours: 0 },
  ])
    assert.throws(() => calculate({ ...base, ...changes }));
});
test("selected observation and provenance preserved", () => {
  const d = JSON.parse(
    readFileSync(new URL("../data/serving-plans.json", import.meta.url)),
  );
  assert.ok(d.plans.length >= 3);
  assert.ok(d.plans.some((p) => p.provider !== "BetterScale"));
  assert.equal(d.plans[0].chips, 2);
  assert.equal(
    d.plans[0].accounting.leaderboardOutputTokensPerSecondPerChip,
    base.output,
  );
  assert.equal(d.plans[0].outputTpsPerChip, 1152403 / 900 / 2);
  assert.equal(d.plans[0].inputTpsPerChip, 1664732 / 900 / 2);
  assert.equal(d.plans[0].cachedInputTpsPerChip, 42233381 / 900 / 2);
  assert.ok(
    d.plans[0].maxPromptTokens <= d.priceReferences.qwen35.inputLimitTokens,
  );
  const html = readFileSync(
    new URL("../achievements.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /href="\.\/serving-plan.html"/);
});

test("calculator reuses the website shell rather than a standalone theme", () => {
  const html = readFileSync(
    new URL("../serving-plan.html", import.meta.url),
    "utf8",
  );
  for (const contract of [
    'data-page="serving-plan"',
    'class="site-nav"',
    'id="cosmic-background"',
    'class="site-shell serving-plan"',
    'class="site-footer"',
    "./assets/site.css?",
    "./assets/subpages.css?",
    "./assets/site.js?",
  ])
    assert.ok(html.includes(contract), contract);
  const navigation = readFileSync(
    new URL("../assets/site.js", import.meta.url),
    "utf8",
  );
  assert.match(navigation, /pages: \[[^\]]*'serving-plan'/);
});

test("cached and new input are disjoint billing components", () => {
  const r = calculate({
    ...base,
    output: 100,
    input: 200,
    cachedInput: 800,
    priceIn: 3,
    priceCached: 0.6,
    priceOut: 12,
  });
  assert.ok(
    Math.abs(r.value - ((100 * 12 + 200 * 3 + 800 * 0.6) * 3600) / 1e6) < 1e-9,
  );
  assert.throws(() => calculate({ ...base, cachedInput: -1 }));
  assert.throws(() => calculate({ ...base, priceCached: NaN }));
});
test("every plan has model-specific reference pricing and source", () => {
  const d = JSON.parse(
    readFileSync(new URL("../data/serving-plans.json", import.meta.url)),
  );
  for (const p of d.plans) {
    assert.ok(d.priceReferences[p.priceReferenceId]);
    assert.ok(p.runId);
    assert.ok(p.source);
    assert.ok(p.chips > 0);
  }
  assert.equal(
    d.priceReferences.qwen35.cachedInputCnyPerMillion,
    d.priceReferences.qwen35.inputCnyPerMillion,
  );
});
