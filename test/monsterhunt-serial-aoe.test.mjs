import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedHunt,huntForFarmer,advanceHuntCycle} from '../src/world/hunt-rotation.mjs';
import {maximalSafeAimedTargets} from '../src/combat/skills.mjs';
const names=['My_Ranger1','My_Ranger2','My_Ranger3'];
test('hunt priority uses exact live monster id, not similarly named goo',()=>{
 assert.deepEqual(normalizedHunt({id:'cgoo',c:41}),{id:'cgoo',c:41});
 assert.notEqual(normalizedHunt({id:'cgoo',c:41}).id,'goo');
 assert.equal(huntForFarmer(names[1],names[0],null,{running:true,rip:false,realm:'USIV',monsterhunt:{id:'goo',c:20}},'USIV').id,'goo');
 assert.equal(huntForFarmer(names[1],names[0],null,{running:true,rip:false,realm:'USII',monsterhunt:{id:'goo',c:20}},'USIV'),undefined);
 assert.equal(huntForFarmer(names[1],names[0],null,{running:true,rip:false,realm:'USIV'},'USIV'),undefined);
});
test('three ordered quests rotate only after confirmed turn-in',()=>{
 let out=advanceHuntCycle(null,names,{id:'cgoo',c:41});
 assert.equal(out.objective.owner,'My_Ranger1');assert.equal(out.state.phase,'combat');
 out=advanceHuntCycle(out.state,names,{id:'cgoo',c:0});
 assert.equal(out.objective.owner,'My_Ranger1');assert.equal(out.state.phase,'turnin');
 const stale=advanceHuntCycle(out.state,names,undefined);
 assert.equal(stale.objective.owner,'My_Ranger1');
 out=advanceHuntCycle(out.state,names,null);
 assert.equal(out.objective.owner,'My_Ranger2');
 out=advanceHuntCycle(out.state,names,{id:'goo',c:12});
 assert.equal(out.objective.owner,'My_Ranger2');
 out=advanceHuntCycle(out.state,names,{id:'goo',c:0});
 out=advanceHuntCycle(out.state,names,{id:'bee',c:7});
 assert.equal(out.objective.owner,'My_Ranger3');
});
test('aimed AoE fills all safe slots but never selects foreign or unsafe monsters',()=>{
 const engaged=[{id:'one'},{id:'two'}],neutral=[{id:'three'},{id:'four'}];
 assert.deepEqual(maximalSafeAimedTargets(engaged,neutral,1,3).map(x=>x.id),['one','two','three']);
 assert.deepEqual(maximalSafeAimedTargets(engaged,neutral,0,3).map(x=>x.id),['one','two']);
 assert.deepEqual(maximalSafeAimedTargets(engaged,[{id:'two'},...neutral],2,3).map(x=>x.id),['one','two','three']);
 assert.equal(maximalSafeAimedTargets(engaged,neutral,2,5).length,4);
});
