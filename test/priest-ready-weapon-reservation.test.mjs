import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationGoalsForUrgentDelivery,pendingDeliveryRuleNeeds}
 from '../src/production/production.mjs';
import {purposeReservations} from '../src/production/purpose-allocation.mjs';

const base=[
 {name:'Gear: Optimiertes Gear My_Priest mainhand',enabled:true,
  item:'staff',level:3,quantity:1,recipient:'My_Priest',gearSlot:'mainhand',
  priority:1000,urgentStarter:true},
 {name:'Gear: Auto-Gear My_Merchant mainhand +3',enabled:true,
  item:'staff',level:3,quantity:1,recipient:'',gearSlot:'mainhand',priority:30},
 {name:'Gear: Another team member',enabled:true,
  item:'staff',level:3,quantity:1,recipient:'My_Mage',gearSlot:'mainhand',priority:20},
 {name:'Elixir My_Priest',enabled:true,item:'elixirint0',level:0,
  quantity:1,recipient:'My_Priest',priority:1100}
];
test('urgent ready Priest +3 delivery excludes only lower-priority reservations',()=>{
 const filtered=reservationGoalsForUrgentDelivery(base,{name:'staff',level:3},'My_Priest');
 assert.deepEqual(filtered.map(g=>g.name),[base[0].name,base[3].name]);
 const res=purposeReservations({G:{items:{staff:{upgrade:true}}},goals:filtered,
   recipient:'My_Priest',recipientItem:{name:'staff',level:3},
   stock:(name,level)=>name==='staff'&&level===3?2:0});
 assert.equal(res.blocked,false);
 assert.equal(res.quantity({name:'staff',level:3}),0);
 const pending=pendingDeliveryRuleNeeds(base,g=>0,'My_Merchant',g=>g.item==='staff'?2:0);
 assert.equal(pending.find(x=>x.recipient==='My_Priest').level,3);
});
test('generic, unrelated, unknown, non urgent or wrongly addressed gear never releases reservations',()=>{
 for(const [item,recipient] of [
  [{name:'staff',level:2},'My_Priest'],
  [{name:'staff',level:3},'My_Mage'],
  [{name:'bow',level:3},'My_Priest']
 ])assert.equal(reservationGoalsForUrgentDelivery(base,item,recipient),base);
 const without=base.map(g=>({...g,urgentStarter:false}));
 assert.equal(reservationGoalsForUrgentDelivery(without,{name:'staff',level:3},'My_Priest'),without);
 assert.equal(reservationGoalsForUrgentDelivery(base,{name:'staff',level:3},''),base);
 const unverified=base.map(g=>({...g}));
 unverified[0].priority=50;
 assert.equal(reservationGoalsForUrgentDelivery(unverified,{name:'staff',level:3},'My_Priest'),unverified);
});

test('an exact verified empty chest claim frees only subordinate coat upgrade reservations',()=>{
 const urgent={name:'Gear: Vorratsausrüstung My_Priest chest',enabled:true,
  item:'coat',level:5,quantity:1,recipient:'My_Priest',
  gearSlot:'chest',priority:975,urgentVacancy:true};
 const subordinate={name:'Gear: Auto-Gear My_Ranger2 chest',enabled:true,
  item:'coat',level:5,quantity:1,recipient:'My_Ranger2',
  gearSlot:'chest',priority:30};
 const rows=[urgent,subordinate];
 const filtered=reservationGoalsForUrgentDelivery(rows,{name:'coat',level:5},'My_Priest');
 assert.deepEqual(filtered,[urgent]);
 assert.equal(reservationGoalsForUrgentDelivery(rows,{name:'coat',level:5},'My_Ranger2'),rows);
 assert.equal(reservationGoalsForUrgentDelivery(rows,{name:'coat',level:4},'My_Priest'),rows);
});
