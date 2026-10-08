/* Verify the setting-contract dialog against the production snapshot. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const baseURL = process.argv[2] || 'http://127.0.0.1:8791';
const output = process.env.PLAYWRIGHT_OUTPUT_DIR || path.resolve(__dirname,'../output/playwright/setting-contract');
const setting = 'qwen35-35b-a3b-bf16-sweprefix-smoke-v1';
fs.mkdirSync(output,{recursive:true});

(async () => {
    const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
    try {
        for (const [width,language,theme] of [[1440,'en','light'],[390,'zh','dark']]) {
            const context = await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
            await context.addInitScript(language => localStorage.setItem('vllm-hust_lang',language),language);
            const page = await context.newPage();
            const errors=[];
            page.on('pageerror',error=>errors.push(error.message));
            await page.goto(`${baseURL}/leaderboard-runs.html?setting=${setting}#settings`);
            await page.waitForFunction(() => document.querySelector('#frontier-status')?.dataset.state === 'ready');
            await page.locator('#frontier-contract-open').click();
            const dialog=page.locator('#frontier-contract-dialog');
            await dialog.waitFor({state:'visible'});
            assert.equal(await dialog.getAttribute('open'),'');
            const text=await dialog.textContent();
            assert.match(text,/712cf74392b05026a6db2bf213d343747d1f6d45/);
            assert.match(text,/8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85/);
            assert.match(text,/aa23f49e08a946d94eaab21307e9e015140cc8598adfbd5f7e244bdded7b17d0/);
            assert.match(text,/4e62e54ef47497fd916a6c2906b220b3af400f87873ea0784740fed3f61e78c8/);
            assert.match(text,/3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0/);
            assert.match(text,/swe-prefix-reuse\/v1/);
            assert.match(text,/900/);
            assert.match(text,/TP2 \/ PP1 \/ DP1 \/ EP/);
            assert.match(text,/FULL_AND_PIECEWISE/);
            assert.match(text,/APC/);
            assert.equal(await dialog.locator('tbody tr').count(),6);
            const box=await dialog.boundingBox();
            assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width+1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({path:path.join(output,`${language}-${width}-${theme}.png`),fullPage:true});
            await page.keyboard.press('Escape');
            assert.equal(await dialog.isVisible(),false);
            assert.deepEqual(errors,[]);
            await context.close();
            console.log(`PASS ${language} ${width} ${theme}: setting identity and six enabled curve contracts`);
        }
    } finally {
        await browser.close();
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
