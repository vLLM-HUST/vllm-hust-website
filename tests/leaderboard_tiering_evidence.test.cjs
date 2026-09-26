const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gunzipSync}=require('node:zlib');
const data=require('../data/leaderboard_frontier.json');
const evidence=require('../data/leaderboard_frontier_swe_evidence.json');
const archive=path.join(__dirname,'../reports/frontier-managed-tiering-20260926');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const points=data.points.filter(p=>p.evidence.benchmark_protocol?.campaign==='qwen35-managed-tiering-20260926');

test('managed Tiering observations retain a complete matched pair and verifiable raw artifacts',()=>{
    assert.equal(points.length,10);
    const metadata={};
    const launches={};
    for(const arm of ['native','tiering']){
        const mods=arm==='native'?[]:['kv-tiering-migration'];
        const rows=points.filter(p=>JSON.stringify(p.configuration.mods)===JSON.stringify(mods)).sort((a,b)=>a.load.concurrency-b.load.concurrency);
        assert.deepEqual(rows.map(p=>p.load.concurrency),[1,2,4,8,16]);
        const packed=fs.readFileSync(path.join(archive,`metadata-${arm}.json.gz`));
        const raw=gunzipSync(packed);
        metadata[arm]=JSON.parse(raw);
        assert.deepEqual(metadata[arm].mods,arm==='native'?[]:['kv-tiering']);
        const qualification=JSON.parse(fs.readFileSync(path.join(archive,`${arm}-qualification.json`)));
        assert.equal(qualification.status.passed,true);
        assert.equal(qualification.status.release.exit,0);
        assert.deepEqual(qualification.status.release.owners,[]);
        assert.equal(qualification.retrieval.passed,true);
        assert.equal(qualification.retrieval.completed_requests,26);
        assert.equal(qualification.prefix_reuse.passed,true);
        launches[arm]=qualification.custody.serving_child.argv.slice();
        for(const point of rows){
            const params=point.configuration.parameters;
            const receipt=params.runtime_receipt;
            assert.equal(point.configuration.experiment_group,undefined);
            assert.equal(point.evidence.execution_kind,'real-online');
            assert.equal(point.evidence.measurement_seconds,900);
            assert.equal(point.configuration.hardware.accelerator_count,2);
            assert.equal(params.mtp_draft_tokens,2);
            assert.equal(params.prefix_caching,true);
            assert.equal(params.async_scheduling,true);
            assert.equal(params.graph_mode,'FULL_AND_PIECEWISE');
            assert.equal(params.kv_cache_memory_bytes,26038239232);
            assert.equal(receipt.full_metadata.encoding,'gzip');
            assert.ok(receipt.full_metadata.url.endsWith(`/metadata-${arm}.json.gz`));
            assert.equal(receipt.full_metadata.sha256,sha(packed));
            assert.equal(receipt.full_metadata.content_sha256,sha(raw));
            assert.equal(receipt.runtime_source_file_count,Object.keys(metadata[arm].runtime_source_files).length);
            const run=evidence.runs.find(r=>r.point_id===point.id);
            assert.ok(run);
            assert.equal(run.validation.owned_server_stop_command_exit_zero,true);
            assert.equal(run.validation.owned_server_exit_zero,undefined);
            const filename=`${arm}-c${point.load.concurrency}-requests.jsonl.gz`;
            assert.ok(run.requests_artifact_url.endsWith(`/${filename}`));
            assert.equal(run.requests_artifact_encoding,'gzip');
            const requests=fs.readFileSync(path.join(archive,filename));
            assert.equal(sha(requests),run.requests_artifact_sha256);
            assert.equal(sha(gunzipSync(requests)),run.requests_content_sha256);
            if(arm==='tiering'){
                assert.equal(params.mod_runtime_effectiveness.load_bytes,0);
                assert.ok(params.mod_runtime_effectiveness.store_bytes>0);
                assert.equal(params.mod_runtime_effectiveness.status,'store-only');
                assert.deepEqual(run.transfer_effectiveness,params.mod_runtime_effectiveness);
                assert.equal(point.configuration.mod_sources[0].revision,metadata[arm].plugin_revision);
            }
        }
    }
    for(const key of ['packages','runtime_source_files','prepared_workload_sha256','model_manifest_sha256','core_patch','core_commit','source_archives']){
        assert.deepEqual(metadata.native[key],metadata.tiering[key],key);
    }
    const index=launches.tiering.indexOf('--kv-transfer-config');
    assert.ok(index>0);
    const connector=JSON.parse(launches.tiering[index+1]);
    assert.equal(connector.kv_connector,'HustAscendTieringConnector');
    assert.equal(connector.kv_connector_extra_config.cpu_bytes_to_use,8*1024**3);
    launches.tiering.splice(index,2);
    assert.deepEqual(launches.tiering,launches.native);
});
