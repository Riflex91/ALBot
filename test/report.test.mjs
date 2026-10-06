import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckpoint} from '../src/core/checkpoint.mjs';
import {createTestReport} from '../src/core/test-report.mjs';
test('quota fallback permits fresh consumptions but never sends without a checkpoint',()=>{
 const removed=[],writes=[],errors=[];const p={root:{localStorage:{removeItem:k=>removed.push(k)}},read:()=>null,write:(k,v)=>{writes.push(v);return false;},storageError:'QuotaExceededError'};
 const store=createCheckpoint(p,'albot:live-a:A:checkpoint',{error:(...x)=>errors.push(x),event(){}});
 assert.equal(store.durable,false);assert.equal(store.begin({kind:'consume',item:'hpot1'}),true);assert.equal(store.begin({kind:'send'}),false);
 assert.deepEqual(removed,['cstore_albot:live-a:A:checkpoint:config']);assert.equal(JSON.stringify(writes[0]).length,4096);assert.equal(errors.length,1);
});
test('existing unresolved journal is not removed or overwritten during quota recovery',()=>{
 const journal={kind:'send',quantity:5};let calls=0;const store=createCheckpoint({root:{},read:()=>({journal}),write:()=>{calls++;return true;}},'key',{error(){},event(){}});
 assert.equal(store.journal,journal);assert.equal(calls,0);
});
test('report is bounded, retains incidents and writes through the optional host API',()=>{
 let file;const p={headless:true,c:{name:'A'},G:{version:17478},realm:()=> 'EUII',h:{writeTestReport:t=>{file=t;return 'test-ausgeführtertest.json';}},log(){}};
 const log=createTestReport(p,'test');log.error('quota',new Error('QuotaExceededError token=secret US_abcdef'));for(let n=0;n<1000;n++)log.event('action.start',{n});
 const d=log.document();assert.equal(d.events.length,256);assert.equal(d.incidents.length,1);assert.equal(d.dropped,745);assert.ok(!log.text().includes('secret'));assert.ok(!log.text().includes('US_abcdef'));assert.equal(log.flush(),'test-ausgeführtertest.json');assert.equal(JSON.parse(file).counts['action.start'],1000);
});

test('report keeps aggregate action and transient diagnostics beyond the event ring',()=>{
 const p={headless:false,c:{name:'A'},G:{version:17478},realm:()=> 'EUII',log(){}};
 const log=createTestReport(p,'test');
 log.event('action.start',{key:'attack'});log.event('action.transient',{key:'attack',reason:'not_there'});log.event('action.end',{key:'attack',result:'returned'});
 for(let n=0;n<400;n++)log.event('sample',{n});
 const d=log.document();assert.equal(d.events.length,256);assert.equal(d.actionStats.attack.started,1);assert.equal(d.actionStats.attack.ended,1);assert.equal(d.actionStats.attack.results.returned,1);assert.equal(d.actionStats.attack.transient,1);assert.equal(d.actionStats.attack.transientReasons.not_there,1);
});
