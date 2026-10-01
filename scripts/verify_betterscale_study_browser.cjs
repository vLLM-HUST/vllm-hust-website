/* Bounded QA for shared measurements, six-point family lines and source downloads. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const model = require('../assets/leaderboard-frontier-model.js');
const data = require('../data/leaderboard_frontier.json');
const study = data.cohorts.find(c => c.id === 'qwen35-35b-a3b-bf16-sweprefix-study-betterscale-cache-v1');
const expected = model.presentationPoints(data.points,study);
const baseURL = process.argv[2] || 'http://127.0.0.1:8774';
const output = path.resolve(__dirname,'../output/playwright/betterscale-study');
fs.mkdirSync(output,{recursive:true});
(async () => {
    const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
    try {
        for (const [width,language,theme] of [[1440,'en','light'],[390,'zh','dark'],[1440,'zh','dark'],[390,'en','light']]) {
            const context = await browser.newContext({viewport:{width,height:1100},acceptDownloads:true,colorScheme:theme});
            await context.addInitScript(({language,theme}) => {
                localStorage.setItem('vllm-hust_lang',language);
            },{language,theme});
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror',error => errors.push(error.message));
            await page.goto(`${baseURL}/leaderboard-runs.html?setting=${study.id}#settings`);
            await page.waitForFunction(() => document.querySelector('#frontier-status')?.dataset.state === 'ready');
            assert.deepEqual((await page.locator('[data-point]').evaluateAll(nodes => nodes.map(n => n.dataset.point))).sort(),study.workload.contract.comparison_point_ids.slice().sort());
            const lines = await page.locator('polyline[data-series-points]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.dataset.seriesPoints)));
            assert.equal(lines.length,2);
            assert.deepEqual(lines.map(ids => ids.map(id => data.points.find(p=>p.id===id).load.concurrency)).sort((a,b)=>a.length-b.length),[[1,2,4,8,16],[1,2,4,8,16,32]]);
            assert.equal(await page.locator('[data-line-kind="configuration-family"]').count(),1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            for (const id of study.workload.contract.comparison_point_ids) {
                const dot = page.locator(`[data-point="${id}"]`);
                // Keyboard interaction avoids ambiguity for overlapping measured coordinates.
                await dot.focus();
                await dot.press('Enter');
                const pending = page.waitForEvent('download');
                await page.locator('[data-download]').click();
                const download = await pending;
                const payload = JSON.parse(fs.readFileSync(await download.path(),'utf8'));
                const original = data.points.find(p=>p.id===id);
                assert.deepEqual(payload.point,original);
                assert.deepEqual(payload.cohort,data.cohorts.find(c=>c.id===original.cohort_id));
                assert.deepEqual(payload.comparison_cohort,study);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(250);
            }
            await page.screenshot({path:path.join(output,`${language}-${width}-${theme}.png`),fullPage:true});
            await page.locator('[data-filter="mods"][value="native-runtime-752a3a5-9bf964c"]').uncheck();
            assert.equal(await page.locator('polyline[data-series-points]').count(),1);
            await page.locator('[data-filter="mods"][value="betterscale"]').uncheck();
            assert.equal(await page.locator('polyline[data-series-points]').count(),0);
            assert.equal(await page.locator('[data-point]').count(),0);
            await page.locator('#frontier-mods-toggle').click();
            assert.equal(await page.locator('[data-point]').count(),expected.length);
            assert.equal(await page.locator('polyline[data-series-points]').count(),2);
            await page.locator('#frontier-workload').selectOption('qwen35-35b-a3b-bf16-sweprefix-smoke-v1');
            assert.equal(await page.locator('[data-point="qwen35-sweprefix-cache-width-full-tp2-c32-d1-20260928"]').count(),0);
            assert.deepEqual(errors,[]);
            await context.close();
            console.log(`PASS ${language} ${width} ${theme}: exact points, two lines, source downloads, filters, main exclusion`);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
