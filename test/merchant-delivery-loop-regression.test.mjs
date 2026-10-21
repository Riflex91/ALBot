import test from 'node:test';
import assert from 'node:assert/strict';
import {createServicePlan} from '../src/merchant/service-plan.mjs';
import {trackerMerchantKeep,trackerDeliveryNeed} from '../src/items/achievement-utility.mjs';
import {physicalGearAllowanceFromSelectedRule} from '../src/production/production.mjs';

const skull={name:'skullamulet',level:2,stat_type:'',p:'',title:''};
test('finished visit blocks another same-recipient empty trip but admits a different farmer',()=>{
 let time=1000;const events=[];
 const service=createServicePlan({now:()=>time,holdMs:300000,
  event:(type,data)=>events.push({type,data})});
 assert.equal(service.claim('My_Ranger1'),true);
 assert.equal(service.finish('My_Ranger1',{cooldownMs:30000}),true);
 assert.equal(service.claim('My_Ranger1'),false);
 assert.equal(service.claim('My_Ranger2'),true);
 assert.ok(events.some(x=>x.type==='merchant.serviceComplete'));
 time+=31000;
 assert.equal(service.claim('My_Ranger1',true),true,
  'truly urgent supplies may interrupt the bounded lease');
});
test('Tracktrix reserve yields ONLY for a verified farmer deficit',()=>{
 const items=[{name:'tracker',level:0}];
 const needy={name:'My_Ranger1',running:true,rip:false,realm:'EUII',
  achievementCarrier:null,inventoryBlocked:false,journal:false,free:40};
 assert.equal(trackerMerchantKeep(items),1);
 assert.equal(trackerDeliveryNeed(needy,'EUII',{reserve:4}),1);
 assert.equal(trackerMerchantKeep(items,{farmerNeeds:true}),0);
 assert.equal(trackerMerchantKeep(items,{farmerNeeds:false}),1);
 assert.equal(trackerDeliveryNeed({...needy,achievementCarrier:'unknown'},'EUII'),0);
 assert.equal(trackerDeliveryNeed({...needy,achievementCarrier:'supercomputer'},'EUII'),0);
 assert.equal(trackerDeliveryNeed({...needy,realm:'USIV'},'EUII'),0);
});
test('one skullamulet copy is transferable only for the cached authorized gear recipient',()=>{
 const chosen={enabled:true,action:'send',item:'skullamulet',minLevel:2,maxLevel:2,
  recipient:'My_Ranger2',batch:1,_autoGearDelivery:true};
 const stock=[skull];
 const physical=(who,rules=[chosen])=>physicalGearAllowanceFromSelectedRule(
  rules,stock,skull,who);
 assert.equal(physical('My_Ranger1'),0);
 assert.equal(physical('My_Ranger2'),1);
 assert.equal(physical('My_Ranger2',[{...chosen,recipient:'My_Ranger1'}]),0);
 assert.equal(physicalGearAllowanceFromSelectedRule([chosen],stock,skull,
  'My_Ranger2',()=>({action:'keep'})),0);
 assert.equal(physicalGearAllowanceFromSelectedRule([chosen],[{...skull,l:true}],
  skull,'My_Ranger2'),0);
 assert.equal(physicalGearAllowanceFromSelectedRule([{
  ...chosen,_autoExactVariant:'not-the-actual-variant'
 }],stock,skull,'My_Ranger2'),0);
});
