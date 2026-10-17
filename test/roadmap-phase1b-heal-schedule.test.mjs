import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateHealAttackSchedule} from '../src/combat/heal-schedule.mjs';
import {estimateCombatTimeline} from '../src/combat/combat-time.mjs';
import {assessCombat} from '../src/world/risk.mjs';

const monster={hp:1100,attack:25,frequency:1,armor:20,resistance:40,damage_type:'physical'};
const priest={name:'Priest',ctype:'priest',hp:800,max_hp:1000,
 mp:220,max_mp:300,attack:100,frequency:1,crit:0,critdamage:0,
 heal:90,mp_cost:30};
const ranger={name:'Ranger',ctype:'ranger',hp:800,max_hp:1000,
 mp:250,max_mp:300,attack:140,frequency:2,crit:20,critdamage:50};
test('healer cooldown and mana reserve bound actual shared action slots',()=>{
 const r=estimateHealAttackSchedule(priest,monster,{
  durationSeconds:30,skill:{mp:30,cooldown:500}});
 assert.equal(r.valid,true);
 assert.equal(r.actionSlots,30);
 assert.equal(r.possibleCasts,5);
 assert.equal(r.requestedCasts,9);
 assert.equal(r.casts,5);
 assert.equal(r.healingDeficit,true);
 assert.equal(r.attackSlots,0,'insufficient healing capacity must not donate optimistic attack DPS');
 assert.equal(r.authority,'none');
});
test('covered healing yields finite attack slots rather than simultaneous full DPS',()=>{
 const low={...monster,attack:3};
 const r=estimateHealAttackSchedule({...priest,mp:300},low,{
  durationSeconds:20,skill:{mp:10,cooldown:2500}});
 assert.equal(r.valid,true);
 assert.equal(r.actionSlots,20);
 assert.equal(r.requestedCasts,1);
 assert.equal(r.casts,1);
 assert.equal(r.attackSlots,19);
 assert.equal(r.healerDuty,.05);
 assert.equal(r.healingDeficit,false);
 const w=estimateCombatTimeline(low,[ranger,priest],{
  healer:'Priest',healing:true,game:{skills:{heal:{mp:10,cooldown:2500}}},
  incomingSeconds:20});
 assert.equal(w.valid,true);
 assert.ok(w.lowerBoundDps>0);
 assert.equal(w.authority,'none');
 assert.ok(w.healerBudget.healerDuty>0);
 assert.ok(w.lowerBoundDps<w.rawDps);
});
test('healer cooldown is never faster than its shared attack cadence',()=>{
 const faster=estimateHealAttackSchedule(priest,monster,{skill:{mp:0,cooldown:0},
  durationSeconds:10});
 assert.equal(faster.healIntervalMs,1000);
 assert.equal(faster.actionSlots,10);
 assert.ok(faster.casts<=10);
});
test('invalid or unknown heal metadata excludes healer DPS rather than making up mana',()=>{
 for(const p of [
  {...priest,heal:undefined},{...priest,mp:Infinity},
  {...priest,frequency:0},{...priest,mp:400},
  {...priest,mp_cost:-1}
 ]){
  const x=estimateHealAttackSchedule(p,monster);
  assert.equal(x.valid,false);
  assert.equal(x.healerDuty,1);
 }
 const w=estimateCombatTimeline(monster,[ranger,{...priest,mp_cost:undefined}],{
  healer:'Priest',healing:true,game:{skills:{}}
 });
 assert.equal(w.healerDuty,undefined);
 assert.equal(w.healerBudget.reason,'heal-parameters-unverified');
});
test('shared interval and critical effects are scenario-only, never safety authority',()=>{
 const m=estimateCombatTimeline(monster,[ranger,priest],{uncertainty:.2});
 assert.equal(m.valid,true);
 assert.equal(m.rows.find(x=>x.name==='Ranger').attackIntervalMs,500);
 assert.equal(m.rows.find(x=>x.name==='Priest').attackIntervalMs,1000);
 assert.ok(m.expectedDps>m.lowerBoundDps);
 assert.equal(m.attacksNotGuaranteed,true);
 assert.equal(m.authority,'none');
 assert.ok(m.rows.every(x=>x.hitAccuracy>=0&&x.hitAccuracy<=1));
});
test('legacy conservative risk gate remains authoritative despite shadow schedule change',()=>{
 const options={G:{skills:{heal:{mp:25,cooldown:1000}}},
  healing:true,planned:true,leader:'Ranger',maxCombatSeconds:36};
 const certifiedPriest={...priest,capabilities:{
  at:Date.now(),ready:['heal'],sustainable:['heal']}};
 const m={...monster,hp:70,attack:1};
 const before=assessCombat(m,[ranger,certifiedPriest],'balanced',1,options);
 assert.equal(before.timelineShadow.authority,'none');
 assert.ok(typeof before.timelineShadow.healerManaLimited==='boolean');
 const risky=assessCombat({...monster,hp:500000,attack:10000},
  [ranger,certifiedPriest],'balanced',1,options);
 assert.equal(risky.safe,false);
 assert.equal(risky.timelineShadow.authority,'none');
});
