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
