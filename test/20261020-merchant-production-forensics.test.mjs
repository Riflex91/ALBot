import test from 'node:test';
import assert from 'node:assert/strict';
import {pontyScanDue} from '../src/merchant/market.mjs';
import {routineMerchantDepotDue} from '../src/merchant/controller.mjs';
import {prioritizeContinuingMaterialGoal} from '../src/merchant/production-priority.mjs';

test('read-only Ponty market scan never drives another journey after one minute',()=>{
 const last=1000000;
 assert.equal(pontyScanDue({now:last,last:0}),true);
 assert.equal(pontyScanDue({now:last+60000,last}),false);
 assert.equal(pontyScanDue({now:last+599999,last}),false);
 assert.equal(pontyScanDue({now:last+600000,last}),true);
 assert.equal(pontyScanDue({now:last-1,last}),false);
});

test('explicit acquisition demand has a bounded faster survey, without rapid cycling',()=>{
 const last=1000000;
 assert.equal(pontyScanDue({now:last+60000,last,approvedDemand:true}),false);
 assert.equal(pontyScanDue({now:last+119999,last,approvedDemand:true}),false);
 assert.equal(pontyScanDue({now:last+120000,last,approvedDemand:true}),true);
});

test('depot audit does not restart 30 seconds after bank cycle completion',()=>{
 const last=1000000;
 assert.equal(routineMerchantDepotDue({now:last+30000,completedAt:last,atBank:true}),false);
 assert.equal(routineMerchantDepotDue({now:last+179999,completedAt:last,atBank:true}),false);
 assert.equal(routineMerchantDepotDue({now:last+180000,completedAt:last,atBank:true}),true);
 assert.equal(routineMerchantDepotDue({now:last+180000,completedAt:last,atBank:false}),false);
 assert.equal(routineMerchantDepotDue({now:last+600000,completedAt:last,atBank:false}),true);
});

const rank=[{key:'new',priority:102},{key:'materials',priority:100}];
const order=(params={})=>prioritizeContinuingMaterialGoal(rank,{
 heldKey:'materials',heldAt:100000,now:110000,
 keyOf:g=>g.key,scoreOf:g=>g.priority,...params
});
test('a live material farm plan survives a minor ranking shuffle for up to 90 seconds',()=>{
 assert.equal(order()[0].key,'materials');
 assert.equal(order({now:189999})[0].key,'materials');
 assert.equal(order({now:190000})[0].key,'new');
 assert.equal(order({heldKey:'removed'})[0].key,'new');
 assert.equal(order({heldAt:0})[0].key,'new');
});

test('urgent production and incomparable goals never inherit a material hold',()=>{
 assert.equal(order({scoreOf:g=>g.key==='new'?120:100})[0].key,'new');
 assert.equal(order({scoreOf:g=>g.key==='new'?NaN:100})[0].key,'new');
 assert.deepEqual(prioritizeContinuingMaterialGoal([],{}),[]);
 assert.equal(order({now:99999})[0].key,'new');
 assert.equal(rank[0].key,'new','helper never mutates ranked scheduler input');
});
