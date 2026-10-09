#!/usr/bin/env node

/** Build the local OP02 C1/C2/C4/C8/C16 diagnostic curve from imported points. */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'leaderboard_frontier.json'), 'utf8'));
const prefix = 'swe-op02-core-attention-boundary-';
const expected = [1, 2, 4, 8, 16];
const series = new Map();
for (const point of data.points) {
  const id = point.load?.concurrency_series;
  if (!id || !id.startsWith(prefix)) continue;
  const mode = id.includes('-on-') ? 'on' : 'off';
  const rows = series.get(mode) || [];
  rows.push(point);
  series.set(mode, rows);
}
for (const mode of ['off', 'on']) {
  const rows = (series.get(mode) || []).sort((a, b) => a.load.concurrency - b.load.concurrency);
  if (rows.length !== expected.length || rows.some((point, index) => point.load.concurrency !== expected[index])) {
    throw new Error(`OP02 ${mode} curve must contain C1/C2/C4/C8/C16`);
  }
  series.set(mode, rows);
}

const width = 1100;
const height = 660;
const left = 105;
const right = 1020;
const top = 105;
const bottom = 505;
const xStep = (right - left) / (expected.length - 1);
const values = [...series.values()].flat().map((point) => point.metrics.output_tps / point.configuration.hardware.accelerator_count);
const yMax = Math.max(10, Math.ceil(Math.max(...values) * 1.15 / 10) * 10);
const y = (value) => bottom - (value / yMax) * (bottom - top);
const x = (index) => left + index * xStep;
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const colors = { off: '#ea580c', on: '#2563eb' };
const labels = { off: 'OP02 OFF · manager disabled / kill switch', on: 'OP02 ON · core attention boundary' };
const chunks = [];
chunks.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
chunks.push('<title id="title">Qwen3.5 OP02 core attention boundary concurrency curve</title>');
chunks.push('<desc id="desc">Measured output tokens per second per accelerator for C1, C2, C4, C8 and C16 under the same TP2 plus expert-parallel workload. Lines connect observations and are not fitted curves.</desc>');
chunks.push('<rect width="100%" height="100%" fill="#ffffff"/>');
chunks.push('<g font-family="system-ui,sans-serif" fill="#172033">');
chunks.push('<text x="60" y="42" font-size="24" font-weight="700">Qwen3.5-35B-A3B · OP02 core attention boundary</text>');
chunks.push('<text x="60" y="70" font-size="15">TP2+EP · BF16 · 900-second SWE smoke · one valid observation per point</text>');
for (let tick = 0; tick <= 5; tick += 1) {
  const value = (yMax / 5) * tick;
  const yy = y(value);
  chunks.push(`<path d="M${left} ${yy.toFixed(2)}H${right}" stroke="#e2e8f0" fill="none"/>`);
  chunks.push(`<text x="${left - 12}" y="${(yy + 5).toFixed(2)}" text-anchor="end" font-size="13">${value.toFixed(0)}</text>`);
}
for (let index = 0; index < expected.length; index += 1) {
  const xx = x(index);
  chunks.push(`<path d="M${xx.toFixed(2)} ${top}V${bottom}" stroke="#f1f5f9" fill="none"/>`);
  chunks.push(`<text x="${xx.toFixed(2)}" y="${bottom + 28}" text-anchor="middle" font-size="14">C${expected[index]}</text>`);
}
for (const mode of ['on', 'off']) {
  const rows = series.get(mode);
  const points = rows.map((point, index) => `${x(index).toFixed(2)},${y(point.metrics.output_tps / point.configuration.hardware.accelerator_count).toFixed(2)}`).join(' ');
  const dash = mode === 'off' ? ' stroke-dasharray="12 8"' : '';
  chunks.push(`<polyline points="${points}" fill="none" stroke="${colors[mode]}" stroke-width="4"${dash}/>`);
  rows.forEach((point, index) => {
    const value = point.metrics.output_tps / point.configuration.hardware.accelerator_count;
    const xx = x(index);
    const yy = y(value);
    const title = escape(`${mode.toUpperCase()} C${point.load.concurrency}: ${value.toFixed(3)} output tokens/s/chip; decode P90 ${point.metrics.decode_p90_tps.toFixed(3)} tokens/s`);
    if (mode === 'off') {
      chunks.push(`<rect data-point="${escape(point.id)}" x="${(xx - 7).toFixed(2)}" y="${(yy - 7).toFixed(2)}" width="14" height="14" fill="${colors[mode]}" stroke="#ffffff" stroke-width="2"><title>${title}</title></rect>`);
    } else {
      chunks.push(`<circle data-point="${escape(point.id)}" cx="${xx.toFixed(2)}" cy="${yy.toFixed(2)}" r="7" fill="${colors[mode]}" stroke="#ffffff" stroke-width="2"><title>${title}</title></circle>`);
    }
  });
}
chunks.push(`<text x="${left}" y="${top - 20}" fill="${colors.off}" font-size="15">${labels.off}</text>`);
chunks.push(`<text x="${left + 390}" y="${top - 20}" fill="${colors.on}" font-size="15">${labels.on}</text>`);
chunks.push(`<text x="${(left + right) / 2}" y="${bottom + 66}" text-anchor="middle" font-size="16">Client concurrency</text>`);
chunks.push(`<text transform="translate(28 ${(top + bottom) / 2}) rotate(-90)" text-anchor="middle" font-size="16">Output tokens/s/chip</text>`);
chunks.push('<text x="60" y="610" font-size="13">Lines connect measured C levels; they are not fitted curves or causal speedup estimates.</text>');
chunks.push('<text x="60" y="632" font-size="13">Public preview; benchmark-client source linkage and point-isolated activation evidence remain incomplete.</text>');
chunks.push('</g></svg>');

const output = path.join(root, 'assets', 'frontier-qwen35-op02-core-attention-boundary.svg');
fs.writeFileSync(output, `${chunks.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ output, points: 10, y_max: yMax }));
