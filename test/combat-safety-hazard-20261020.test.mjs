import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMultiPullSafety} from '../src/combat/encounter.mjs';
import {planHazardStep} from '../src/combat/navigation.mjs';
import {chooseEmergencyFocus} from '../src/combat/farmer.mjs';

const hero={name:'R1',ctype:'ranger',map:'mansion',in:'mansion',x:0,y:0,
 hp:3900,max_hp:3900,mp:1500,max_mp:1500,attack:400,range:240,frequency:1};
const team=(priestX=50)=>[
 {...hero,class:'ranger',stats:{attack:400,frequency:1,range:240}},
 {...hero,name:'R2',x:40,class:'ranger',stats:{attack:400,frequency:1,range:240}},
 {...hero,name:'P',x:priestX,class:'priest',mp:1500,
  stats:{attack:160,frequency:1,range:210,heal:500},
  combatSupport:{healReady:true,healRange:220}}
];
const mobs=(n,kind='rat')=>Array.from({length:n},(_,i)=>({
 id:String(i+1),mtype:kind,type:'monster',map:'mansion',in:'mansion',
 hp:kind==='rat'?1300:80,x:40+i*20,y:0,target:null
}));
const definitions={monsters:{
 rat:{hp:1300,attack:90,frequency:1,range:35},
 goo:{hp:80,attack:10,frequency:.6,range:20}
}};
test('2026-10-20 incident: three neutral rats exceed bounded survival budget',()=>{
 const r=evaluateMultiPullSafety({actor:hero,team:team(),targets:mobs(3),G:definitions});
 assert.equal(r.safe,false,JSON.stringify(r));
 assert.equal(r.reason,'multi-pull-survival-budget');
 assert.ok(r.exposure>r.hpBudget);
});
test('healthy team can still multi-pull harmless monsters with healer in reach',()=>{
 const r=evaluateMultiPullSafety({actor:hero,team:team(),targets:mobs(2,'goo'),G:definitions});
 assert.equal(r.safe,true,JSON.stringify(r));
});
test('priest outside real heal range vetoes even weak multipull',()=>{
 const r=evaluateMultiPullSafety({actor:hero,team:team(350),targets:mobs(2,'goo'),G:definitions});
 assert.equal(r.safe,false);assert.equal(r.reason,'multi-pull-priest-out-of-heal-range');
});
test('stale priest, missing enemy stats and near-death ranger all fail closed',()=>{
 assert.equal(evaluateMultiPullSafety({actor:hero,team:team().map(m=>m.name==='P'?{...m,received:1}:m),targets:mobs(2),G:definitions}).safe,false);
 assert.equal(evaluateMultiPullSafety({actor:hero,team:team(),targets:mobs(2),G:{monsters:{}}}).safe,false);
 assert.equal(evaluateMultiPullSafety({actor:{...hero,hp:400},team:team(),targets:mobs(2),G:definitions}).safe,false);
});
test('local planner does not cross known monster danger radius, picks a flank',()=>{
 const obstacles=[{id:'a',mtype:'rat',hp:300,target:'R1',map:'mansion',in:'mansion',
  x:65,y:0,range:10}];
 const step=planHazardStep({character:hero,goal:{...hero,x:170,y:20},monsters:obstacles,
  definitions:definitions.monsters,canMove:()=>true,stepLengths:[70]});
 assert.ok(step, 'a sidestep exists');
 assert.ok(Math.hypot(step.x-65,step.y)>0);
 assert.ok(Math.abs(step.y)>25,'should route around danger, not directly into it');
});
test('no allowed movement returns null instead of inventing a path',()=>{
 assert.equal(planHazardStep({character:hero,goal:{...hero,x:200,y:0},monsters:mobs(2),definitions:definitions.monsters,canMove:()=>false}),null);
});
test('danger reduction per kill wins after endangered teammate priority',()=>{
 const members=[{name:'R1',hp:100,max_hp:1000}];
 const enemies=[{id:'a',mtype:'high',target:'R1',hp:300},
  {id:'b',mtype:'low',target:'R1',hp:100}];
 assert.equal(chooseEmergencyFocus(enemies,members,{high:{attack:150,frequency:2},
  low:{attack:5,frequency:.5}}).id,'a');
});
