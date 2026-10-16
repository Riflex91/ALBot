import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createRuntimeMetrics} from '../src/core/runtime-metrics.mjs';

test('executor exposes measured queue-to-dispatch and invocation-to-settlement durations',async()=>{
 let clock=100;const events=[];
 const metrics=createRuntimeMetrics({now:()=>clock,memoryBytes:()=>123456,capacity:8});
 const exec=new Executor({now:()=>clock,active:()=>true,limit:4,
  onError:()=>{throw Error('unexpected error')},
  onEvent:(kind,data)=>{events.push({kind,...data});metrics.observe(kind,data);}});
 exec.beginFrame();
 assert.equal(exec.run('skill:3shot',['attack'],()=>true,()=>({success:true})),true);
 clock=140;exec.flush();
 const started=events.find(e=>e.kind==='action.start');
 assert.equal(started.queueMs,40);
 assert.equal(started.pending,1);
 await Promise.resolve();
 clock=200;exec.poll();
 const ended=events.find(e=>e.kind==='action.end');
 assert.equal(ended.result,'returned');
 assert.equal(ended.elapsedMs,60);
 assert.equal(ended.pending,0);
 const m=metrics.status(),skill=m.actions.find(x=>x.name==='skill');
 assert.equal(skill.started,1);
 assert.equal(skill.ended,1);
 assert.equal(skill.queueP95Ms,40);
 assert.equal(skill.completionP99Ms,60);
 assert.equal(m.peakPending,1);
 assert.equal(m.heapUsedBytes,123456);
 assert.equal(m.cpuUsage,'unavailable');
 assert.ok(m.dispatchesPerSecond>0);
});
test('unsettled actions have bounded timeout duration and no promise-result double count',()=>{
 let clock=100;
 const events=[],metrics=createRuntimeMetrics({now:()=>clock});
 const exec=new Executor({now:()=>clock,active:()=>true,limit:1,
  onError:()=>{},onEvent:(type,data)=>{events.push([type,data]);metrics.observe(type,data);}});
 assert.equal(exec.run('attack',['attack'],()=>true,()=>new Promise(()=>{}),{timeout:100}),true);
 clock=201;exec.poll();
 const row=metrics.status().actions.find(x=>x.name==='attack');
 assert.equal(row.timedOut,1);
 assert.equal(row.completionP95Ms,101);
 assert.equal(row.started,1);
 assert.equal(row.ended,1);
 exec.poll();
 assert.equal(metrics.status().actions.find(x=>x.name==='attack').ended,1);
});
test('missing/nonportable heap or failing memory callback remains explicitly unknown',()=>{
 let t=0;const q=createRuntimeMetrics({now:()=>t,memoryBytes:()=>{throw Error('not supported')}});
 t=100;q.frame(2);
 assert.equal(q.status().heapUsedBytes,null);
 assert.equal(q.status().cpuUsage,'unavailable');
 assert.ok(q.status().wallLoadProxy>=0);
});
test('rolling percentiles retain a bounded tail instead of every action lifetime sample',()=>{
 let t=0;const m=createRuntimeMetrics({now:()=>t,capacity:8});
 for(let i=1;i<=20;i++){
  t+=10;
  m.observe('action.start',{key:'skill:5shot',queueMs:i,pending:1});
  m.observe('action.end',{key:'skill:5shot',elapsedMs:i*2,result:'returned',pending:0});
 }
 const x=m.status().actions.find(x=>x.name==='skill');
 assert.equal(x.started,20);
 assert.equal(x.queueP99Ms,20);
 assert.equal(x.completionP99Ms,40);
 assert.equal(m.status().totalDispatches,20);
});
