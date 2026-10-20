import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verifiedCaveVisit,verifiedCaveSnapshot,createCaveEvidence
} from '../src/world/cave-evidence.mjs';

const now=1770000000000,run='a'.repeat(24),map=`zone_${run}_1`;
const visit=()=>({available:false,server_time:now,
 resets:now+72000000,home:'EU I',
 resume:{run,server:'EU I',remaining_ms:123456}});
const live=()=>({run,floor:1,server_time:now,
 remaining_ms:912345,paused:false,gold:500,amber:7,
 roster:[{name:'P',disconnected:false},{name:'R',left:false,disconnected:true}],
 choice:{id:'choice-1',resolved:false,
  options:[{id:'safe',cost:20,amber:0,unavailable:null},
   {id:'expensive',cost:600,amber:3,unavailable:'cave_purse_short'}]}});
function fixture({answer=visit(),has=true}={}){
 const calls=[],readable=[],p={
  c:{map:'main',cave:null},realm:()=> 'EUI',
  has:name=>has&&name==='cave_info',
  call:(name)=>{calls.push(name);return answer}
 };
 const bot={running:true,session:'P-session',me:{name:'P',role:'farmer'},p};
 const cave=createCaveEvidence(bot,{now:()=>fixture.clock});
 return {bot,p,calls,cave,readable};
}
fixture.clock=now;

test('N12 cave_info reports visit and server-bound resume without entering or promising a vote',()=>{
 const v=verifiedCaveVisit(visit(),{now});
 assert.deepEqual(v,{available:false,home:'EU I',
  resetsAt:now+72000000,serverTime:now,
  resume:{run,server:'EU I',remainingMs:123456}});
 assert.equal(v.available,false);
 const remote=verifiedCaveVisit({...visit(),resume:{
  run,server:'US II'}},{now});
 assert.equal(remote.resume.remainingMs,null,
  'a different server does not provide a local time estimate');
});

test('N12 reject stale/corrupt visit, resume, reset and clock evidence',()=>{
 const good=visit();
 for(const value of [
  {...good,available:'true'}, {...good,server_time:now-301000},
  {...good,resets:now-1},{...good,resets:now+172800001},
  {...good,home:''},
  {...good,resume:{run:'wrong',server:'EU I'}},
  {...good,resume:{run,server:'',remaining_ms:100}},
  {...good,resume:{run,server:'EU I',remaining_ms:-1}},
  {...good,resume:{run,server:'EU I',remaining_ms:Infinity}}
 ])assert.equal(verifiedCaveVisit(value,{now}),null);
});

test('N12 server cave snapshot keeps pause clock, original roster, costs and currencies distinct',()=>{
 const s=verifiedCaveSnapshot(live(),{name:'P',map,now});
 assert.equal(s.run,run);assert.equal(s.floor,1);
 assert.equal(s.remainingMs,912345);assert.equal(s.paused,false);
 assert.equal(s.gold,500);assert.equal(s.amber,7);
 assert.equal(s.roster.length,2);
 assert.deepEqual(s.choice.options.map(o=>[o.id,o.goldCost,o.amberCost,o.available]),
  [['safe',20,0,true],['expensive',600,3,false]]);
 const paused=verifiedCaveSnapshot({...live(),paused:true}, {name:'P',map,now});
 assert.equal(paused.paused,true);
 assert.equal(paused.remainingMs,912345,
  'paused server clocks are not decremented locally');
});

test('N12 reject other run/floor/roster and malformed vote receipts',()=>{
 const good=live();
 for(const [candidate,actualMap] of [
  [good,'main'],[good,`zone_${run}_0`],
  [{...good,run:'b'.repeat(24)},map],
  [{...good,floor:8},map],
  [{...good,server_time:now-400000},map],
  [{...good,remaining_ms:-1},map],
  [{...good,paused:'false'},map],
  [{...good,gold:-1},map],
  [{...good,amber:1.5},map],
  [{...good,roster:[]},map],
  [{...good,roster:[{name:'R',disconnected:false}]},map],
  [{...good,roster:[{name:'P',left:true,disconnected:false}]},map],
  [{...good,roster:[{name:'P',disconnected:false},{name:'P',disconnected:false}]},map],
  [{...good,choice:{id:'bad',resolved:false,options:[
    {id:'x',cost:-1,amber:0}]}},map],
  [{...good,choice:{id:'bad',resolved:false,options:[
    {id:'x',cost:0,amber:0},{id:'x',cost:0,amber:0}]}},map]
 ])assert.equal(verifiedCaveSnapshot(candidate,{name:'P',map:actualMap,now}),null);
});

test('N12 no backend calls on passive sampling or status, and exit is never inferred',()=>{
 const f=fixture();
 assert.equal(f.cave.status().visit,null);
 assert.equal(f.calls.length,0);
 f.p.c.map=map;f.p.c.cave=live();
 f.cave.sample();
 const state=f.cave.status();
 assert.equal(state.live.run,run);
 assert.equal(state.executable,false);
 assert.equal(state.canEnter,false);assert.equal(state.canResume,false);
 assert.equal(state.canVote,false);assert.equal(state.canExit,false);
 f.p.c.map='main';f.p.c.cave=null;
 const offsite=f.cave.status();
 assert.equal(offsite.live,null);
 assert.deepEqual(offsite.lastObservedRun,{
  run,floor:1,observedAt:now,confirmedExited:false});
 assert.equal(offsite.reason,'no-current-instance-proof');
 assert.equal(f.calls.length,0);
});

test('N12 cave_info read is explicitly requested, throttled and never duplicated while pending',async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r});
 const f=fixture({answer:pending});
 assert.equal(f.cave.refreshVisit(),true);
 assert.equal(f.cave.refreshVisit(),false);
 assert.deepEqual(f.calls,['cave_info']);
 assert.equal(f.cave.status().visitPending,true);
 resolve(visit());await pending;await Promise.resolve();
 const s=f.cave.status();
 assert.equal(s.visit.available,false);
 assert.equal(s.visit.resume.run,run);
 assert.equal(s.visitPending,false);
 assert.equal(f.cave.refreshVisit(),false,'rate limit 60 seconds');
 fixture.clock=now+60001;
 assert.equal(f.cave.refreshVisit(),true);
 fixture.clock=now;
});

test('N12 old async visit response cannot cross session or realm rotation',async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r}),f=fixture({answer:pending});
 assert.equal(f.cave.refreshVisit(),true);
 f.bot.session='P-new-session';
 assert.equal(f.cave.status().visit,null);
 resolve(visit());await pending;await Promise.resolve();
 assert.equal(f.cave.status().visit,null);
 assert.equal(f.cave.status().visitPending,false);
 f.p.realm=()=> 'USII';
 assert.equal(f.cave.status().realm,'USII');
 assert.equal(f.cave.status().lastObservedRun,null);
});

test('N12 failed, unsupported and unknown visit responses grant no new action',async()=>{
 const f=fixture({answer:Promise.resolve({available:true})});
 assert.equal(f.cave.refreshVisit(),true);
 await Promise.resolve();await Promise.resolve();
 assert.equal(f.cave.status().visit,null);
 assert.equal(f.cave.status().visitError,'invalid-or-stale-visit');
 const absent=fixture({has:false});
 assert.equal(absent.cave.refreshVisit(),false);
 assert.equal(absent.calls.length,0);
 f.cave.close();
 assert.equal(f.cave.refreshVisit(),false);
});

test('N12 unresolved cave_info is retired after 15s without an API retry',async()=>{
 let resolve;
 const first=new Promise(r=>{resolve=r});
 const f=fixture({answer:first});
 try{
  assert.equal(f.cave.refreshVisit(),true);
  assert.equal(f.cave.status().visitPending,true);
  fixture.clock=now+14999;
  assert.equal(f.cave.status().visitPending,true);
  fixture.clock=now+15000;
  const expired=f.cave.status();
  assert.equal(expired.visitPending,false);
  assert.equal(expired.visit,null);
  assert.equal(expired.visitError,'request-timeout');
  assert.equal(f.cave.refreshVisit(),false,
   'timeout is not permission for an early second cave_info call');
  assert.deepEqual(f.calls,['cave_info']);
  resolve(visit());await first;await Promise.resolve();
  assert.equal(f.cave.status().visit,null,'late successful response cannot revive admission');
  assert.equal(f.cave.status().visitError,'request-timeout');
  assert.equal(f.calls.length,1);
 }finally{fixture.clock=now;f.cave.close();}
});

test('N12 late first response cannot overwrite a later explicitly requested visit',async()=>{
 let oldResolve;
 const previous=new Promise(r=>{oldResolve=r});
 const f=fixture({answer:previous});
 try{
  assert.equal(f.cave.refreshVisit(),true);
  fixture.clock=now+61000;
  let newResolve;
  const replacement=new Promise(r=>{newResolve=r});
  f.p.call=name=>{f.calls.push(name);return replacement;};
  assert.equal(f.cave.refreshVisit(),true,
   'the expired pending call is retired; only the new explicit request starts');
  const pending=f.cave.status();
  assert.equal(pending.visitPending,true);
  assert.equal(pending.visit,null);
  assert.equal(f.calls.length,2);
  oldResolve(visit());await previous;await Promise.resolve();
  assert.equal(f.cave.status().visit,null);
  newResolve({...visit(),available:true,resume:null});
  await replacement;await Promise.resolve();
  assert.equal(f.cave.status().visit.available,true);
  assert.equal(f.cave.status().visit.resume,null);
 }finally{fixture.clock=now;f.cave.close();}
});

test('N12 a newer failed visit replaces old availability rather than retaining it',async()=>{
 const f=fixture({answer:Promise.resolve({...visit(),available:true,resume:null})});
 try{
  assert.equal(f.cave.refreshVisit(),true);
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.cave.status().visit.available,true);
  fixture.clock=now+60001;
  f.p.call=name=>{f.calls.push(name);return Promise.reject(new Error('cave offline'));};
  assert.equal(f.cave.refreshVisit(),true);
  assert.equal(f.cave.status().visit,null,
   'previously confirmed availability is revoked as the new query begins');
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.cave.status().visit,null);
  assert.equal(f.cave.status().visitError,'request-failed');
 }finally{fixture.clock=now;f.cave.close();}
});

test('N12 a late response expires even without interim status sampling',async()=>{
 let resolve;
 const response=new Promise(r=>{resolve=r}),f=fixture({answer:response});
 try{
  assert.equal(f.cave.refreshVisit(),true);
  fixture.clock=now+20000;
  resolve(visit());await response;await Promise.resolve();
  assert.equal(f.cave.status().visit,null);
  assert.equal(f.cave.status().visitError,'request-timeout');
  assert.equal(f.cave.status().visitPending,false);
 }finally{fixture.clock=now;f.cave.close();}
});

test('N12 capability errors, clock regression and rejected late reads are fail closed',async()=>{
 const f=fixture();
 f.p.has=()=>{throw Error('unsupported')};
 assert.equal(f.cave.refreshVisit(),false);
 assert.equal(f.cave.status().visitPending,false);
 let reject;
 const request=new Promise((_,r)=>{reject=r});
 const g=fixture({answer:request});
 try{
  assert.equal(g.cave.refreshVisit(),true);
  fixture.clock=now-1;
  assert.equal(g.cave.status().visitError,'request-timeout',
   'a regressed local clock cannot justify any pending visit');
  reject(Error('offline'));
  try{await request;}catch{}
  await Promise.resolve();
  assert.equal(g.cave.status().visit,null);
  assert.equal(g.cave.status().visitError,'request-timeout');
 }finally{fixture.clock=now;f.cave.close();g.cave.close();}
});

test('N12 only a matching no-longer-live run may retire volatile prior-run evidence',()=>{
 const f=fixture();
 f.p.c.map=map;f.p.c.cave=live();
 f.cave.sample();
 assert.equal(f.cave.status().lastObservedRun.run,run);
 assert.equal(f.cave.acknowledgeConfirmedExit(run),false,
  'the run is still physically visible');
 f.p.c.map='main';f.p.c.cave=null;
 assert.equal(f.cave.acknowledgeConfirmedExit('b'.repeat(24)),false);
 assert.equal(f.cave.status().lastObservedRun.run,run);
 assert.equal(f.cave.acknowledgeConfirmedExit(run),true);
 assert.equal(f.cave.status().lastObservedRun,null);
 assert.equal(f.cave.status().entryPreflight.reason,'fresh-cave-info-required');
 f.cave.close();
});
