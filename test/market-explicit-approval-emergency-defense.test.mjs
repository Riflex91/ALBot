import test from 'node:test';
import assert from 'node:assert/strict';
import {marketRuleApproved,marketPurchaseCeiling,independentSellerMedian} from '../src/merchant/market-purchase-policy.mjs';
import {engagedEmergencyBasicDefense} from '../src/combat/farmer.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';

const explicit={enabled:true,action:'marketBuy',item:'phelmet',maxPrice:150000,
 priceSource:'marketRatio',marketPercent:80};

test('market authorisation is explicit and enabled (no autonomous fallback)',()=>{
 assert.equal(marketRuleApproved(explicit),true);
 for(const rule of [null,{}, {...explicit,enabled:false},
  {...explicit,action:'buy'}, {...explicit,action:'sell'},
  {...explicit,enabled:undefined}])assert.equal(marketRuleApproved(rule),false);
});
test('ratio-based purchase price never exceeds the hard absolute cap',()=>{
 assert.equal(marketPurchaseCeiling(explicit,100000),80000);
 assert.equal(marketPurchaseCeiling({...explicit,marketPercent:120},100000),120000);
 assert.equal(marketPurchaseCeiling({...explicit,marketPercent:150},200000),150000);
 assert.equal(marketPurchaseCeiling(explicit,null),null);
 assert.equal(marketPurchaseCeiling(explicit,NaN),null);
 assert.equal(marketPurchaseCeiling({...explicit,marketPercent:151},100000),null);
 assert.equal(marketPurchaseCeiling({...explicit,marketPercent:0},100000),null);
 assert.equal(marketPurchaseCeiling({...explicit,maxPrice:-1},100000),null);
});
test('one seller cannot manufacture a trusted median via repeated historical quotes',()=>{
 const rows=[{seller:'A',price:999999,at:1},
  {seller:'A',price:100000,at:2},{seller:'B',price:80000,at:2}];
 assert.equal(independentSellerMedian(rows),null);
 assert.equal(independentSellerMedian([...rows,{seller:'C',price:120000,at:3}]),100000);
 assert.equal(independentSellerMedian([...rows,{seller:'C',price:120000,at:3},
  {seller:'D',price:140000,at:4}]),120000);
});
test('full schema exposes relative-price mode and percent field for the configurator',()=>{
 const item=FULL_DESCRIPTOR.schema.properties.items.items.properties;
 assert.ok(item.priceSource.enum.includes('marketRatio'));
 assert.equal(item.marketPercent.default,80);
 assert.equal(item.marketPercent.minimum,10);
 assert.equal(item.marketPercent.maximum,150);
});
const actor={name:'My_Ranger1',type:'character',map:'halloween',in:'halloween',
 x:0,y:0,hp:4300,max_hp:4800,range:180};
const greenjr={id:'greenjr-id',type:'monster',mtype:'greenjr',map:'halloween',
 in:'halloween',x:100,y:0,target:'My_Ranger2',hp:5000};
test('verified engaged Green Jr permits only close healthy single-target emergency defense',()=>{
 const team=['My_Ranger1','My_Ranger2','My_Priest'];
 assert.equal(engagedEmergencyBasicDefense(actor,greenjr,team),true);
 for(const variant of [
  {...greenjr,target:null},{...greenjr,target:'Outside'},
  {...greenjr,hp:0},{...greenjr,dead:true},
  {...greenjr,invincible:true},{...greenjr,map:'main',in:'main'},
  {...greenjr,x:1000}])assert.equal(engagedEmergencyBasicDefense(actor,variant,team),false);
 assert.equal(engagedEmergencyBasicDefense({...actor,hp:1500},greenjr,team),false);
 assert.equal(engagedEmergencyBasicDefense(actor,greenjr,[]),false);
});
