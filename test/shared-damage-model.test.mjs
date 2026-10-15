import test from 'node:test';
import assert from 'node:assert/strict';
import {damageMultiplier,outgoingDamageEstimate} from '../src/combat/damage-model.mjs';
import {farmDamageMultiplier,farmThroughput} from '../src/world/composition.mjs';
import {assessCombat} from '../src/world/risk.mjs';

const attacker=(damage_type='physical')=>({
 name:damage_type,ctype:damage_type==='magical'?'mage':'ranger',
 attack:100,frequency:1,damage_type,hp:2000,max_hp:2000
});
const monster=(armor=0,resistance=0)=>({
 hp:1000,attack:2,frequency:1,damage_type:'physical',
 armor,resistance
});

test('the common outgoing multiplier equals the existing official curve',()=>{
 for(const defense of [-200,-50,0,100,400,800,1200]){
  assert.equal(damageMultiplier(defense),farmDamageMultiplier(defense));
 }
 assert.equal(damageMultiplier(0),1);
 assert.equal(damageMultiplier(100),.9);
 assert.equal(damageMultiplier(Infinity),null);
});

test('physical ranger ignores high magical resistance, mage ignores high armor',()=>{
 const highRes=monster(0,1200),highArmor=monster(1200,0);
 assert.equal(outgoingDamageEstimate(attacker('physical'),highRes).damage,100);
 assert.ok(outgoingDamageEstimate(attacker('magical'),highRes).damage<30);
 assert.equal(outgoingDamageEstimate(attacker('magical'),highArmor).damage,100);
 assert.ok(outgoingDamageEstimate(attacker('physical'),highArmor).damage<30);
});

test('armor piercing and resistance piercing affect only the matching type',()=>{
 const enemy=monster(500,500);
 const r={...attacker('physical'),apiercing:500,rpiercing:0};
 const m={...attacker('magical'),apiercing:0,rpiercing:500};
 assert.equal(outgoingDamageEstimate(r,enemy).damage,100);
 assert.equal(outgoingDamageEstimate(m,enemy).damage,100);
 r.apiercing=0;m.rpiercing=0;
 assert.ok(outgoingDamageEstimate(r,enemy).damage<100);
 assert.ok(outgoingDamageEstimate(m,enemy).damage<100);
});

test('pure damage ignores both defenses but respects avoidance and uncertainty',()=>{
 const pure=outgoingDamageEstimate(attacker('pure'),{
  ...monster(1600,1800),avoidance:10,evasion:0
 },{uncertainty:.2});
 assert.equal(pure.type,'pure');assert.equal(pure.factor,1);
 assert.equal(pure.damage,72);
 const shot=outgoingDamageEstimate(attacker('physical'),monster(),{
  skill:{damage_type:'physical',damage_multiplier:.7}
 });
 assert.equal(shot.damage,70);
});

test('risk engine uses matching outgoing damage type, not max of armor and resistance',()=>{
 const mob=monster(0,1000);
 const opts={G:{skills:{}},outgoingUncertainty:0};
 const ranger=assessCombat(mob,[attacker('physical')],'balanced',1,opts);
 const mage=assessCombat(mob,[attacker('magical')],'balanced',1,opts);
 assert.equal(ranger.safe,true);
 assert.equal(ranger.outgoing,100);
 assert.ok(mage.outgoing<ranger.outgoing);
 assert.ok(mage.seconds>ranger.seconds);
});

test('team throughput shares the same damage math across classes',()=>{
 const enemies=monster(0,1000),r=attacker('physical'),m=attacker('magical');
 const opts={G:{skills:{}},healing:false,aoe:false};
 const ar=farmThroughput(enemies,[r],1,opts);
 const am=farmThroughput(enemies,[m],1,opts);
 assert.equal(ar.baseDps,100);
 assert.ok(am.baseDps<ar.baseDps);
 const both=farmThroughput(enemies,[r,m],1,opts);
 assert.equal(both.baseDps,ar.baseDps+am.baseDps);
});

test('uncertain or malformed outgoing values fail closed',()=>{
 assert.equal(outgoingDamageEstimate(attacker('unknown'),monster()).valid,false);
 assert.equal(outgoingDamageEstimate(attacker(),{...monster(),armor:Infinity}).valid,false);
 assert.equal(outgoingDamageEstimate(attacker(),monster(),{uncertainty:1}).valid,false);
 assert.equal(outgoingDamageEstimate(attacker(),monster(),{skill:{damage_multiplier:0}}).valid,false);
});
