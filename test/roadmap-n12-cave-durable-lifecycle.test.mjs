import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveLifecycle,validCaveLifecycleRecord,
 caveLifecycleDisposition} from '../src/world/cave-lifecycle.mjs';

const time=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const liveRun=(r=run,floor=1)=>({run:r,floor,
 map:`zone_${r}_${floor}`,roster:[
  {name:'P',left:false,disconnected:false}]});
const preflight=(mode='new')=>({
 mode,run:mode==='new'?null:run,party:['P'],
 localConditionsMet:true,requiresJournal:true,
 executable:false,serverVerified:false});
function fixture({store=new Map(),name='P',realm='EUI',
 session='s1',mode='new',write=true,read=true}={}){
 const writes=[],calls=[],state={at:time,live:null,preflight:preflight(mode)};
 const p={realm:()=>realm,read:key=>{
  if(!read)throw Error('storage read');
  return store.has(key)?structuredClone(store.get(key)):null;
 },write:(key,value)=>{
  writes.push([key,value]);
  if(!write)return false;
  store.set(key,structuredClone(value));return true;
 },call:name=>{calls.push(name);throw Error('no Cave mutation permitted')}};
 const bot={p,me:{name},session,running:true,
  cave:{status:()=>({entryPreflight:state.preflight,live:state.live})}};
 const lifecycle=createCaveLifecycle(bot,{now:()=>state.at});
 return {store,writes,calls,p,bot,state,lifecycle};
}
test('N12 only durable prepared intent can be staged; never dispatch automatically',()=>{
 const f=fixture();
 assert.equal(f.lifecycle.status().blocked,false);
 assert.equal(f.lifecycle.prepare(),true);
 const status=f.lifecycle.status();
 assert.equal(status.state,'prepared');
 assert.equal(status.blocked,true);
 assert.equal(status.executable,false);
 assert.equal(status.journal.mode,'new');
 assert.equal(status.journal.dispatchAt,null);
 assert.equal(status.journal.observed,null);
 assert.equal(validCaveLifecycleRecord(status.journal),true);
 assert.equal(f.lifecycle.prepare(),false,'the same entry cannot be prepared twice');
 assert.deepEqual(f.calls,[],'neither preparation nor status calls cave_enter');
 assert.equal(f.lifecycle.discardPrepared(),true,
  'only a locally prepared, non-dispatched entry may be discarded');
 assert.equal(f.lifecycle.status().blocked,false);
 assert.equal(f.lifecycle.status().journal,null);
});

test('N12 prepared Cave intent survives bot restart and forbids a second entry',()=>{
 const a=fixture();
 assert.equal(a.lifecycle.prepare(),true);
 a.lifecycle.close();
 const b=fixture({store:a.store,session:'restart'});
 assert.equal(b.lifecycle.status().state,'prepared');
 assert.equal(b.lifecycle.status().blocked,true);
 assert.equal(b.lifecycle.prepare(),false);
 assert.equal(b.lifecycle.discardPrepared(),false,
  'old session cannot casually erase uncertain predecessor state');
 assert.equal(b.lifecycle.markDispatchUnknown(),false,
  'old session never inherits the permission to send the action');
 assert.deepEqual(b.calls,[]);
});

test('N12 a marked RPC may never be replayed after restart or API ambiguity',()=>{
 const a=fixture({mode:'resume'});
 assert.equal(a.lifecycle.prepare(),true);
 assert.equal(a.lifecycle.markDispatchUnknown(),true);
 const s=a.lifecycle.status();
 assert.equal(s.state,'dispatch-unknown');
 assert.equal(s.journal.mode,'resume');
 assert.equal(s.journal.run,run);
 assert.equal(s.journal.dispatchAt,time);
 assert.equal(a.lifecycle.markDispatchUnknown(),false);
 assert.equal(a.lifecycle.discardPrepared(),false);
 a.lifecycle.close();
 const b=fixture({store:a.store,session:'restart'});
 assert.equal(b.lifecycle.status().state,'dispatch-unknown');
 assert.equal(b.lifecycle.status().blocked,true);
 assert.equal(b.lifecycle.prepare(),false);
 assert.equal(b.lifecycle.markDispatchUnknown(),false);
 assert.equal(b.lifecycle.discardPrepared(),false);
 assert.deepEqual([...a.calls,...b.calls],[]);
});

test('N12 a physical same-run server snapshot proves observation, never an RPC success',()=>{
 const f=fixture({mode:'resume'});
 f.lifecycle.prepare();f.lifecycle.markDispatchUnknown();
 f.state.live=liveRun();
 f.lifecycle.sample();
 const status=f.lifecycle.status();
 assert.equal(status.state,'live-observed');
 assert.equal(status.journal.phase,'observed-run');
 assert.equal(status.journal.observed.run,run);
 assert.equal(status.journal.observed.floor,1);
 f.state.live=null;
 assert.equal(f.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(f.lifecycle.status().reason,'exit-not-proven');
 f.lifecycle.close();
 const reboot=fixture({store:f.store,session:'reboot'});
 assert.equal(reboot.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(reboot.lifecycle.status().blocked,true);
 assert.equal(reboot.lifecycle.prepare(),false);
});

test('N12 an unexpected resume run cannot settle the original durable intent',()=>{
 const f=fixture({mode:'resume'});
 f.lifecycle.prepare();f.lifecycle.markDispatchUnknown();
 f.state.live=liveRun(other);
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().state,'conflict');
 assert.equal(f.lifecycle.status().reason,'resume-run-mismatch');
 assert.equal(f.lifecycle.status().journal.phase,'dispatch-unknown');
 assert.equal(f.lifecycle.discardPrepared(),false);
});

test('N12 a preexisting observed Cave run is durably held even without bot dispatch',()=>{
 const f=fixture();
 f.state.live=liveRun();
 f.lifecycle.sample();
 const s=f.lifecycle.status();
 assert.equal(s.state,'live-observed');
 assert.equal(s.journal.mode,'observed');
 assert.equal(s.journal.dispatchAt,null,
  'a prior server run is not fabricated as a local Cave RPC');
 assert.equal(s.journal.run,run);
 f.lifecycle.close();
 const reboot=fixture({store:f.store,session:'restart'});
 assert.equal(reboot.lifecycle.status().state,'run-not-currently-visible');
 assert.equal(reboot.lifecycle.status().blocked,true);
 assert.equal(reboot.lifecycle.prepare(),false);
});

test('N12 prepared new entry with observed run does not invent a dispatch receipt',()=>{
 const f=fixture();f.lifecycle.prepare();
 f.state.live=liveRun();
 f.lifecycle.sample();
 assert.equal(f.lifecycle.status().journal.dispatchAt,null);
 assert.equal(f.lifecycle.status().journal.phase,'observed-run');
 assert.equal(f.lifecycle.discardPrepared(),false);
});

test('N12 invalid or foreign durable records remain quarantined across restarts',()=>{
 const a=fixture();a.lifecycle.prepare();
 const key='albot:cave-lifecycle:P';
 const original=a.store.get(key);
 for(const record of [
  {...original,phase:'dispatch-unknown',dispatchAt:null},
  {...original,run:other},
  {...original,party:['P','P']},
  {...original,name:'someone-else'},
  {...original,createdAt:Infinity},
  {...original,phase:'observed-run',observed:null}
 ]){
  const store=new Map([[key,record]]);
  const f=fixture({store,session:'restart'});
  assert.equal(f.lifecycle.status().blocked,true);
  assert.equal(f.lifecycle.prepare(),false);
  assert.equal(f.lifecycle.discardPrepared(),false);
  assert.equal(f.writes.length,0);
 }
 const foreign=fixture({store:a.store,realm:'USII',session:'restart'});
 assert.equal(foreign.lifecycle.status().state,'scope-mismatch');
 assert.equal(foreign.lifecycle.status().blocked,true);
 assert.equal(foreign.writes.length,0);
 assert.equal(caveLifecycleDisposition(original,{
  name:'P',realm:'EUI'}).state,'prepared');
});

test('N12 unknown persistence and rejected writes fail closed without sending an action',()=>{
 const unreadable=fixture({read:false});
 assert.equal(unreadable.lifecycle.status().state,'storage-uncertain');
 assert.equal(unreadable.lifecycle.prepare(),false);
 const rejected=fixture({write:false});
 assert.equal(rejected.lifecycle.prepare(),false);
 assert.equal(rejected.lifecycle.status().state,'storage-uncertain');
 assert.equal(rejected.lifecycle.prepare(),false);
 assert.deepEqual(rejected.calls,[]);
 const restored=fixture({store:rejected.store,session:'restart'});
 assert.equal(restored.lifecycle.status().state,'empty',
  'failed write did not create a fake durable record');
});

test('N12 concurrent local state drift never overwrites an already changed journal',()=>{
 const f=fixture();
 f.store.set('albot:cave-lifecycle:P',{
  version:1,mode:'new',run:null,party:['P'],
  name:'P',realm:'EUI',session:'other',createdAt:time,
  phase:'prepared',dispatchAt:null,observed:null
 });
 assert.equal(f.lifecycle.prepare(),false);
 assert.equal(f.lifecycle.status().state,'storage-uncertain');
 assert.equal(f.store.get('albot:cave-lifecycle:P').session,'other');
});

test('N12 only same-session preflight can authorize the future durable dispatch boundary',()=>{
 const f=fixture();f.lifecycle.prepare();
 f.state.preflight.localConditionsMet=false;
 assert.equal(f.lifecycle.markDispatchUnknown(),false);
 assert.equal(f.lifecycle.status().state,'prepared');
 f.state.preflight.localConditionsMet=true;
 f.bot.session='changed';
 assert.equal(f.lifecycle.markDispatchUnknown(),false);
 assert.equal(f.lifecycle.discardPrepared(),false);
 assert.deepEqual(f.calls,[]);
});
