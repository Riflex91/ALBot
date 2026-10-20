import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedCaveSnapshot} from '../src/world/cave-evidence.mjs';
import {createCaveVoteEvidence} from '../src/world/cave-vote.mjs';
import {planCaveGroupVote,createCaveConsensus} from '../src/world/cave-consensus.mjs';

const at=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const map=`zone_${run}_1`;
const raw=()=>({
 run,floor:1,server_time:at,remaining_ms:400000,paused:true,
 gold:100,amber:4,roster:[
  {name:'P',left:false,disconnected:false},
  {name:'R',left:false,disconnected:false},
  {name:'H',left:false,disconnected:false}
 ],
 choice:{id:'scene-4',kind:'merchant',danger:false,resolved:false,
  deadline:at+25000,votes:{R:'free',H:'free'},
  options:[
   {id:'free',cost:0,amber:0,unavailable:null},
   {id:'costly',cost:80,amber:2,unavailable:null},
   {id:'locked',cost:0,amber:0,unavailable:'quest-required'}
  ]}
});
function args(overrides={}){
 const normalized=verifiedCaveSnapshot(raw(),{name:'P',map,now:at});
 return {name:'P',now:at,
  cave:{realm:'EUI',live:{...normalized,observedAt:at}},
  lifecycle:{state:'live-observed',journal:{
   name:'P',realm:'EUI',phase:'observed-run',observed:{run}}},
  voteJournal:{state:'empty',journal:null},
  checkOption:id=>({
   localConditionsMet:true,executable:false,canVote:false,
   requiresJournal:true,serverVerified:false,run,choiceId:'scene-4',
   optionId:id,deadline:at+25000
  }),...overrides};
}
function withRaw(modify){
 const x=raw();modify(x);
 const parsed=verifiedCaveSnapshot(x,{name:'P',map,now:at});
 return args({cave:{realm:'EUI',live:parsed?{...parsed,observedAt:at}:null}});
}
test('N12 full original Cave trio unanimity creates only a review candidate',()=>{
 const p=planCaveGroupVote(args());
 assert.equal(p.candidateForReview,true);
 assert.equal(p.reason,'unanimous-peer-option-for-manual-review');
 assert.equal(p.optionId,'free');
 assert.deepEqual(p.peers,['R','H']);
 assert.deepEqual([p.goldCost,p.amberCost],[0,0]);
 assert.equal(p.autoVote,false);
 assert.equal(p.canVote,false);
 assert.equal(p.executable,false);
 assert.equal(p.serverVerified,false);
 assert.equal(p.requiresJournal,true);
});
test('N12 parsers retain official risk indicator but never infer safety from missing risk',()=>{
 const snapshot=verifiedCaveSnapshot(raw(),{name:'P',map,now:at});
 assert.equal(snapshot.choice.danger,false);
 assert.equal(snapshot.choice.kind,'merchant');
 const missing=withRaw(x=>{delete x.choice.danger});
 assert.equal(planCaveGroupVote(missing).reason,'unknown-encounter-risk');
 const dangerous=withRaw(x=>{x.choice.danger=true});
 assert.equal(planCaveGroupVote(dangerous).reason,'server-danger-flagged');
 for(const invalid of ['unknown',0,null]){
  const x=raw();x.choice.danger=invalid;
  assert.equal(verifiedCaveSnapshot(x,{name:'P',map,now:at}),null);
 }
 const badKind=raw();badKind.choice.kind={kind:'merchant'};
 assert.equal(verifiedCaveSnapshot(badKind,{name:'P',map,now:at}),null);
});
test('N12 incomplete, disconnected or non-trio roster never counts as consensus',()=>{
 const scenarios=[
  x=>{x.roster.pop()},
  x=>{x.roster.push({name:'Z',left:false,disconnected:false})},
  x=>{x.roster[1].disconnected=true},
  x=>{x.roster[2].left=true},
  x=>{x.roster[0].disconnected=true},
  x=>{x.roster[2].name='R'}
 ];
 for(const change of scenarios){
  const candidate=planCaveGroupVote(withRaw(change));
  assert.equal(candidate.candidateForReview,false);
  assert.ok(['complete-active-three-person-team-required',
   'current-durable-run-required'].includes(candidate.reason),candidate.reason);
 }
});
test('N12 peer disagreement, missing vote, and own vote block recommendation',()=>{
 const cases=[
  [x=>{x.choice.votes.H='costly'},'peer-votes-disagree'],
  [x=>{delete x.choice.votes.H},'waiting-for-two-peer-votes'],
  [x=>{x.choice.votes.P='free'},'own-vote-already-present']
 ];
 for(const [mutate,reason] of cases){
  const result=planCaveGroupVote(withRaw(mutate));
  assert.equal(result.reason,reason);
  assert.equal(result.candidateForReview,false);
 }
});
test('N12 default zero-spend policy and explicit reserve floor block costly agreement',()=>{
 const agreed=withRaw(x=>{x.choice.votes.R='costly';x.choice.votes.H='costly'});
 assert.equal(planCaveGroupVote(agreed).reason,'team-choice-exceeds-budget');
 const acceptable=planCaveGroupVote({...agreed,
  policy:{maxGoldCost:80,maxAmberCost:2,minGoldReserve:20,minAmberReserve:2}});
 assert.equal(acceptable.candidateForReview,true);
 assert.equal(acceptable.optionId,'costly');
 const limited=planCaveGroupVote({...agreed,
  policy:{maxGoldCost:80,maxAmberCost:2,minGoldReserve:21}});
 assert.equal(limited.reason,'team-choice-exceeds-budget');
 const amberLimit=planCaveGroupVote({...agreed,
  policy:{maxGoldCost:80,maxAmberCost:1}});
 assert.equal(amberLimit.reason,'team-choice-exceeds-budget');
 const uncovered=withRaw(x=>{
  x.gold=50;x.choice.votes.R='costly';x.choice.votes.H='costly';
 });
 assert.equal(planCaveGroupVote({...uncovered,policy:{
  maxGoldCost:100,maxAmberCost:2}}).reason,'team-choice-exceeds-budget');
});
test('N12 malformed policy is fail-closed, cannot widen bounds by NaN',()=>{
 for(const policy of [
  null,[],{maxGoldCost:-1},{maxAmberCost:NaN},
  {minGoldReserve:Infinity},{minAmberReserve:1.5},
  {maxGoldCost:9007199254740992}
 ]){
  const p=planCaveGroupVote({...args(),policy});
  assert.equal(p.reason,'invalid-budget-policy');
  assert.equal(p.candidateForReview,false);
 }
});
test('N12 unknown, locked and expired agreed options never become candidates',()=>{
 for(const [change,expect] of [
  [x=>{x.choice.options[0].unavailable='requirements'},'consensus-option-unavailable'],
  [x=>{x.choice.options=x.choice.options.filter(o=>o.id!=='free')},'current-durable-run-required'],
  [x=>{x.choice.deadline=at+5000},'current-open-choice-required'],
  [x=>{x.choice.resolved=true},'current-open-choice-required'],
  [x=>{x.paused=false},'current-open-choice-required']
 ]){
  const value=planCaveGroupVote(withRaw(change));
  assert.equal(value.candidateForReview,false);
  assert.equal(value.reason,expect,value.reason);
 }
});
test('N12 separate durable Cave and vote journals must be current and coherent',()=>{
 const original=args();
 const variants=[
  {cave:null}, {lifecycle:null},
  {lifecycle:{state:'exit-outcome-unknown',journal:original.lifecycle.journal}},
  {lifecycle:{state:'live-observed',journal:{...original.lifecycle.journal,
   observed:{run:other}}}},
  {voteJournal:null},
  {voteJournal:{state:'dispatch-unknown',journal:null}},
  {voteJournal:{state:'storage-uncertain',journal:null}},
  {voteJournal:{state:'vote-observed',journal:{
   run:other,name:'P',realm:'EUI',choiceId:'scene-2'}}},
  {voteJournal:{state:'vote-observed',journal:{
   run,name:'P',realm:'EUI',choiceId:'scene-4'}}}
 ];
 for(const scenario of variants){
  const p=planCaveGroupVote({...original,...scenario});
  assert.equal(p.candidateForReview,false,p.reason);
 }
});
test('N12 stale server observations or mismatched local vote preflight block all candidates',()=>{
 const checks=[
  p=>{p.now=at+3001},
  p=>{p.now=at-1},
  p=>{p.checkOption=()=>{throw Error('unavailable')}},
  p=>{p.checkOption=null},
  p=>{p.checkOption=()=>({localConditionsMet:true,executable:true,
    run,choiceId:'scene-4',optionId:'free'})},
  p=>{p.checkOption=()=>({localConditionsMet:true,executable:false,
    canVote:false,requiresJournal:true,serverVerified:false,
    run:other,choiceId:'scene-4',optionId:'free',deadline:at+25000})}
 ];
 for(const modify of checks){
  const p=args();modify(p);
  assert.equal(planCaveGroupVote(p).candidateForReview,false);
 }
});
test('N12 preview and status have no API calls, mutation, or auto-preparation',()=>{
 const calls=[],normalized=verifiedCaveSnapshot(raw(),{name:'P',map,now:at});
 const bot={me:{name:'P'},p:{call:(...a)=>{calls.push(a);throw Error('mutation');}},
  cave:{status:()=>({realm:'EUI',live:{...normalized,observedAt:at}})},
  caveLifecycle:{status:()=>({state:'live-observed',journal:{
   name:'P',realm:'EUI',phase:'observed-run',observed:{run}}})},
  caveVoteJournal:{status:()=>({state:'empty',journal:null})}
 };
 bot.caveVote=createCaveVoteEvidence(bot,{now:()=>at});
 const c=createCaveConsensus(bot,{now:()=>at});
 assert.equal(c.status().candidateForReview,true);
 assert.equal(c.preview({maxGoldCost:20}).candidateForReview,true);
 assert.deepEqual(calls,[]);
});
