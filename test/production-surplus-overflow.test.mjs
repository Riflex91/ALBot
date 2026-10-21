import test from 'node:test';
import assert from 'node:assert/strict';
import {surplusQuantity,variantCount} from '../src/core/policy.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';

test('gross reservations keep committed stock; excess remains usable',()=>{
 assert.equal(surplusQuantity(3,3),0);
 assert.equal(surplusQuantity(3,2),1);
 assert.equal(surplusQuantity(9,3,2,1),3);
 assert.equal(surplusQuantity(1,3),0);
 assert.equal(surplusQuantity(1,Infinity),0,'unknown reservation fails closed');
 assert.equal(surplusQuantity(1,-1),0,'invalid reservation fails closed');
 assert.equal(surplusQuantity(3,3-3),3,'regression example: netting the held stock would wrongly free all 3');
});

test('only physical copies of an exact variant may be dispositioned',()=>{
 const items=[{name:'mat',level:0,q:3},{name:'mat',level:1,q:2},
  {name:'mat',level:0,p:'rare',q:1},...Array(38).fill(null)];
 let reserved=3;
 const bot={p:{c:{items},G:{items:{mat:{type:'material',g:5,s:9999}},craft:{},skills:{}},Gversion:1,
    call:()=>0},
   cfg:{production:{autoDisposition:true,enabled:true,exchange:false,minChance:.7,
       minImprovement:.1,lossBudget:10000},
       party:{merchant:'M'},merchant:{bank:true},characters:[]},
   me:{name:'M',role:'merchant'},
   transport:{peers:new Map()},economy:{
    safe:i=>!!i&&!i.l,explicit:()=>null,value:()=>5,
    count:i=>variantCount(items,i)},
   production:{reservedQuantity:()=>reserved},
   event:()=>{},bank:null};
 const intelligence=createEconomicIntelligence(bot);
 assert.equal(intelligence.disposition(items[0]),null,'three held are all reserved');
 reserved=2;const result=intelligence.disposition(items[0]);
 assert.ok(result,'one surplus copy may receive an auto disposition rule');
 assert.equal(result.action,'sell');
 reserved=3;assert.equal(intelligence.disposition(items[0]),null,'restoring goal prevents sale');
});
