/* Bounded browser check for the imported three-repeat curves and point downloads. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const site=path.resolve(__dirname,'..');
const snapshot=require('../data/leaderboard_frontier.json');
const points=snapshot.points.filter(p=>p.id.startsWith('pr173-dev4-20261006-'));
const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(site,'.'+name);
    if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
        res.writeHead(404);res.end();return;
    }
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
    res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
    fs.createReadStream(file).pipe(res);
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
    try{
        for(const width of [1440,390]){
            const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true});
            const errors=[];page.on('pageerror',e=>errors.push(e.message));
            await page.goto(`http://127.0.0.1:${server.address().port}/leaderboard-runs.html#frontier`);
            await page.locator(`[data-point="${points[0].id}"]`).waitFor();
            assert.equal(await page.locator('[data-point^="pr173-dev4-20261006-"]').count(),10);
            const defaults=await page.locator('[data-point]').evaluateAll(ns=>ns.map(n=>n.dataset.point));
            const choices=await page.locator('[data-filter=mtp]').evaluateAll(ns=>ns.map(n=>n.value));
            const mtp=p=>{const n=p.configuration.parameters.mtp_draft_tokens;return Number.isFinite(n)&&n>=0?(n>0?'on':'off'):'unknown';};
            assert(choices.includes('unknown'));
            for(const setting of [...choices,'all']){
                for(const choice of choices)await page.locator(`[data-filter=mtp][value=${choice}]`).setChecked(setting==='all'||setting===choice);
                const expected=snapshot.points.filter(p=>defaults.includes(p.id)&&(setting==='all'||mtp(p)===setting)).map(p=>p.id).sort();
                const actual=await page.locator('[data-point]').evaluateAll(ns=>ns.map(n=>n.dataset.point).sort());
                assert.deepEqual(actual,expected,`MTP ${setting}`);
            }
            // The mixed MOD/MTP check must also deselect unknown explicitly.
            const nativeGroups=[...new Set(snapshot.points.filter(p=>defaults.includes(p.id)&&!p.configuration.mods.length).map(p=>p.load.presentation_group?.id||'none'))];
            for(const group of nativeGroups)await page.locator(`[data-filter=mods][value="${group}"]`).uncheck();
            for(const choice of choices)await page.locator(`[data-filter=mtp][value=${choice}]`).setChecked(choice==='off');
            assert.deepEqual(await page.locator('[data-point]').evaluateAll(ns=>ns.map(n=>n.dataset.point).sort()),snapshot.points.filter(p=>defaults.includes(p.id)&&p.configuration.mods.length&&mtp(p)==='off').map(p=>p.id).sort());
            for(const group of nativeGroups)await page.locator(`[data-filter=mods][value="${group}"]`).check();
            for(const choice of choices)await page.locator(`[data-filter=mtp][value=${choice}]`).check();
            const lines=await page.locator('.frontier-concurrency-line').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.seriesPoints)).filter(ids=>ids.every(id=>id.startsWith('pr173-dev4-20261006-'))));
            assert.equal(lines.length,2);
            for(const ids of lines) assert.deepEqual(ids.map(id=>points.find(p=>p.id===id).load.concurrency),[1,2,4,8,16]);
            for(const p of points){
                const dot=page.locator(`[data-point="${p.id}"]`);
                await dot.focus();await dot.press('Enter');
                const popup=page.locator('#frontier-popover');
                assert.match(await popup.innerText(),/三轮算术平均|Arithmetic mean of three runs/);
                assert.match(await popup.innerText(),/2026-10-05.*2026-10-06/);
                const pending=page.waitForEvent('download');
                await page.waitForTimeout(1100);
                await popup.locator('[data-download]').click();
                const download=await pending;
                const content=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
                assert.deepEqual(content.point,p);
                await popup.locator('[data-close]').click();
            }
            assert.deepEqual(errors,[]);
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
            assert.equal(overflow,false);
            console.log(`PASS ${width}px: two curves, ten means, dates, exact downloads, no JS errors or horizontal overflow`);
            await page.close();
        }
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
