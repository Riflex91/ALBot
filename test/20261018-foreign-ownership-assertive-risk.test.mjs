import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {assessCombat} from '../src/world/risk.mjs';
import {safeThreeShotOpportunity} from '../src/combat/encounter.mjs';
import {eligibleEngagedFarmMob} from '../src/combat/skills.mjs';

const party=['My_Ranger1','My_Ranger2','My_Priest'];
const planned='bee';
const mob=(id,target,mtype='bee')=>({id,type:'monster',mtype,
 hp:100,max_hp:100,target,dead:false});

test('new assertive profile validates as a real editor + runtime setting',()=>{
 const risks=FULL_DESCRIPTOR.schema.properties.world.properties.risk.enum;
 assert.deepEqual(risks,['conservative','balanced','assertive','aggressive']);
 assert.equal(FULL_DESCRIPTOR.schema.properties.farming.properties.avoidOthers.default,true,
  'existing users are not silently opted into hitting other players targets');
});

test('foreign-owned normal monsters become eligible only by explicit opt-in and only on plan',()=>{
 assert.equal(eligibleEngagedFarmMob(mob('a','Other'),party,planned,true),false);
 assert.equal(eligibleEngagedFarmMob(mob('a','Other'),party,planned,false),true);
 assert.equal(eligibleEngagedFarmMob(mob('b','Other','prat'),party,planned,false),false);
 assert.equal(eligibleEngagedFarmMob(mob('c','My_Ranger1'),party,planned,true),true);
 assert.equal(eligibleEngagedFarmMob(mob('d',null),party,planned,false),false);
 assert.equal(eligibleEngagedFarmMob(mob('e','Other'),party,null,false),false);
});

test('three-shot may count foreign-owned approved bees only with avoidOthers false',()=>{
 const visible=[mob('one','My_Ranger1'),mob('two','Other'),mob('three',null)];
 const base={healthy:true,max:3,failed:false,planned,visible,teamNames:party,safe:()=>true};
 assert.equal(safeThreeShotOpportunity({...base,avoidOthers:true}),false);
 assert.equal(safeThreeShotOpportunity({...base,avoidOthers:false}),true);
 assert.equal(safeThreeShotOpportunity({...base,avoidOthers:false,safe:m=>m.id!=='two'}),false,
  'unsafe foreign targets stay prohibited');
 assert.equal(safeThreeShotOpportunity({...base,avoidOthers:false,visible:visible.map((m,i)=>
  i===1?{...m,mtype:'prat'}:m)}),false,
  'an unrelated species is not authorized by ownership opt-in');
 assert.equal(safeThreeShotOpportunity({...base,avoidOthers:false,healthy:false}),false);
});

test('assertive threshold is above balanced but below aggressive without relaxing special mechanic vetoes',()=>{
 const limits={balanced:FULL_DESCRIPTOR.schema.properties.world.properties.risk.enum.includes('balanced'),
  assertive:FULL_DESCRIPTOR.schema.properties.world.properties.risk.enum.includes('assertive')};
 assert.deepEqual(limits,{balanced:true,assertive:true});
 const ranger={name:'My_Ranger1',ctype:'ranger',hp:1000,max_hp:1000,
  attack:1000,frequency:1,armor:0,resistance:0,mp:1000,max_mp:1000};
 const enemy={hp:100,attack:270,frequency:.1,armor:0,resistance:0};
 const balanced=assessCombat(enemy,[ranger],'balanced');
 const assertive=assessCombat(enemy,[ranger],'assertive');
 const aggressive=assessCombat(enemy,[ranger],'aggressive');
 assert.equal(balanced.safe,false,'balanced blocks expected 29.7% worst-case hit');
 assert.equal(assertive.safe,true,'32% hit budget accepts controlled stronger fight');
 assert.equal(aggressive.safe,true);
 assert.equal(assessCombat({...enemy,attack:420},[ranger],'assertive').safe,false,
  'lethal stronger burst remains rejected');
 assert.equal(assessCombat({...enemy,reflection:1},[ranger],'assertive').safe,false,
  'unmodelled boss mechanic remains rejected');
 assert.equal(assessCombat({...enemy,attack:420},[ranger],'assertive',1,{maxCombatSeconds:36}).safe,false,
  'fight duration override cannot bypass HP risk budget');
});
