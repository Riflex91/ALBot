import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {assessCombat} from '../src/world/risk.mjs';
import {safeThreeShotOpportunity} from '../src/combat/encounter.mjs';

const ranger={name:'My_Ranger1',ctype:'ranger',hp:1000,max_hp:1000,
 attack:1000,frequency:1,armor:0,resistance:0,mp:1000,max_mp:1000};
const bee={hp:100,attack:270,frequency:.1,armor:0,resistance:0};

test('assertive is a real editor risk mode between balanced and aggressive',()=>{
 assert.deepEqual(FULL_DESCRIPTOR.schema.properties.world.properties.risk.enum,
  ['conservative','balanced','assertive','aggressive']);
 assert.equal(assessCombat(bee,[ranger],'balanced').safe,false,
  'balanced rejects roughly 30% of current HP as one-hit danger');
 assert.equal(assessCombat(bee,[ranger],'assertive').safe,true,
  'assertive permits a well-bounded intermediate risk');
 assert.equal(assessCombat(bee,[ranger],'aggressive').safe,true);
});

test('assertive never accepts dangerous burst, unsupported boss mechanics, or nonexistent combat data',()=>{
 assert.equal(assessCombat({...bee,attack:420},[ranger],'assertive').safe,false);
 assert.equal(assessCombat({...bee,attack:420},[ranger],'assertive',1,
  {maxCombatSeconds:36}).safe,false,
  'increased fight-time cap is not a bypass for survivability');
 assert.equal(assessCombat({...bee,reflection:1},[ranger],'assertive').safe,false);
 assert.equal(assessCombat({...bee,abilities:{unknown:{}}},[ranger],'assertive').safe,false);
 assert.equal(assessCombat({...bee,attack:undefined},[ranger],'assertive').safe,false);
});

test('foreign-owned ordinary mobs remain excluded from automatic 3shot',()=>{
 const mob=(id,target)=>({id,type:'monster',mtype:'bee',hp:100,dead:false,target});
 const base={healthy:true,max:3,failed:false,planned:'bee',
  visible:[mob('ours','My_Ranger1'),mob('foreign','Other'),mob('neutral',null)],
  teamNames:['My_Ranger1','My_Ranger2','My_Priest'],safe:()=>true};
 assert.equal(safeThreeShotOpportunity(base),false);
 assert.equal(safeThreeShotOpportunity({...base,visible:base.visible.map(m=>
  m.id==='foreign'?{...m,target:'My_Ranger2'}:m)}),true);
 assert.equal(FULL_DESCRIPTOR.schema.properties.farming.properties.avoidOthers.default,true);
});
