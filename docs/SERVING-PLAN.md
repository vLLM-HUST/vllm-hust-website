# Serving Plan

`serving-plan.html` is a browser-local capacity and API-equivalent-value calculator, linked under
the shared Evidence / 成果 navigation and from Achievements. No costs are assumed, persisted or
transmitted. Export downloads the current parameters, selected evidence, reference pricing and
derived values as JSON.

The initial model is Qwen3.5-35B-A3B BF16 TP2/MTP2, C44/E44/R48 from the October 6 width-matched SWE
smoke campaign. `data/serving-plans.json` records the selected run ID and limits. This is the
observed maximum within that eight-run campaign, not a global optimum or qualified SLO plan. Do not
attribute it to later partial reclaim improvements. Other models belong in the measured selector
only after receiving model-specific evidence; the custom option is explicitly a hypothesis.

Default pricing is Alibaba Model Studio Beijing, same model, input \<=128K, checked October 9, 2026:
CNY0.4/M input and CNY3.2/M output. The original source is linked in the data and UI. No cloud
latency, effect-equivalence or contractual SLA is claimed. Editable weighted input prices can
reflect customer cache discounts.

Only output volume has an exact suitable aggregate in the imported summary. Input billing volume
stays null and excluded, never inferred from median prompt length or hardware cache-hit counters.
User-supplied input throughput is labeled an assumption. API-equivalent value is not revenue or
profit.

Calculation: token/s/card ×3600×period_hours×utilization×CNY/M /1e6. Utilization represents
equivalent full-load hours, not prediction of low-load latency or efficiency. Cost is fixed monthly
cost ×period_hours/(24×month_days), not multiplied by utilization. The measured throughput already
includes both allocated chips in its denominator. TP2 is the minimum deployment unit.

Run `node --test tests/serving_plan.test.mjs` and the existing site JS/Python checks. Preview with a
static server; check default, custom, month conversion, zero utilization, invalid input, export and
desktop/mobile layout. Keep all preview and screenshot scratch outside the repository.

The calculator is an ordinary website subpage: reuse `site.css`, `subpages.css`, `site.js`, the
shared navigation, cosmic background, hero and footer. Scope all calculator styles under
`.serving-plan`; do not introduce another global theme.
