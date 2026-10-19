import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDeliveryRuleNeeds,exactAutoDeliveryVariant} from '../src/production/production.mjs';
import {identity} from '../src/core/policy.mjs';

const item={name:'token',level:1,stat_type:'dex',data:{seed:7}};
const valid={name:'Ranger token',item:'token',level:1,recipient:'Ranger',
 quantity:1,gearSlot:'mainhand',variant:{stat_type:'dex',data:{seed:7}}};
const generic={name:'Priest token',item:'token',level:1,recipient:'Priest',
 quantity:1,variant:null};
const supply=(rows)=>goal=>rows.filter(i=>i.name===goal.item&&
 (i.level??0)===goal.level&&(!goal.variant||
 identity(i)===exactAutoDeliveryVariant(goal))).length;

test('W13 malformed exact goal variants never crash, widen, or reserve a send',()=>{
 const cyclic={data:{seed:7}};cyclic.data.self=cyclic.data;
 for(const variant of [
  'dex',[],0,false,42,{name:'other'},
  {level:2},{data:cyclic.data},{data:{seed:1n}},
  {data:{padding:'x'.repeat(650)}}
 ]){
  const goal={...valid,variant};
  assert.doesNotThrow(()=>pendingDeliveryRuleNeeds([goal],()=>0,'Merchant',
   ()=>1));
  assert.deepEqual(pendingDeliveryRuleNeeds([goal],()=>0,'Merchant',
   ()=>1),[],'never turn corrupt exact demand into generic demand');
 }
});

test('W13 valid exact and generic goals keep distinct physically backed recipients',()=>{
 const items=[structuredClone(item),{...item,stat_type:'str',data:{seed:8}}];
 const rows=pendingDeliveryRuleNeeds([valid,generic],()=>0,
  'Merchant',supply(items));
 assert.deepEqual(rows.map(r=>[r.recipient,r.quantity]),[
  ['Ranger',1],['Priest',1]]);
 assert.equal(rows[0].variant.stat_type,'dex');
 const onlyOne=pendingDeliveryRuleNeeds([valid,generic],()=>0,
  'Merchant',supply([item]));
 assert.deepEqual(onlyOne.map(r=>r.recipient),['Ranger']);
});

test('W13 defective settled counter cannot authorize additional delivery',()=>{
 for(const bad of [NaN,Infinity,-1,0.5,'0']){
  const rows=pendingDeliveryRuleNeeds([valid],()=>bad,
   'Merchant',()=>1);
  assert.deepEqual(rows,[]);
 }
 assert.deepEqual(pendingDeliveryRuleNeeds([valid],()=>{throw Error('stale ledger');},
  'Merchant',()=>1),[]);
});

test('W13 inventory probe exceptions do not create virtual send authority',()=>{
 for(const probe of [
  ()=>{throw Error('missing physical stock');},
  g=>g.variant?1:(()=>{throw Error('missing gross capacity')})()
 ]){
  assert.deepEqual(pendingDeliveryRuleNeeds([valid],()=>0,'Merchant',probe),[]);
 }
 assert.deepEqual(pendingDeliveryRuleNeeds(null,()=>0,'Merchant',()=>1),[]);
 assert.deepEqual(pendingDeliveryRuleNeeds(Array(129).fill(valid),()=>0,'Merchant',()=>1),[]);
});

test('W13 invalid recipient, item, level, quantity are never actionable',()=>{
 const bad=[{recipient:1},{recipient:''},{recipient:'Merchant'},
  {item:''},{item:42},{level:Infinity},{level:-1},{level:100},
  {quantity:0},{quantity:1.5}];
 for(const change of bad){
  assert.deepEqual(pendingDeliveryRuleNeeds([{...valid,...change}],
   ()=>0,'Merchant',()=>1),[]);
 }
});
