import test from 'node:test';
import assert from 'node:assert/strict';
import {declaredFarmDropSources} from '../src/production/materials.mjs';
import {planProduction} from '../src/production/planner.mjs';

const base=()=>({
 items:{raremat:{type:'material'},gem:{type:'material'},
  token:{type:'material'},sword:{upgrade:true}},
 monsters:{bee:{},eventbee:{event:'festival'},questbee:{quest:'rewardQuest'}},
 events:{festival:{}},
 drops:{monsters:{
  bee:[[0.25,'raremat',1]],
  eventbee:[[0.6,'gem',1]],
  questbee:[[0.8,'token',1]]
 }},
 craft:{}
});
function plan(G,item='raremat',options={}){
 return planProduction({G,item,level:0,quantity:2,
  stock:()=>0,bank:()=>0,canBuy:()=>false,
  allowed:['farm'],permit:()=>true,...options});
}

test('W06 ordinary material needs a verified positive monster drop, not a phantom farm',()=>{
 const G=base();
 assert.deepEqual([...plan(G)],[{kind:'farm',item:'raremat',level:0,quantity:2}]);
 delete G.drops.monsters.bee;
 assert.deepEqual(declaredFarmDropSources(G,'raremat'),[]);
 assert.throws(()=>plan(G),/Kein belegter erlaubter Monster-Drop/);
});

test('W06 an item with no declared drop can still use permitted finite market',()=>{
 const G=base();delete G.drops.monsters.bee;
 const steps=plan(G,'raremat',{allowed:['farm','market']});
 assert.deepEqual([...steps],[{kind:'marketBuy',item:'raremat',
  level:0,quantity:2}]);
});

test('W06 only specifically allowed farmer monsters can become farm steps',()=>{
 const G=base();
 assert.deepEqual(declaredFarmDropSources(G,'raremat',
  {allowedMonsters:['unknown','eventbee','bee']}),['bee']);
 assert.throws(()=>plan(G,'raremat',{farmSources:['eventbee']}),/Kein belegter/);
 assert.throws(()=>plan(G,'raremat',{farmSources:[]}),/Kein belegter/);
 assert.deepEqual([...plan(G,'raremat',{farmSources:['bee']})],
  [{kind:'farm',item:'raremat',level:0,quantity:2}]);
});

test('W06 event-only source requires active fresh event evidence',()=>{
 const G=base();
 assert.deepEqual(declaredFarmDropSources(G,'gem',{allowedMonsters:['eventbee']}),[]);
 assert.throws(()=>plan(G,'gem',{farmSources:['eventbee']}),/Kein belegter/);
 const expired={festival:{live:true,expires:Date.now()-5000}};
 assert.throws(()=>plan(G,'gem',{farmSources:['eventbee'],
  state:expired}),/Kein belegter/);
 const active={festival:{live:true,expires:Date.now()+3600000}};
 assert.deepEqual(declaredFarmDropSources(G,'gem',{
  allowedMonsters:['eventbee'],state:active}),['eventbee']);
 assert.deepEqual([...plan(G,'gem',{farmSources:['eventbee'],state:active})],
  [{kind:'farm',item:'gem',level:0,quantity:2}]);
});

test('W06 quest-gated monster drop needs independently verified quest permission',()=>{
 const G=base();
 assert.deepEqual(declaredFarmDropSources(G,'token',{
  allowedMonsters:['questbee']}),[]);
 assert.throws(()=>plan(G,'token',{farmSources:['questbee']}),/Kein belegter/);
 assert.deepEqual([...plan(G,'token',{farmSources:['questbee'],
  questAllowed:name=>name==='rewardQuest'})],
  [{kind:'farm',item:'token',level:0,quantity:2}]);
});

test('W06 nested official open/drop tables provide a valid farm source',()=>{
 const G=base();
 G.drops.monsters.bee=[[0.5,'open','rewardbox']];
 G.drops.rewardbox=[[1,'raremat',2]];
 assert.deepEqual(declaredFarmDropSources(G,'raremat',{
  allowedMonsters:['bee']}),['bee']);
 assert.equal(plan(G,'raremat',{farmSources:['bee']})[0].kind,'farm');
 G.drops.rewardbox=[[1,'gem',2]];
 assert.throws(()=>plan(G,'raremat',{farmSources:['bee']}),/Kein belegter/);
});

test('W06 zero-probability or unrelated monsters cannot invent own material source',()=>{
 const G=base();
 G.drops.monsters.bee=[[0,'raremat',1],[1,'gem',1]];
 assert.deepEqual(declaredFarmDropSources(G,'raremat',{allowedMonsters:['bee']}),[]);
 assert.throws(()=>plan(G,'raremat',{farmSources:['bee']}),/Kein belegter/);
});

test('W06 higher upgrade levels cannot be directly farmed from plain material drops',()=>{
 const G=base();
 assert.throws(()=>plan(G,'raremat',{level:3,farmSources:['bee']}),
  /Kein belegter erlaubter Monster-Drop/);
});

test('W06 damaged source list and malformed drop metadata are not farm evidence',()=>{
 const G=base();
 for(const invalid of [null,'bee',{names:['bee']},Array(257).fill('bee')]){
  assert.deepEqual(declaredFarmDropSources(G,'raremat',
   {allowedMonsters:invalid}),invalid===null?['bee']:[]);
 }
 G.drops.monsters.bee=[['unknown','raremat',1],[-1,'raremat',1]];
 assert.deepEqual(declaredFarmDropSources(G,'raremat'),[]);
});
