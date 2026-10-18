import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedTeamRoleOwner,chooseFarmAreaSwitch} from '../src/world/spawn-choice.mjs';

const now=100000;
const member=(name,klass,ready=[],other={})=>({
 name,class:klass,ctype:klass,running:true,rip:false,
 hp:800,max_hp:1000,mp:450,max_mp:500,
 capabilities:{at:now-100,ready,sustainable:ready},...other
});
const old={key:'main:goo:0',score:100,travelSeconds:4};
const next={key:'cave:goo:1',score:130,travelSeconds:120};
const current={...old,kind:'farm',started:now-80000};

test('role owner requires fresh capability with actual ready skill',()=>{
 const selected=verifiedTeamRoleOwner([
  member('Priest','priest',['heal']),
  member('Ranger','ranger',['heal'])
 ],'heal',{now,ttlMs:2000});
 assert.equal(selected.name,'Priest');
 assert.equal(selected.skill,'heal');
 for(const stale of [
  member('Priest','priest',['heal'],{capabilities:{at:now-4000,ready:['heal']}}),
  member('Priest','priest',['heal'],{capabilities:{at:now+1,ready:['heal']}}),
  member('Priest','priest',[]),
  member('Priest','priest',['heal'],{rip:true}),
  member('Priest','priest',['heal'],{s:{silenced:true}}),
  member('Priest','priest',['heal'],{mp:30})
 ]) assert.equal(verifiedTeamRoleOwner([stale],'heal',{now,ttlMs:2000}),null);
});
test('peer role cannot be credited across realm boundaries',()=>{
 const peer=member('Priest','priest',['heal'],{realm:'EU2'});
 assert.equal(verifiedTeamRoleOwner([peer],'heal',{now,ttlMs:2000,realm:'USIV'}),null);
 assert.equal(verifiedTeamRoleOwner([peer],'heal',{now,ttlMs:2000,realm:'EU2'}).name,'Priest');
});
test('tank and protection assignment match the skill actually supported',()=>{
 const a=member('Tank','warrior',['agitate']);
 const b=member('Paladin','paladin',['guardians_oath']);
 const c=member('Mage','mage',['reflection']);
 const aggro=verifiedTeamRoleOwner([a,b,c],'aggro',{now});
 const protect=verifiedTeamRoleOwner([a,b],'protect',{now});
 assert.equal(aggro.name,'Tank');
 assert.equal(aggro.skill,'agitate');
 assert.equal(protect.name,'Paladin');
 assert.equal(protect.skill,'guardians_oath');
 const m=verifiedTeamRoleOwner([c],'protect',{now});
 assert.equal(m.skill,'reflection');
});
test('role selection deterministic for equal safety and never trusts claimed class-only skill',()=>{
 const members=[member('B','mage',['energize']),
  member('A','mage',['energize']),member('Z','priest',[])];
 assert.equal(verifiedTeamRoleOwner(members,'energize',{now}).name,'A');
 assert.equal(verifiedTeamRoleOwner([{...members[0],capabilities:null}],'energize',{now}),null);
 assert.equal(verifiedTeamRoleOwner(members,'unknown',{now}),null);
});
test('ordinary farm switch retains current valid spawn while hold-time is active',()=>{
 const decision=chooseFarmAreaSwitch({
  current:{...current,started:now-10000},currentRank:old,candidate:{...next,score:500},
  now,holdMs:60000
 });
 assert.equal(decision.choice.key,old.key);
 assert.equal(decision.reason,'hold-active');
});
test('travel friction rejects marginal switch even after standard hysteresis clears',()=>{
 const decision=chooseFarmAreaSwitch({
  current,currentRank:old,candidate:next,now,holdMs:60000,improvement:.2
 });
 assert.equal(decision.reason,'switch-benefit-unproven');
 assert.equal(decision.choice.key,old.key);
 assert.ok(decision.threshold>1.2);
 const stronger=chooseFarmAreaSwitch({
  current,currentRank:old,candidate:{...next,score:150},
  now,holdMs:60000,improvement:.2
 });
 assert.equal(stronger.choice.key,next.key);
 assert.equal(stronger.reason,'evidence-supported-switch');
});
test('priority objectives and missing old spawn do not get stuck behind farm hold',()=>{
 const forced=chooseFarmAreaSwitch({
  current:{...current,started:now},currentRank:old,candidate:next,now,
  hasPriorityOrder:true
 });
 assert.equal(forced.choice.key,next.key);
 assert.equal(forced.reason,'no-ordinary-switch-needed');
 assert.equal(chooseFarmAreaSwitch({
  current,currentRank:null,candidate:next,now
 }).choice.key,next.key);
 assert.equal(chooseFarmAreaSwitch({
  current,currentRank:old,candidate:null,now
 }).choice.key,old.key);
});
test('unverified switch price cannot redirect team to speculative new spawn',()=>{
 for(const malformed of [
  {...next,score:NaN},
  {...next,score:-2},
  {...next,travelSeconds:Infinity},
  {...next,travelSeconds:-1}
 ]){
  const r=chooseFarmAreaSwitch({
   current,currentRank:old,candidate:malformed,now
  });
  assert.equal(r.choice.key,old.key);
  assert.equal(r.reason,'unverified-switch-evidence');
 }
});
test('role and spawn helpers carry no transaction or boss attack authority',()=>{
 const role=verifiedTeamRoleOwner([member('P','priest',['heal'])],'heal',{now});
 assert.equal(Object.hasOwn(role,'dispatch'),false);
 const choice=chooseFarmAreaSwitch({current,currentRank:old,candidate:next,now});
 assert.equal(Object.hasOwn(choice,'authorize'),false);
 assert.equal(Object.hasOwn(choice,'attack'),false);
});

test('verified sustained crowd relief accepts an independently sampled safer nearby spawn',()=>{
 const decision=chooseFarmAreaSwitch({current,currentRank:{...old,pressureRatio:.75,evidenceSeconds:95},
  candidate:{...next,score:90,travelSeconds:95,pressureRatio:.1,evidenceSeconds:120},
  now,holdMs:60000,improvement:.2});
 assert.equal(decision.reason,'verified-crowded-spawn-relief');
 assert.equal(decision.choice.key,next.key);
 const unverified=chooseFarmAreaSwitch({current,currentRank:{...old,pressureRatio:.75,evidenceSeconds:95},
  candidate:{...next,score:90,travelSeconds:95,pressureRatio:.1,evidenceSeconds:10},
  now,holdMs:60000});
 assert.equal(unverified.choice.key,old.key);
});

test('squad march halts if Priest is far behind, unhealthy or stale',async()=>{
 const {assessFarmMarch}=await import('../src/world/team-plan.mjs');
 const now=200000,hero={name:'R1',map:'main',in:'main',x:200,y:0};
 const patient={name:'P',running:true,rip:false,realm:'EUII',received:now-500,
  map:'main',in:'main',x:0,y:0,hp:2500,max_hp:2500};
 const dest={map:'main',in:'main',x:1000,y:0};
 assert.equal(assessFarmMarch(hero,[patient],{realm:'EUII',now,destination:dest}).reason,
  'teammate-behind');
 const close={...patient,x:115};
 assert.equal(assessFarmMarch(hero,[close],{realm:'EUII',now,destination:dest}).reason,
  'projected-healer-leash');
 const healthy={...close,x:180};
 const ok=assessFarmMarch(hero,[healthy],{realm:'EUII',now,destination:dest});
 assert.equal(ok.ready,true);
 assert.equal(ok.next.x,285);
 assert.equal(assessFarmMarch(hero,[{...healthy,hp:100}],{
  realm:'EUII',now,destination:dest}).reason,'teammate-needs-heal');
 assert.equal(assessFarmMarch(hero,[{...healthy,received:now-8000}],{
  realm:'EUII',now,destination:dest}).ready,false);
});
test('Priest selects weakest fresh transit patient, ignoring dead/foreign or fully healed',async()=>{
 const {selectMarchHealingPatient}=await import('../src/combat/farmer.mjs');
 const now=100000,priest={name:'P',ctype:'priest',map:'main',in:'main',x:0,y:0};
 const peer=(name,hp,extra={})=>({name,running:true,rip:false,
  realm:'EUII',received:now-200,map:'main',in:'main',x:40,y:0,
  hp,max_hp:1000,...extra});
 const result=selectMarchHealingPatient(priest,[peer('R1',500),peer('R2',750),
  peer('Wrong',50,{realm:'USIV'}),peer('Dead',50,{rip:true})],{realm:'EUII',now});
 assert.equal(result.name,'R1');
 assert.equal(selectMarchHealingPatient(priest,[peer('R1',950)],{
  realm:'EUII',now}),null);
 assert.equal(selectMarchHealingPatient(priest,[peer('R1',200,{received:now-6000})],{
  realm:'EUII',now}),null);
});
