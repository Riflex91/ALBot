import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedCaveSnapshot,createCaveEvidence} from '../src/world/cave-evidence.mjs';
import {caveVotePreflight,createCaveVoteEvidence} from '../src/world/cave-vote.mjs';

const now=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const map=`zone_${run}_1`;
const snapshot=()=>({
 run,floor:1,server_time:now,remaining_ms:400000,
 paused:true,gold:100,amber:2,
 roster:[{name:'P',disconnected:false},{name:'R',disconnected:false}],
 choice:{
  id:'scene-1',resolved:false,deadline:now+30000,votes:{R:'safe'},
  options:[
   {id:'safe',cost:20,amber:1,unavailable:null},
   {id:'goldy',cost:120,amber:0,unavailable:null},
   {id:'amber',cost:0,amber:3,unavailable:null},
   {id:'locked',cost:0,amber:0,unavailable:'requirements'},
  ]
 }
});
const input=(raw=snapshot(),extra={})=>{
 const normalized=verifiedCaveSnapshot(raw,{name:'P',map,now});
 return {name:'P',now,cave:{realm:'EUI',live:normalized?{
  ...normalized,observedAt:now}:null},
  lifecycle:{state:'live-observed',journal:{
   version:1,name:'P',realm:'EUI',mode:'observed',
   phase:'observed-run',observed:{run,floor:1,map,at:now}
  }},...extra};
};
test('N12 official vote snapshot preserves deadline, personal votes and both purse currencies',()=>{
 const s=verifiedCaveSnapshot(snapshot(),{name:'P',map,now});
 assert.equal(s.choice.deadline,now+30000);
 assert.deepEqual(s.choice.votes,{R:'safe'});
 assert.equal(s.paused,true);
 assert.deepEqual(s.choice.options.map(o=>[o.id,o.goldCost,o.amberCost,o.available]),[
  ['safe',20,1,true],['goldy',120,0,true],
  ['amber',0,3,true],['locked',0,0,false]
 ]);
 assert.equal(caveVotePreflight({...input(),optionId:'safe'}).localConditionsMet,true);
});

test('N12 missing deadline or vote proof remains visible but never actionable',()=>{
 for(const drop of ['deadline','votes']){
  const raw=snapshot();delete raw.choice[drop];
  const parsed=verifiedCaveSnapshot(raw,{name:'P',map,now});
  assert.ok(parsed);
  assert.equal(parsed.choice[drop],null);
  assert.equal(caveVotePreflight({...input(raw),optionId:'safe'}).reason,'choice-proof-incomplete');
 }
});

test('N12 reject malformed vote receipts and unknown voter or option identities',()=>{
 const mutations=[
  c=>{c.deadline=0},c=>{c.deadline='tomorrow'},
  c=>{c.deadline=Infinity},c=>{c.votes=[]},
  c=>{c.votes={Z:'safe'}},c=>{c.votes={R:'nonexistent'}},
  c=>{c.votes={P:null}},c=>{c.votes={P:0}},
  c=>{c.votes=true}
 ];
 for(const change of mutations){
  const raw=snapshot();change(raw.choice);
  assert.equal(verifiedCaveSnapshot(raw,{name:'P',map,now}),null);
 }
});

test('N12 target choice must be selected explicitly, never selected by price or heuristic',()=>{
 const first=caveVotePreflight(input());
 assert.equal(first.reason,'explicit-option-required');
 assert.equal(first.localConditionsMet,false);
 assert.equal(first.canVote,false);
 assert.equal(first.requiresJournal,true);
 assert.equal(first.serverVerified,false);
 assert.deepEqual(first.options.map(o=>[o.optionId,o.available,o.affordable]),[
  ['safe',true,true],['goldy',true,false],
  ['amber',true,false],['locked',false,true]
 ]);
 assert.equal(caveVotePreflight({...input(),optionId:'missing'}).reason,'unknown-option');
});

test('N12 locked, expensive and already-voted choices cannot pass local preflight',()=>{
 for(const [option,reason] of [
  ['locked','option-unavailable'],
  ['goldy','insufficient-cave-purse'],
  ['amber','insufficient-cave-purse']]){
  const vote=caveVotePreflight({...input(),optionId:option});
  assert.equal(vote.reason,reason);
  assert.equal(vote.localConditionsMet,false);
 }
 const raw=snapshot();raw.choice.votes.P='safe';
 const result=caveVotePreflight({...input(raw),optionId:'safe'});
 assert.equal(result.reason,'already-voted');
 assert.equal(result.existingOption,'safe');
});

test('N12 absolute deadline and real server clock bound local voting decision',()=>{
 for(const [t,reason] of [
  [now+28000,'fresh-server-choice-required'],
  [now+30000,'fresh-server-choice-required'],
  [now-1,'fresh-server-choice-required']
 ]){
  assert.equal(caveVotePreflight({...input(),optionId:'safe',now:t}).reason,reason);
 }
 const raw=snapshot();raw.choice.deadline=now+2000;
 assert.equal(caveVotePreflight({...input(raw),optionId:'safe'}).reason,'vote-deadline-too-close');
 const edge=snapshot();edge.choice.deadline=now+2001;
 assert.equal(caveVotePreflight({...input(edge),optionId:'safe'}).localConditionsMet,true);
});

test('N12 current member must be present, not left, and run must be paused',()=>{
 const left=snapshot();left.roster[0].left=true;
 assert.equal(verifiedCaveSnapshot(left,{name:'P',map,now}),null);
 const disconnected=snapshot();disconnected.roster[0].disconnected=true;
 assert.equal(caveVotePreflight({...input(disconnected),optionId:'safe'}).reason,
  'active-party-member-required');
 const unpaused=snapshot();unpaused.paused=false;
 assert.equal(caveVotePreflight({...input(unpaused),optionId:'safe'}).reason,
  'run-not-paused-for-vote');
 const resolved=snapshot();resolved.choice.resolved=true;
 assert.equal(caveVotePreflight({...input(resolved),optionId:'safe'}).reason,
  'vote-already-resolved');
 const absent=snapshot();absent.choice=null;
 assert.equal(caveVotePreflight({...input(absent),optionId:'safe'}).reason,
  'no-current-choice');
});

test('N12 a matching durable observed run is mandatory, including during exit',()=>{
 const basic=input();
 const possibilities=[
  {state:'exit-reply-observed',journal:basic.lifecycle.journal},
  {state:'run-not-currently-visible',journal:basic.lifecycle.journal},
  {state:'live-observed',journal:{...basic.lifecycle.journal,phase:'exit-dispatch-unknown'}},
  {state:'live-observed',journal:{...basic.lifecycle.journal,observed:{
   ...basic.lifecycle.journal.observed,run:other}}},
  {state:'live-observed',journal:{...basic.lifecycle.journal,realm:'USII'}},
  {state:'live-observed',journal:{...basic.lifecycle.journal,name:'Z'}},
  {state:'live-observed',journal:null}
 ];
 for(const lifecycle of possibilities){
  assert.equal(caveVotePreflight({...input(),lifecycle,optionId:'safe'}).reason,
   'current-journaled-run-required');
 }
 assert.equal(caveVotePreflight({...input(),cave:null,optionId:'safe'}).localConditionsMet,false);
});

test('N12 read-only vote status and option inspection issue no cave_reply calls',()=>{
 const raw=snapshot(),calls=[],p={
  c:{name:'P',map,cave:raw},realm:()=> 'EUI',
  has:name=>name==='cave_reply',
  call:name=>{calls.push(name);return {vote:'safe'};}
 };
 const bot={p,me:{name:'P'},session:'s',running:true,teamNames:['P']};
 bot.cave=createCaveEvidence(bot,{now:()=>now});
 bot.caveLifecycle={status:()=>({
  state:'live-observed',blocked:true,journal:{
   phase:'observed-run',name:'P',realm:'EUI',
   observed:{run,floor:1,map,at:now}
  }
 })};
 const votes=createCaveVoteEvidence(bot,{now:()=>now});
 const status=votes.status();
 assert.equal(status.reason,'explicit-option-required');
 const preflight=votes.preflight('safe');
 assert.equal(preflight.localConditionsMet,true);
 assert.equal(preflight.canVote,false);
 assert.equal(preflight.executable,false);
 assert.deepEqual(calls,[]);
 bot.p.c.map='main';bot.p.c.cave=null;
 assert.equal(votes.preflight('safe').reason,'current-journaled-run-required');
 assert.deepEqual(calls,[]);
 bot.cave.close();
});
