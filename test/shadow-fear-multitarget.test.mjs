import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateCombatTimeline} from '../src/combat/combat-time.mjs';
import {assessCombat} from '../src/world/risk.mjs';
import {farmFearFactor} from '../src/world/composition.mjs';

const monster={hp:500,attack:25,frequency:1,armor:10,resistance:0,damage_type:'physical'};
const ranger={name:'My_Ranger1',ctype:'ranger',attack:200,frequency:1,crit:0,critdamage:0,
 hp:4000,max_hp:4000,mp:200,max_mp:400,courage:0,fear:0};
test('multi-aggro Shadow applies the same verified Fear factor as Legacy admission',()=>{
 const n=12;
 assert.equal(farmFearFactor(ranger,monster,n),.2);
 const shadow=estimateCombatTimeline(monster,[ranger],{aggro:n,uncertainty:.1});
 const legacy=assessCombat(monster,[ranger],'balanced',n,{healing:false});
 assert.equal(shadow.valid,true);
 assert.equal(legacy.timelineShadow.valid,true);
 assert.equal(legacy.timelineShadow.authority,'none');
 assert.ok(Math.abs(shadow.lowerBoundDps-legacy.outgoing*.9)<1e-7,
  'shadow must not ignore multi-aggro Fear while comparing to Legacy');
 assert.ok(Math.abs(shadow.seconds-legacy.seconds/.9)<1e-7);
 const solo=estimateCombatTimeline(monster,[ranger],{aggro:1,uncertainty:.1});
 assert.ok(shadow.seconds>solo.seconds*2.9); // baseline one-target Fear is 0.6, twelve-target Fear 0.2
});
test('already frightened/strongly courageous attackers do not receive invented Fear multipliers',()=>{
 const current={...ranger,fear:3,courage:0};
 const old=estimateCombatTimeline(monster,[current],{aggro:1,uncertainty:.1});
 const multi=estimateCombatTimeline(monster,[current],{aggro:12,uncertainty:.1});
 assert.equal(old.valid,true);
 assert.ok(Math.abs(old.lowerBoundDps-multi.lowerBoundDps)<1e-7,
  'do not apply a second fear penalty that is already reflected in current stats');
 const courageous=estimateCombatTimeline(monster,[{...ranger,courage:30}],{aggro:12,uncertainty:.1});
 assert.ok(Math.abs(courageous.lowerBoundDps-multi.lowerBoundDps)<1e-7);
 const naive=estimateCombatTimeline(monster,[ranger],{aggro:12,uncertainty:.1});
 assert.ok(courageous.lowerBoundDps>naive.lowerBoundDps);
});
