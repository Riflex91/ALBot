import test from 'node:test';
import assert from 'node:assert/strict';
import {transientMovementInterruption} from '../src/core/movement.mjs';
import {safeThreeShotOpportunity} from '../src/combat/encounter.mjs';
import {farmRiskHp,questIdentity} from '../src/world/strategy.mjs';
import {advanceHuntCycle,normalizedHunt,huntForFarmer,huntDeadlineStatus,OFFICIAL_HUNT_DURATION_MS} from '../src/world/hunt-rotation.mjs';

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

test('official monsterhunt duration is 30 minutes and live remaining ms governs planning',()=>{
 assert.equal(OFFICIAL_HUNT_DURATION_MS,1800000);
 const q=normalizedHunt({id:'booboo',c:12,ms:150000,sn:'US IV'});
 assert.deepEqual(q,{id:'booboo',c:12,ms:150000,sn:'US IV'});
 assert.equal(huntDeadlineStatus(q,'USIV',20,5).state,'viable');
 assert.equal(huntDeadlineStatus({...q,ms:60000},'USIV',20,5).state,'insufficient-time');
 assert.equal(huntDeadlineStatus({...q,ms:0},'USIV',20,5).state,'expired');
 assert.equal(huntDeadlineStatus(q,'EUI',20,5).state,'wrong-realm');
 assert.equal(huntDeadlineStatus({id:'booboo',c:12},'USIV').state,'unverified');
});
test('expired hunt rotates without inventing kills or claiming reward',()=>{
 const roster=['My_Ranger1','My_Ranger2','My_Ranger3'];
 let r=advanceHuntCycle(null,roster,{id:'booboo',c:2,ms:15000});
 assert.equal(r.objective.owner,'My_Ranger1');
 r=advanceHuntCycle(r.state,roster,{id:'booboo',c:2,ms:0});
 assert.equal(r.objective.owner,'My_Ranger2');
 assert.equal(r.state.phase,'acquire');
});
test('peer monsterhunt timer is reduced by age of last authenticated heartbeat',()=>{
 const before=Date.now();
 const q=huntForFarmer('My_Ranger2','My_Ranger1',null,{
  running:true,rip:false,realm:'USIV',
  received:before-5000,monsterhunt:{id:'booboo',c:2,ms:12000,sn:'US IV'}
 },'USIV');
 assert.ok(q.ms>=6000&&q.ms<=7000);
 assert.equal(q.sn,'US IV');
});

test('countdown update alone is never treated as completed or reassigned hunt',()=>{
 const a={id:'booboo',c:2,ms:800000,sn:'US IV'};
 const b={...a,ms:799500};
 assert.equal(questIdentity(a),questIdentity(b));
 assert.notEqual(questIdentity(a),questIdentity({...a,c:1}));
 assert.notEqual(questIdentity(a),questIdentity(null));
 assert.notEqual(questIdentity(a),questIdentity({...a,sn:'EU II'}));
});

test('all expired hunts stop rotating until an actual new timer or quest appears',()=>{
 const roster=['My_Ranger1','My_Ranger2','My_Ranger3'];
 let state=advanceHuntCycle(null,roster,{id:'goo',c:2,ms:0}).state;
 assert.equal(state.index,1);
 state=advanceHuntCycle(state,roster,{id:'bee',c:3,ms:0}).state;
 assert.equal(state.index,2);
 state=advanceHuntCycle(state,roster,{id:'snake',c:3,ms:0}).state;
 assert.equal(state.index,0);
 const again=advanceHuntCycle(state,roster,{id:'goo',c:2,ms:0});
 assert.equal(again.state.index,0,'bounded cooldown, no infinite A/B/C rotation');
 assert.equal(again.changed,false);
});
