import test from 'node:test';
import assert from 'node:assert/strict';
import {caveEntryPreflight,cavePartyObservation} from '../src/world/cave-admission.mjs';
import {createCaveEvidence} from '../src/world/cave-evidence.mjs';

const now=1770000000000,run='a'.repeat(24);
const actor=(name='P',x=816,y=1200)=>({
 name,x,y,map:'main',in:'main',rip:false,hp:1000,
 dc:false,moving:false,targets:0,cave:null
});
const visit=()=>({available:true,serverTime:now,
 resetsAt:now+60000,observedAt:now,resume:null});
function assess(override={}){
 return caveEntryPreflight({
  visit:visit(),realm:'EUI',name:'P',actor:actor(),
  partyNames:['P'],members:[actor()],
  allowedNames:['P','R','H'],now,...override});
}

test('N12 fresh daily visit and solo keeper observation permit LOCAL preflight only',()=>{
 const result=assess();
 assert.deepEqual(result,{
  executable:false,serverVerified:false,requiresJournal:true,
  mode:'new',run:null,party:['P'],localConditionsMet:true,
  reason:'local-preflight-only'
 });
});

test('N12 a server resume takes precedence over daily availability',()=>{
 const snapshot=visit();
 snapshot.available=true;
 snapshot.resume={run,server:'EU I',remainingMs:600000};
 const result=assess({visit:snapshot});
 assert.equal(result.mode,'resume');
 assert.equal(result.localConditionsMet,true);
 assert.equal(result.run,run);
 assert.deepEqual(result.party,['P'],
  'official generated_return admits only the returning actor, independent of existing party');
 assert.equal(result.executable,false);
});

test('N12 remote existing run never becomes a new local daily opening',()=>{
 for(const available of [true,false]){
  const result=assess({visit:{...visit(),available,
   resume:{run,server:'USII'}}});
  assert.equal(result.mode,'remote-resume');
  assert.equal(result.localConditionsMet,false);
  assert.equal(result.reason,'resume-on-another-server');
  assert.equal(result.run,run);
  assert.equal(result.executable,false);
 }
});

test('N12 unknown prior departure is not a new run clearance',()=>{
 const denied=assess({priorRun:{run}});
 assert.equal(denied.mode,'new');
 assert.equal(denied.reason,'prior-run-exit-unconfirmed');
 assert.equal(denied.localConditionsMet,false);
 const resumed=assess({priorRun:{run},visit:{...visit(),
  available:false,resume:{run,server:'EUI'}}});
 assert.equal(resumed.mode,'resume');
 assert.equal(resumed.localConditionsMet,true);
});

test('N12 missing, stale and contradictory visit receipts block the preflight',()=>{
 for(const v of [
  null,{...visit(),observedAt:now-30001},
  {...visit(),observedAt:now+1},
  {...visit(),serverTime:now-301000},
  {...visit(),available:false},
  {...visit(),resume:{run:'bad',server:'EUI'}}
 ]){
  const result=assess({visit:v});
  assert.equal(result.localConditionsMet,false,JSON.stringify(v));
  assert.equal(result.executable,false);
 }
 assert.equal(assess({now:-1}).reason,'invalid-identity-or-clock');
});

test('N12 actual character must be alive, idle and at the official cave keeper',()=>{
 for(const change of [
  {map:'bank'}, {in:'bank'}, {rip:true}, {hp:0},
  {hp:NaN}, {moving:true}, {targets:1}, {targets:undefined},
  {dc:true}, {x:976.01}, {x:NaN}, {y:1040-1},
  {cave:{run}}
 ]){
  const result=assess({actor:{...actor(),...change}});
  assert.equal(result.localConditionsMet,false,JSON.stringify(change));
  assert.equal(result.executable,false);
 }
 assert.equal(assess({actor:actor('P',976,1200)}).localConditionsMet,true);
});

test('N12 party roster must be complete, bounded and entirely selected',()=>{
 const party=['P','R','H'];
 const members=party.map((name,i)=>actor(name,816+i*8,1200));
 const good=assess({partyNames:party,members});
 assert.equal(good.localConditionsMet,true);
 assert.deepEqual(good.party,party);
 for(const memberChange of [
  {partyNames:['P','R','H','Z'],members:[...members,actor('Z')]},
  {partyNames:['P','P'],members:[actor(),actor()]},
  {partyNames:['P','Z'],members:[actor(),actor('Z')]},
  {partyNames:party,members:[actor(),actor('R')]},
  {partyNames:party,members:[actor(),actor('R'),actor('H',977,1200)]},
  {partyNames:party,members:[actor(),{...actor('R'),targets:1},actor('H')]}
 ]){
  const result=assess(memberChange);
  assert.equal(result.localConditionsMet,false,JSON.stringify(memberChange));
  assert.equal(result.executable,false);
 }
});

test('N12 official returning character is solo-admitted even if the party still exists',()=>{
 const resumes={...visit(),available:false,
  resume:{run,server:'EUI'}};
 const result=assess({
  visit:resumes,partyNames:['P','R','H'],
  members:[actor(),actor('R',980,1200),actor('H',980,1200)]
 });
 assert.equal(result.mode,'resume');
 assert.equal(result.localConditionsMet,true);
 assert.deepEqual(result.party,['P']);
});

test('N12 party observation never infers that a configured subset is the full online party',()=>{
 assert.deepEqual(cavePartyObservation({name:'P',party:null}),
  {verified:true,names:['P']});
 assert.equal(cavePartyObservation({name:'P',party:'P'}).reason,
  'party-roster-missing');
 assert.equal(cavePartyObservation({name:'P',party:'P',
  partyMap:{P:{},R:{},H:{},Z:{}}}).verified,false);
 assert.equal(cavePartyObservation({name:'P',party:null,
  partyMap:{Z:{}}}).verified,false);
 assert.deepEqual(cavePartyObservation({name:'P',party:'P',
  partyMap:{P:{},R:{}}}),{verified:true,names:['P','R']});
});

test('N12 status exposes preflight without scheduling cave_enter or cave_info',()=>{
 const calls=[],p={
  c:actor(),parent:{party:{}},realm:()=> 'EUI',
  has:name=>name==='cave_info',
  call:(name)=>{calls.push(name);return {available:true,server_time:now,
    resets:now+60000,home:'EUI'};}
 };
 const bot={running:true,session:'session-p',me:{name:'P'},p,
  teamNames:['P'],entity:()=>null};
 const cave=createCaveEvidence(bot,{now:()=>now});
 const first=cave.status();
 assert.equal(first.entryPreflight.localConditionsMet,false);
 assert.equal(first.entryPreflight.reason,'fresh-cave-info-required');
 assert.equal(calls.length,0);
 assert.equal(cave.refreshVisit(),true);
 return Promise.resolve().then(()=>{
  const next=cave.status();
  assert.equal(next.entryPreflight.mode,'new');
  assert.equal(next.entryPreflight.localConditionsMet,true);
  assert.equal(next.entryPreflight.serverVerified,false);
  assert.equal(next.canEnter,false);
  assert.equal(next.canResume,false);
  assert.equal(next.entryPreflight.executable,false);
  assert.deepEqual(calls,['cave_info']);
  cave.close();
 });
});
