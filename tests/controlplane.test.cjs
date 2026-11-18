const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname,'../assets/controlplane.js'),'utf8');
const validation = source.slice(source.indexOf('  function validate(value)'),source.indexOf('  function render()'));
function run(value) {
  const context={value,close:(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-5};
  vm.createContext(context);vm.runInContext(validation,context);return vm.runInContext('validate(value)',context);
}
function fixture() {
  const arm={tasks:2,completed_tasks:2,successful_requests:6,failed_requests:0,elapsed_seconds:10,input_tokens:100,output_tokens:20};
  const a={planned:2,successful:2,release_errors:0,elapsed_seconds:10};
  return {schema:'controller-product-results/v1',default_release:'fixture',releases:[{id:'fixture',repetitions_per_arm:1,result:{completed_pair:true,direct:arm,request_throttling_controller:{...arm,elapsed_seconds:8},time_reduction_percent:20},profiles:[{status:'complete',direct:a,controller:{...a,elapsed_seconds:12},time_reduction_percent:-20,same_client_request_bodies:true,same_per_case_engine_prompt_tokens:true},{status:'deferred'}],changelog:[]}]};
}
test('retain matched gains, negative dataset results and missing profiles',()=>assert.equal(run(fixture()).releases[0].profiles[0].time_reduction_percent,-20));
test('reject unmeasured or incomparable performance',()=>{
  for(const mutate of [
    d=>d.releases[0].result.direct.failed_requests=1,
    d=>d.releases[0].result.request_throttling_controller.input_tokens=99,
    d=>d.releases[0].result.request_throttling_controller.output_tokens=19,
    d=>d.releases[0].result.time_reduction_percent=90,
    d=>d.releases[0].profiles[0].same_client_request_bodies=false,
    d=>d.releases[0].profiles[0].same_per_case_engine_prompt_tokens=false,
    d=>d.releases[0].profiles[0].controller.release_errors=1,
    d=>d.releases[0].profiles[0].time_reduction_percent=20,
    d=>d.releases.push(d.releases[0])
  ]) { const d=fixture();mutate(d);assert.throws(()=>run(d)); }
});
