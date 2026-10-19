import test from 'node:test';
import assert from 'node:assert/strict';
import {exactAutoDeliveryVariant,productionGoalMatchesItem} from '../src/production/production.mjs';
import {chooseRule,identity} from '../src/core/policy.mjs';

const base={name:'token',level:1,stat_type:'dex',p:'ancient',
 title:'Hero',acc:'s1',rid:'R42',data:{seed:3,quality:'rare'}};
const goal={item:'token',level:1,quantity:1,
 variant:{stat_type:'dex',p:'ancient',title:'Hero',acc:'s1',
  rid:'R42',data:{seed:3,quality:'rare'}}};
const rule=(extra={})=>({enabled:true,_autoProduction:true,
 name:'Autolieferung Token',item:'token',action:'send',
 role:'merchant',character:'Merchant',recipient:'Ranger',
 minLevel:1,maxLevel:1,statType:'dex',property:'ancient',
 title:'Hero',priority:25,batch:1,keep:0,teamReserve:0,
 _autoExactVariant:exactAutoDeliveryVariant(goal),...extra});
const context={role:'merchant',character:'Merchant',
 map:'main',server:'EUI',task:'supply'};
test('W13 exact auto-delivery identity contains opaque data, acc and rid fields',()=>{
 assert.equal(exactAutoDeliveryVariant(goal),identity(base));
 assert.equal(chooseRule([rule()],base,context)?.name,
  'Autolieferung Token');
});
test('W13 auto send cannot substitute another copy matching only editor-visible stat/title fields',()=>{
 for(const mutate of [
  i=>{i.acc='s2';},
  i=>{i.rid='R43';},
  i=>{i.data.seed=4;},
  i=>{delete i.data;},
  i=>{delete i.acc;},
  i=>{delete i.rid;},
  i=>{i.l='lock';},
  i=>{i.b='bound';},
  i=>{i.title='Other';},
  i=>{i.stat_type='int';}
 ]){
  const item=structuredClone(base);mutate(item);
  assert.equal(chooseRule([rule()],item,context),null,
   'only the physically exact variant can be chosen for the generated send rule');
 }
});
test('W13 exact variant-specific generated rules select distinct correct recipients',()=>{
 const variantA=rule({name:'Dex A',recipient:'A',
  _autoExactVariant:identity({...base,acc:'a'}),priority:100});
 const variantB=rule({name:'Dex B',recipient:'B',
  _autoExactVariant:identity({...base,acc:'b'}),priority:200});
 assert.equal(chooseRule([variantA,variantB],
  {...base,acc:'a'},context)?.recipient,'A');
 assert.equal(chooseRule([variantA,variantB],
  {...base,acc:'b'},context)?.recipient,'B');
 assert.equal(chooseRule([variantA,variantB],
  {...base,acc:'c'},context),null);
});
test('W13 generic automatic send and explicit user rules keep existing matching behavior',()=>{
 const generic=rule({name:'Generic auto',
  _autoExactVariant:undefined});
 const explicit=rule({name:'Explicit manual',_autoProduction:false,
  _autoExactVariant:identity(base)});
 assert.equal(chooseRule([generic],
  {...base,acc:'other'},context)?.name,'Generic auto');
 assert.equal(chooseRule([explicit],
  {...base,acc:'other'},context)?.name,'Explicit manual');
});
test('W13 malformed exact variant proof never yields a generated send authority',()=>{
 for(const variant of [null,undefined,[],42,'hello']){
  assert.equal(exactAutoDeliveryVariant({...goal,variant}),null);
 }
 assert.equal(exactAutoDeliveryVariant({...goal,item:'',variant:{}}),null);
 assert.equal(exactAutoDeliveryVariant({...goal,level:Infinity,variant:{}}),null);
 assert.equal(exactAutoDeliveryVariant({...goal,variant:{data:{x:'x'.repeat(600)}}}),null);
 const circular={seed:1};circular.self=circular;
 assert.equal(exactAutoDeliveryVariant({...goal,variant:{data:circular}}),null);
 assert.equal(exactAutoDeliveryVariant({...goal,variant:{data:1n}}),null);
 const malformed=structuredClone(base);malformed.data={seed:1n};
 assert.doesNotThrow(()=>chooseRule([rule()],malformed,context));
 assert.equal(chooseRule([rule()],malformed,context),null);
 for(const bad of [null,NaN,42,'not-an-identity']){
  assert.equal(chooseRule([rule({_autoExactVariant:bad})],
   base,context),null);
 }
});

test('W13 same complete variant identity is used for stock availability and delivery credit',()=>{
 assert.equal(productionGoalMatchesItem(base,goal),true);
 for(const mutate of [
  i=>{i.acc='wrong';},
  i=>{i.rid='other';},
  i=>{i.data.seed++;},
  i=>{i.level++;},
  i=>{i.l=true;}
 ]){
  const alternate=structuredClone(base);mutate(alternate);
  assert.equal(productionGoalMatchesItem(alternate,goal),false);
 }
 assert.equal(productionGoalMatchesItem(base,{...goal,variant:null}),true);
 assert.equal(productionGoalMatchesItem(base,{...goal,variant:{}}),false,
  'an exact empty physical variant is not a wildcard for opaque properties');
});
test('W13 malformed variant goals fail closed even in delivery accounting',()=>{
 const cyclic={};cyclic.self=cyclic;
 for(const variant of [[],0,false,'',1,'text',{data:1n},{data:cyclic}]){
  assert.equal(productionGoalMatchesItem(base,{...goal,variant}),false);
 }
});
