import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveLifecycle,validCaveLifecycleRecord}
 from '../src/world/cave-lifecycle.mjs';
import {Executor} from '../src/core/executor.mjs';

const time=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const caveMap=(r=run,f=1)=>`zone_${r}_${f}`;
const observed=(r=run,f=1)=>({
 run:r,floor:f,map:caveMap(r,f),roster:[{
  name:'P',left:false,disconnected:false
 }]});
function fixture({store=new Map(),reply=()=>({exited:true}),
 realm='EUI',session='session-one',persist=true}={}){
 const calls=[],writes=[],state={time,live:observed(),visit:null};
 const c={name:'P',map:caveMap(),in:caveMap(),cave:{run}};
 const p={
  c,realm:()=>realm,
  readCaveJournal:key=>store.has(key)?structuredClone(store.get(key)):null,
  write:(key,val)=>{
   writes.push([key,val]);
   if(!persist)return false;
   store.set(key,structuredClone(val));return true;
  },
  has:name=>name==='cave_exit',
  call:name=>{calls.push(name);return reply();}
 };
 const bot={p,me:{name:'P'},session,running:true,
  cave:{status:()=>({live:state.live,visit:state.visit})}};
 bot.exec=new Executor({now:()=>state.time,active:()=>bot.running,
  limit:3,admit:()=>true,onError:()=>{},onEvent:()=>{}});
 const life=createCaveLifecycle(bot,{now:()=>state.time});
 const exit=()=>{
  state.time=time+26001;bot.exec.poll();
  state.live=null;c.map='main';c.in='main';c.cave=null;
 };
 const visit=changes=>{state.visit={
  observedAt:state.time,serverTime:state.time,
  available:false,resume:null,...changes};};
 return {bot,p,c,store,calls,writes,state,life,exit,visit};
}
test('N12 a one-shot explicit Cave exit is durably marked BEFORE the RPC',async()=>{
 const f=fixture();
 assert.equal(f.life.requestExit(),false,'server run must first be observed');
 f.life.sample();
 assert.equal(f.life.status().state,'live-observed');
 assert.equal(f.life.requestExit(),true);
 assert.deepEqual(f.calls,['cave_exit']);
 const j=f.life.status().journal;
 assert.equal(validCaveLifecycleRecord(j),true);
 assert.equal(j.phase,'exit-dispatch-unknown');
 assert.equal(j.exitAt,time);assert.equal(j.exitRun,run);
 assert.equal(j.exitSession,f.bot.session);
 assert.equal(f.life.requestExit(),false);
 await Promise.resolve();await Promise.resolve();
 const ready=f.life.status();
 assert.equal(ready.state,'exit-reply-observed');
 assert.deepEqual(ready.journal.exitReply,{exited:true,at:time});
 assert.equal(ready.blocked,true);
 assert.equal(f.life.confirmExit(),false,
  'the exit RPC alone does not establish outside position and no-resume');
 f.life.sample();
 assert.equal(f.life.status().journal.phase,'exit-dispatch-unknown',
  'a current server Cave sample never erases a dispatched exit');
 f.exit();
 assert.equal(f.life.confirmExit(),false,
  'outside main map alone could also mean a disconnect');
 f.visit();
 assert.equal(f.life.confirmExit(),true,
  'fresh authenticated no-resume read plus reply and main map permits explicit clear');
 assert.equal(f.life.status().state,'empty');
 assert.equal(f.life.status().blocked,false);
 assert.equal(f.store.get('albot:cave-lifecycle:P'),null);
 assert.deepEqual(f.calls,['cave_exit']);
});
test('N12 rejected or thrown exit stays uncertain without automatic resend',async()=>{
 for(const reply of [
  ()=>{throw Error('socket closed')},
  ()=>Promise.reject(Error('timeout')),
  ()=>({exited:false}),()=>({failed:true}),
  ()=>null,()=>({exited:'true'})
 ]){
  const f=fixture({reply});
  f.life.sample();
  assert.equal(f.life.requestExit(),true);
  await Promise.resolve();await Promise.resolve();
  f.exit();f.visit();
  assert.equal(f.life.status().state,'exit-outcome-unknown');
  assert.equal(f.life.confirmExit(),false);
  assert.equal(f.life.requestExit(),false);
  assert.deepEqual(f.calls,['cave_exit']);
  const reboot=fixture({store:f.store,session:'new-session'});
  reboot.state.live=null;
  assert.equal(reboot.life.status().blocked,true);
  assert.equal(reboot.life.confirmExit(),false);
 }
});
test('N12 a no-resume read must follow server exit receipt and match same realm',async()=>{
 const f=fixture();
 f.life.sample();f.life.requestExit();
 await Promise.resolve();await Promise.resolve();
 f.exit();
 const ack=f.life.status().journal.exitReply.at;
 for(const change of [
  {resume:{run,server:'EUI'}},
  {resume:{run:other,server:'USII'}},
  {observedAt:ack},
  {serverTime:ack-1},
  {observedAt:f.state.time-31000},
  {available:'false'}
 ]){
  f.visit(change);
  assert.equal(f.life.confirmExit(),false,JSON.stringify(change));
 }
 f.visit();
 f.c.map='bank';
 assert.equal(f.life.confirmExit(),false);
 f.c.map='main';f.c.in='bank';
 assert.equal(f.life.confirmExit(),false);
 f.c.in='main';f.c.cave={run};
 assert.equal(f.life.confirmExit(),false);
 f.c.cave=null;f.state.live=observed();
 assert.equal(f.life.confirmExit(),false);
 f.state.live=null;
 assert.equal(f.life.confirmExit(),true);
});
test('N12 previously acknowledged exit can be reconciled after CODE restart',async()=>{
 const f=fixture();
 f.life.sample();f.life.requestExit();
 await Promise.resolve();await Promise.resolve();
 const key='albot:cave-lifecycle:P';
 assert.equal(f.store.get(key).phase,'exit-dispatch-unknown');
 const next=fixture({store:f.store,session:'after-restart'});
 next.exit();next.visit();
 assert.equal(next.life.status().state,'exit-reply-observed');
 assert.equal(next.life.confirmExit(),true);
 assert.equal(next.life.status().blocked,false);
 assert.deepEqual(next.calls,[],
  'only confirmation occurs on restart: no second cave_exit');
});
test('N12 unmatched run or absent official capability never dispatches exit',()=>{
 for(const change of [
  f=>{f.state.live=observed(other)},
  f=>{f.p.has=()=>false},
  f=>{f.p.has=()=>{throw Error('no API')}},
  f=>{f.bot.journal={kind:'sell'}},
  f=>{f.bot.inventoryBlocked=true},
  f=>{f.bot.bank={pending:true}},
  f=>{f.bot.logistics={reserved:true}},
  f=>{f.bot.account={rotationPending:()=>true}},
  f=>{f.bot.lifecycleChanging=true},
  f=>{f.bot.teamTravel={blocked:true}},
  f=>{f.bot.exec.dispatch('occupied',['lifecycle'],()=>true,()=>new Promise(()=>{}),{value:true})}
 ]){
  const f=fixture();f.life.sample();change(f);
  assert.equal(f.life.requestExit(),false);
  assert.deepEqual(f.calls,[]);
  assert.equal(f.life.status().journal.phase,'observed-run');
 }
});
test('N12 current Cave floor may differ from original observation',async()=>{
 const f=fixture();f.life.sample();
 f.state.live=observed(run,2);f.c.map=caveMap(run,2);
 f.c.in=caveMap(run,2);
 assert.equal(f.life.requestExit(),true);
 assert.deepEqual(f.calls,['cave_exit']);
 await Promise.resolve();
 assert.equal(f.life.status().journal.exitRun,run);
});
test('N12 strict write failure before exit cannot send a server mutation',()=>{
 const f=fixture();f.life.sample();
 f.p.write=()=>false;
 assert.equal(f.life.requestExit(),true,
  'executor may accept the job before journal persistence is attempted');
 assert.deepEqual(f.calls,[]);
 assert.equal(f.life.status().state,'storage-uncertain');
 assert.equal(f.life.requestExit(),false);
});
test('N12 reply from another session cannot confirm the exit',async()=>{
 let resolve;
 const response=new Promise(r=>{resolve=r});
 const f=fixture({reply:()=>response});
 f.life.sample();f.life.requestExit();
 f.bot.session='new-session';
 resolve({exited:true});
 await response;await Promise.resolve();
 f.exit();f.visit();
 assert.equal(f.life.status().state,'exit-outcome-unknown');
 assert.equal(f.life.confirmExit(),false);
 assert.deepEqual(f.calls,['cave_exit']);
});
test('N12 old Cave snapshots and corrupt exit journal never create discharge authority',()=>{
 const f=fixture();f.life.sample();
 const key='albot:cave-lifecycle:P';
 const previous=f.store.get(key);
 for(const corrupt of [
  {...previous,phase:'exit-dispatch-unknown',exitAt:time,
   exitRun:other,exitSession:'session-one',exitReply:null},
  {...previous,phase:'exit-dispatch-unknown',exitAt:null,
   exitRun:run,exitSession:'session-one',exitReply:null},
  {...previous,phase:'exit-dispatch-unknown',exitAt:time,
   exitRun:run,exitSession:'session-one',exitReply:{exited:'true',at:time}},
  {...previous,phase:'exit-dispatch-unknown',exitAt:time,
   exitRun:run,exitSession:'session-one',exitReply:{exited:true,at:time-1}}
 ]){
  const store=new Map([[key,corrupt]]);
  const broken=fixture({store});
  broken.exit();broken.visit();
  assert.equal(broken.life.status().state,'corrupt');
  assert.equal(broken.life.confirmExit(),false);
  assert.equal(broken.life.requestExit(),false);
  assert.deepEqual(broken.calls,[]);
 }
});
