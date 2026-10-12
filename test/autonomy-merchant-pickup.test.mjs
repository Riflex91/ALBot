import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryHpThreshold} from '../src/combat/farmer.mjs';
import {bankExpansionAffordable} from '../src/merchant/bank.mjs';
import {createLogistics,teamPickupThreshold} from '../src/items/logistics.mjs';

test('recovery continues using potions until resumeAbove, not merely hpBelow',()=>{
 assert.equal(recoveryHpThreshold(true,.85,.95,false,.8),.95);
 assert.equal(recoveryHpThreshold(false,.85,.95,false,.8),.85);
 assert.equal(recoveryHpThreshold(false,.85,.95,true,.8),.8);
 assert.equal(4649/5449<recoveryHpThreshold(true,.85,.95,false,.8),true);
});
test('bank expansion never exceeds 75 percent of live merchant gold',()=>{
 assert.equal(bankExpansionAffordable(750000,1000000,2000000,.75),true);
 assert.equal(bankExpansionAffordable(750001,1000000,2000000,.75),false);
 assert.equal(bankExpansionAffordable(750000,999999,2000000,.75),false);
 assert.equal(bankExpansionAffordable(100,1000,99,.75),false);
 assert.equal(bankExpansionAffordable(0,1000,2000000,.75),false);
});
test('30 slot pickup threshold counts slots, not quantities, requires fresh selected farmers',()=>{
 const row=slots=>({running:true,rip:false,realm:'EUII',lootSlots:slots});
 assert.deepEqual(teamPickupThreshold([row(10),row(12),row(7)],'EUII',30),
   {ready:true,slots:29,trigger:false});
 assert.deepEqual(teamPickupThreshold([row(10),row(12),row(8)],'EUII',30),
   {ready:true,slots:30,trigger:true});
 assert.equal(teamPickupThreshold([row(30),{...row(10),realm:'USI'},row(1)],'EUII',30).trigger,false);
 assert.equal(teamPickupThreshold([row(20),null,row(20)],'EUII',30).ready,false);
});
function logisticsFor(items,extraRules=[],reserved=()=>0){
 const p={c:{name:'Ranger',map:'main',items},
   G:{items:{sword:{type:'weapon'},gem0:{type:'material'},hpot0:{type:'pot',gives:[['hp',200]]},
     pickaxe:{type:'tool'},cxjar:{type:'material'}}},realm:()=> 'EUII'};
 const cfg={items:extraRules,merchant:{pickup:true,maxDelivery:1000},party:{merchant:'Merchant'},
   general:{messageTtlMs:10000},farming:{freeSlots:3}};
 const bot={p,cfg,me:{name:'Ranger',role:'farmer'},rule:()=>null,task:()=> 'farm',
   production:{effectiveRules:()=>extraRules,reservedQuantity:reserved,matchesOutput:()=>true,
     canRecordDelivery:()=>true},economy:{explicit:()=>null}};
 return createLogistics(bot);
}
test('automatic farmer pickup includes ordinary gear and preserves item variants',()=>{
 const log=logisticsFor([
   {name:'sword',level:1},{name:'gem0',level:0,q:5000},
   {name:'cxjar',level:0,data:'makeawish'},
   {name:'cxjar',level:0,data:'another'},
   {name:'hpot0',level:0,q:500},{name:'pickaxe',level:0},
   {name:'sword',level:0,l:'locked'}
 ]);
 assert.equal(log.pickupSlots(),4);
 const summaries=log.summary();
 const jars=summaries.filter(row=>row.item==='cxjar'&&row.to==='Merchant');
 assert.equal(jars.length,2);
 assert.notDeepEqual(jars[0].variant,jars[1].variant);
 assert.equal(summaries.find(row=>row.item==='gem0').surplus,5000);
});
test('explicit keep and active production reservations prevent automatic pickup',()=>{
 const keep={enabled:true,action:'keep',item:'sword',name:'Keep sword',role:'all',
   minLevel:0,maxLevel:99,character:'',map:'',server:'',task:'',statType:'',property:'',title:'',priority:100};
 const items=[{name:'sword',level:0},{name:'gem0',level:0}];
 assert.equal(logisticsFor(items,[keep]).pickupSlots(),1);
 assert.equal(logisticsFor(items,[],item=>item.name==='sword'?1:0).pickupSlots(),1);
});
