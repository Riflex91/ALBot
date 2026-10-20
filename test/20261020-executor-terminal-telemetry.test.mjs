import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';

function fixture(){
 let now=100000;const events=[],errors=[],settles=[];
 const exec=new Executor({now:()=>now,active:()=>true,limit:8,
  onError:(...args)=>errors.push(args),
  onEvent:(type,data)=>events.push({type,...data})});
 return {exec,events,errors,settles,advance:n=>{now+=n;}};
}
test('movement cancellation closes exactly one action without retry or obsolete callbacks',async()=>{
 const f=fixture();
 let resolveMove;
 const started=f.exec.run('move',['movement'],()=>true,
  ()=>new Promise(resolve=>{resolveMove=resolve}),
  {onSettle:s=>f.settles.push(s)});
 assert.equal(started,true);
 assert.equal(f.exec.pending.size,1);
 f.exec.cancelResource('movement');
 assert.equal(f.exec.pending.size,0);
 const start=f.events.filter(e=>e.type==='action.start');
 const end=f.events.filter(e=>e.type==='action.end');
 assert.equal(start.length,1);
 assert.equal(end.length,1);
 assert.equal(end[0].result,'cancelled');
 assert.equal(end[0].reason,'resource-owner-released:movement');
 assert.equal(f.errors.length,0);
 assert.deepEqual(f.settles,[]);
 resolveMove(true);
 await Promise.resolve();f.exec.poll();
 assert.equal(f.events.filter(e=>e.type==='action.end').length,1);
 assert.equal(f.exec.cooldowns.size,0);
});
test('cancelResource never discards value journals or unrelated resource owners',()=>{
 const f=fixture();
 f.exec.run('market.buy',['inventory'],()=>true,()=>new Promise(()=>{}),
  {value:true,onSettle:s=>f.settles.push(s)});
 f.exec.run('move',['movement'],()=>true,()=>new Promise(()=>{}));
 f.exec.cancelResource('movement');
 assert.equal(f.exec.pending.size,1);
 assert.equal(f.exec.pending.has('market.buy'),true);
 assert.equal(f.events.filter(e=>e.type==='action.end').length,1);
 f.exec.cancelResource('inventory');
 assert.equal(f.exec.pending.size,1,'value action must remain unresolved until journal settlement');
});
test('shutdown pairs all remaining starts with terminal events, value actions unknown',()=>{
 const f=fixture();
 f.exec.run('move',['movement'],()=>true,()=>new Promise(()=>{}));
 f.exec.run('market.buy',['inventory'],()=>true,()=>new Promise(()=>{}),
  {value:true,onSettle:s=>f.settles.push(s)});
 f.advance(1900);
 f.exec.invalidate();
 const ends=f.events.filter(e=>e.type==='action.end');
 assert.deepEqual(ends.map(e=>[e.key,e.result]).sort(),
  [['market.buy','unknown'],['move','cancelled']]);
 assert.ok(ends.every(e=>e.elapsedMs===1900));
 assert.equal(f.exec.pending.size,0);
 assert.deepEqual(f.settles,['unknown']);
 assert.equal(f.errors.length,0);
});
