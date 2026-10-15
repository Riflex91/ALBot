import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedHunt,huntForFarmer,advanceHuntCycle,skipHuntWithoutSpawn,advancePastSkippedHunts} from '../src/world/hunt-rotation.mjs';
import {maximalSafeAimedTargets} from '../src/combat/skills.mjs';
import {selectHuntArea,createTeamPlan} from '../src/world/team-plan.mjs';
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

test('serial hunt never blocks otherwise safe farming during acquire, turnin or stale status',()=>{
 const ranked=[{target:'bee',key:'bee-safe',score:70},{target:'goo',key:'goo-safe',score:45}];
 for(const phase of ['acquire','turnin','unknown']){
  const picked=selectHuntArea(ranked,{owner:'My_Ranger2',phase,monster:null});
  assert.equal(picked.area?.target,'bee');
  assert.equal(picked.kind,'farm');
  assert.ok(picked.deferred);
 }
 const unsupported=selectHuntArea(ranked,{owner:'My_Ranger2',phase:'combat',monster:'cgoo'});
 assert.equal(unsupported.kind,'farm','an unsupported hunt monster cannot starve normal farming');
 assert.equal(unsupported.area?.target,'bee');
 assert.equal(unsupported.deferred,'NO_SAFE_HUNT_SPAWN');
 assert.equal(selectHuntArea([],{owner:'My_Ranger2',phase:'combat',monster:'cgoo'}).area,null,
  'fallback is only from already-approved farm spawn candidates');
});
test('serial hunt takes the exact safe quest species over higher-scored goo/bee',()=>{
 const ranked=[{target:'bee',score:100},{target:'cgoo',score:1},{target:'goo',score:80}];
 const chosen=selectHuntArea(ranked,{owner:'My_Ranger1',phase:'combat',monster:'cgoo',remaining:41});
 assert.equal(chosen.area?.target,'cgoo');
 assert.equal(chosen.kind,'hunt');
 assert.equal(chosen.deferred,null);
});
test('leader actually publishes a safe team farm plan while hunt assignment is pending',()=>{
 const G={monsters:{bee:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},
  maps:{main:{monsters:[{type:'bee',count:3,boundaries:[['main',0,0,100,100]]}]}}};
 const events=[],saved=new Map(),c={name:'My_Ranger2',ctype:'ranger',map:'main',in:'main',
  x:0,y:0,attack:50,frequency:1,hp:500,max_hp:500,mp:500,max_mp:500,
  items:[],slots:{},xp:0,gold:0,s:{monsterhunt:null}};
 const bot={p:{c,G,root:{S:{}},parent:{S:{}},realm:()=> 'USIV',entities:{},
  read:k=>saved.get(k)??null,write:(k,v)=>{saved.set(k,v);return true;}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:3,
    planHoldMs:60000},world:{excludedMaps:[],cacheTtlMs:10000,quests:true,questTargets:true},
    party:{enabled:true,aoe:false}},
  me:{name:'My_Ranger2',group:'team1',role:'farmer',farmTargets:[]},
  leader:'My_Ranger2',farmers:['My_Ranger2','My_Ranger1','My_Ranger3'],
  transport:{fresh:()=>null},strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  decisionEpoch:1,monsters:()=>[],event:(name,data)=>events.push({name,data}),
  movement:{order:null,stop(){}},gear:{snapshot:()=>({})},
  content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);
 plan.tick();
 assert.equal(plan.status().hunt?.phase,'acquire');
 assert.equal(plan.status().current?.target,'bee');
 assert.equal(plan.target(),'bee');
 assert.equal(plan.status().current?.kind,'farm');
 assert.ok(events.some(x=>x.name==='hunt.farmFallback'&&x.data.reason==='HUNT_ACQUIRE_PENDING'));
 assert.ok(events.some(x=>x.name==='plan.selected'&&x.data.target==='bee'));
});

test('unavailable approved spawn skips only the current verified combat quest and retains it for later',()=>{
 const roster=['My_Ranger2','My_Ranger1','My_Ranger3'],now=1792086400000;
 const initial=advanceHuntCycle(null,roster,{id:'booboo',c:2}).state;
 const ignored=skipHuntWithoutSpawn(initial,roster,{
  owner:'My_Ranger2',monster:'booboo',remaining:2,safeSpawnChecked:false},now);
 assert.equal(ignored.changed,false,'no unverified or speculative skip');
 const result=skipHuntWithoutSpawn(initial,roster,{
  owner:'My_Ranger2',monster:'booboo',remaining:2,safeSpawnChecked:true},now);
 assert.equal(result.changed,true);
 assert.equal(result.state.index,1);
 assert.equal(result.state.skipped.My_Ranger2.id,'booboo');
 assert.equal(result.state.skipped.My_Ranger2.until,now+300000);
 assert.equal(initial.index,0,'input not mutated');
 assert.equal(advanceHuntCycle(result.state,roster,null).objective.owner,'My_Ranger1');
 assert.equal(advancePastSkippedHunts(result.state,roster,n=>
  n==='My_Ranger2'?{id:'booboo',c:2}:null,now).allBlocked,false);
});
test('all three blocked monsterhunts settle to safe farming and become retryable',()=>{
 const roster=['My_Ranger2','My_Ranger1','My_Ranger3'],now=1792086400000;
 const tasks={My_Ranger2:{id:'booboo',c:2},
  My_Ranger1:{id:'cgoo',c:12},My_Ranger3:{id:'snake',c:4}};
 let state=advanceHuntCycle(null,roster,tasks.My_Ranger2).state;
 for(const name of roster){
  state=skipHuntWithoutSpawn(state,roster,{
   owner:name,monster:tasks[name].id,remaining:tasks[name].c,
   safeSpawnChecked:true},now).state;
 }
 const lookup=name=>tasks[name];
 const exhausted=advancePastSkippedHunts(state,roster,lookup,now+2000);
 assert.equal(exhausted.allBlocked,true);
 assert.equal(exhausted.changed,false);
 assert.equal(exhausted.state.index,0);
 const expired=advancePastSkippedHunts(state,roster,lookup,now+300001);
 assert.equal(expired.allBlocked,false,'eligible for re-evaluation after cooldown');
 tasks.My_Ranger1={id:'bee',c:3};
 const changed=advancePastSkippedHunts(state,roster,lookup,now+10000);
 assert.equal(changed.allBlocked,false,'new quest status unblocks immediately');
 assert.equal(changed.state.index,1);
 assert.equal(tasks.My_Ranger2.id,'booboo','existing game quest remains unmodified');
});
test('leader publishes next farmer hunt ownership after a verified no-spawn evaluation',()=>{
 const G={monsters:{
  goo:{hp:30,attack:1,frequency:1,xp:20,respawn:1},
  booboo:{hp:100,attack:1,frequency:1,xp:20,respawn:1}},
  maps:{main:{monsters:[{type:'goo',count:3,boundaries:[['main',0,0,100,100]]}]}}};
 const events=[],saved=new Map(),c={name:'My_Ranger2',ctype:'ranger',
  map:'main',in:'main',x:0,y:0,attack:50,frequency:1,hp:500,max_hp:500,
  mp:500,max_mp:500,items:[],slots:{},xp:0,gold:0,
  s:{monsterhunt:{id:'booboo',c:2}}};
 const peers={My_Ranger1:{name:'My_Ranger1',running:true,rip:false,realm:'USIV',
  monsterhunt:null},My_Ranger3:{name:'My_Ranger3',running:true,rip:false,
  realm:'USIV',monsterhunt:null}};
 const bot={p:{c,G,root:{S:{}},parent:{S:{}},realm:()=> 'USIV',entities:{},
  read:k=>saved.get(k)??null,write:(k,v)=>{saved.set(k,v);return true;}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},
   farming:{pvp:false,maxAggro:3,planHoldMs:60000},
   world:{excludedMaps:[],cacheTtlMs:10000,quests:true,questTargets:true},
   party:{enabled:true,aoe:false}},
  me:{name:'My_Ranger2',group:'team1',role:'farmer',farmTargets:[]},
  leader:'My_Ranger2',farmers:['My_Ranger2','My_Ranger1','My_Ranger3'],
  transport:{fresh:n=>peers[n]??null},
  strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  decisionEpoch:1,monsters:()=>[],event:(name,data)=>events.push({name,data}),
  movement:{order:null,stop(){}},gear:{snapshot:()=>({})},
  content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);
 plan.tick();
 const skipped=events.find(e=>e.name==='hunt.noApprovedSpawn');
 assert.equal(skipped?.data?.monster,'booboo');
 assert.equal(skipped?.data?.nextOwner,'My_Ranger1');
 assert.equal(plan.orderedHunt().owner,'My_Ranger1');
 assert.equal(plan.orderedHunt().phase,'acquire');
 assert.equal(plan.status().current?.target,'goo','safe fallback stays available');
 assert.deepEqual(c.s.monsterhunt,{id:'booboo',c:2},
  'game quest is preserved for possible later completion');
 assert.equal(saved.get('albot:teamhunt:team1')?.index,1);
});
