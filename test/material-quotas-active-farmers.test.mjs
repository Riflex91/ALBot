import test from 'node:test';
import assert from 'node:assert/strict';
import {planMaterialQuotas,materialQuotaCap} from '../src/production/material-quotas.mjs';

const request={objective:'farm:goo:gem',item:'gem0',monster:'goo',quantity:9};
const peer=(name,held=0,extra={})=>({
 name,running:true,rip:false,realm:'EUII',free:15,inventoryBlocked:false,
 materialProgress:[{objective:request.objective,quantity:held}],...extra
});
const plan=(quantity,workers,{freeReserve=4}={})=>{
 const peers=new Map(workers.map(w=>[w.name,w]));
 return planMaterialQuotas({...request,quantity},
  ['A','B','C'],name=>peers.get(name), 'EUII',{freeReserve});
};

test('offline selected Farmer no longer traps one third of material order',()=>{
 const result=plan(9,[peer('A',0),peer('B',0),peer('C',0,{running:false})]);
 assert.deepEqual(result,{remaining:9,quotas:[
  {name:'A',quantity:5},{name:'B',quantity:4}]});
 assert.equal(result.quotas.reduce((sum,x)=>sum+x.quantity,0),9);
 assert.equal(materialQuotaCap({...request,...result},'C'),0);
});
test('dead, disconnected and wrong-realm Farmers get no assigned new production',()=>{
 const result=plan(7,[peer('A',1),peer('B',4,{rip:true}),
  peer('C',7,{realm:'USIV'})]);
 assert.deepEqual(result,{remaining:6,quotas:[{name:'A',quantity:7}]});
});
test('team exact shares never round up production beyond remaining order',()=>{
 const result=plan(2,[peer('A'),peer('B'),peer('C')]);
 assert.deepEqual(result,{remaining:2,quotas:[
  {name:'A',quantity:1},{name:'B',quantity:1},{name:'C',quantity:0}]});
 assert.equal(materialQuotaCap({...request,quantity:2,...result},'C'),0);
});
test('existing online stock counts toward material fulfillment even at full Farmer inventory',()=>{
 const result=plan(10,[peer('A',7,{free:4}),peer('B',1)]);
 assert.deepEqual(result,{remaining:2,quotas:[{name:'B',quantity:3}]});
 assert.equal(materialQuotaCap({...request,quantity:10,...result},'A'),0);
 assert.equal(materialQuotaCap({...request,quantity:10,...result},'B'),3);
});
test('no eligible farmer leaves material request pending but authorizes no new pulls',()=>{
 const result=plan(10,[peer('A',2,{free:4}),peer('B',1,{inventoryBlocked:true})]);
 assert.deepEqual(result,{remaining:7,quotas:[]});
 assert.equal(materialQuotaCap({...request,quantity:10,...result},'A'),0);
 assert.equal(materialQuotaCap({...request,quantity:10,...result},'B'),0);
});
test('quantity already fulfilled by active holders needs no new farming',()=>{
 const result=plan(7,[peer('A',5),peer('B',2)]);
 assert.deepEqual(result,{remaining:0,quotas:[
  {name:'A',quantity:5},{name:'B',quantity:2}]});
 assert.equal(materialQuotaCap({...request,quantity:7,...result},'A'),0);
 assert.equal(materialQuotaCap({...request,quantity:7,...result},'B'),0);
});
test('per-Farmer material quota never becomes unbounded after a disconnect',()=>{
 const active=plan(8,[peer('A'),peer('C')]);
 assert.deepEqual(active.quotas,[{name:'A',quantity:4},{name:'C',quantity:4}]);
 const row={...request,quantity:8,...active};
 assert.equal(materialQuotaCap(row,'B'),0,'unassigned must not harvest all eight');
 assert.equal(materialQuotaCap(row,'C'),4);
 assert.equal(materialQuotaCap({...row,remaining:0},'C'),0);
});
test('legacy material requests without quotas preserve bounded previous limit',()=>{
 assert.equal(materialQuotaCap({...request,quantity:6},'A'),6);
 assert.equal(materialQuotaCap({...request,quantity:6,quotas:[]},'A'),0);
 assert.equal(materialQuotaCap({...request,quantity:6,quotas:[
  {name:'A',quantity:1200000}]},'A'),6);
 assert.equal(materialQuotaCap({...request,quantity:6,quotas:[
  {name:'A',quantity:-1}]},'A'),0);
 assert.equal(materialQuotaCap({...request,quantity:0},'A'),0);
});
test('invalid quantities and malformed live progress fail closed without speculative allocations',()=>{
 const malformed=[peer('A',-1),peer('B',Infinity),peer('C','25')];
 assert.deepEqual(planMaterialQuotas(request,['A','B','C'],
  n=>malformed.find(x=>x.name===n),'EUII'),{remaining:9,quotas:[]});
 assert.deepEqual(planMaterialQuotas({...request,quantity:Infinity},['A'],
  ()=>peer('A'),'EUII'),{remaining:0,quotas:[]});
});
test('duplicate roster entries cannot double count held items or material quotas',()=>{
 const active=peer('A',3);
 const result=planMaterialQuotas({...request,quantity:6},
  ['A','A','B'],name=>name==='A'?active:peer('B',1),
  'EUII',{freeReserve:4});
 assert.deepEqual(result,{remaining:2,quotas:[
  {name:'A',quantity:4},{name:'B',quantity:2}]});
});
