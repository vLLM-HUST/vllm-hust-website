const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(root+'/data/leaderboard_frontier.json'));
const id='910c-native-dsv4-flash-w8a8-random8k1k-20261014';
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:1100},acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto((process.argv[2]||'http://127.0.0.1:8784')+'/leaderboard-runs.html?setting='+id+'#settings');
 await p.waitForFunction(()=>document.querySelector('#frontier-status')?.dataset.state==='ready');
 assert.match(await p.locator('#frontier-status').innerText(),/Engineering measurement|工程测量/); assert.equal(await p.locator('.frontier-baseline[data-state="pending"]').count(),0); const ids=await p.locator('[data-point]').evaluateAll(ns=>ns.map(n=>n.dataset.point));assert.ok(ids.length>0);assert.ok(ids.every(x=>x.startsWith(id)));
 for(const pointId of ids){const dot=p.locator(`[data-point="${pointId}"]`);await dot.focus();await dot.press('Enter');await p.screenshot({path:`/tmp/910c-popup-${width}.png`});const downloadPromise=p.waitForEvent('download');await p.locator('[data-download]').click();const download=await downloadPromise;const got=JSON.parse(fs.readFileSync(await download.path()));assert.deepEqual(got.point,data.points.find(x=>x.id===pointId));await p.keyboard.press('Escape');
 // Chromium rate-limits bursts of downloads; space independent export checks.
 await p.waitForTimeout(1100);}
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await p.screenshot({path:`/tmp/910c-frontier-${width}.png`,fullPage:true});console.log(width,ids.length,'rendered and exact point downloads PASS');await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
