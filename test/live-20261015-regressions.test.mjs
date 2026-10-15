import test from 'node:test';
import assert from 'node:assert/strict';
import {transientMovementInterruption} from '../src/core/movement.mjs';
import {safeThreeShotOpportunity} from '../src/combat/encounter.mjs';
import {farmRiskHp} from '../src/world/strategy.mjs';
import {advanceHuntCycle} from '../src/world/hunt-rotation.mjs';

test('native move interruption is transient, not a failed/unreachable bank waypoint',()=>{
 for(const x of ['interrupted',{message:'interrupted'},{reason:'interrupted'},
  'cancelled','canceled','superseded'])assert.equal(transientMovementInterruption(x),true);
 for(const x of ['path_not_found','timeout','no_progress','unreachable'])
  assert.equal(transientMovementInterruption(x),false);
});

test('3shot permits three uniquely identified eligible same-hunt targets including team-engaged',()=>{
 const mobs=[{id:'bee-1',type:'monster',mtype:'bee',hp:100,target:'Ranger'},
  {id:'bee-2',type:'monster',mtype:'bee',hp:100},
  {id:'bee-3',type:'monster',mtype:'bee',hp:100},
  {id:'bee-4',type:'monster',mtype:'bee',hp:100,target:'Stranger'}];
 const p={healthy:true,max:3,failed:false,planned:'bee',visible:mobs,teamNames:['Ranger'],safe:()=>true};
 assert.equal(safeThreeShotOpportunity(p),true);
 assert.equal(safeThreeShotOpportunity({...p,healthy:false}),false);
 assert.equal(safeThreeShotOpportunity({...p,max:2}),false);
 assert.equal(safeThreeShotOpportunity({...p,failed:true}),false);
 assert.equal(safeThreeShotOpportunity({...p,visible:[mobs[0],mobs[1],mobs[3]]}),false);
 assert.equal(safeThreeShotOpportunity({...p,visible:[mobs[0],mobs[1],mobs[1]]}),false);
 assert.equal(safeThreeShotOpportunity({...p,safe:m=>m.id!=='bee-3'}),false);
});

test('grown HP never makes ordinary respawn spawn unviable by age alone',()=>{
 assert.equal(farmRiskHp({hp:100},{hp:5000,max_hp:5000}),100);
 assert.equal(farmRiskHp({hp:100},{hp:50,max_hp:100}),100);
 assert.equal(farmRiskHp({hp:100},null),100);
 assert.equal(farmRiskHp({hp:100},{hp:5000,max_hp:5000,attack:99999}),100,
  'attack values are deliberately not normalized by this helper');
});

test('serial monsterhunt follows actual quest receipt and later rotation',()=>{
 const roster=['My_Ranger2','My_Ranger1','My_Ranger3'];
 let state=advanceHuntCycle(null,roster,null).state;
 state=advanceHuntCycle(state,roster,{id:'booboo',c:2}).state;
 assert.equal(state.index,0);
 state=advanceHuntCycle(state,roster,{id:'booboo',c:0}).state;
 assert.equal(state.phase,'turnin');
 assert.equal(advanceHuntCycle(state,roster,null).state.index,1);
});
