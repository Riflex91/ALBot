import test from 'node:test';
import assert from 'node:assert/strict';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {createGear} from '../src/production/gear.mjs';
import {pendingDeliveryRuleNeeds,physicalGearAllowanceFromSelectedRule} from '../src/production/production.mjs';
import {createGearAllocation} from '../src/production/allocation.mjs';

const slots=['mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
function gearProof(mainhand={name:'staff',level:3},amulet=null){
 return {class:'priest',level:52,session:'priest-live',realm:'EUII',at:Date.now(),
  complete:true,slots:Object.fromEntries(slots.map(k=>[k,k==='mainhand'?mainhand:
   k==='amulet'?amulet:null]))};
}
test('gear proof is retained when oversized telemetry and 15-slot snapshots force heartbeat trimming',()=>{
 const gear=gearProof();
 const msg={name:'My_Priest',realm:'EUII',running:true,items:[{item:'seashell',need:0}],
  materials:[],gear,performance:'x'.repeat(2200),stock:'y'.repeat(900),
  skills:'z'.repeat(900),itemTransferEvidence:'q'.repeat(500)};
 const compressed=fitHeartbeat(msg);
 assert.ok(compressed,'ordinary full gear evidence must be deliverable');
 assert.deepEqual(compressed.gear,gear,'allocation.offer must receive full current-session gear');
 assert.equal(compressed.gear.slots.mainhand.level,3);
 assert.deepEqual(Object.keys(compressed.gear.slots).sort(),[...slots].sort());
 assert.ok(JSON.stringify(compressed).length<=4200);
});
test('impossibly oversized security-critical gear refuses status instead of implying safe vacant slots',()=>{
 const msg={name:'My_Priest',realm:'EUII',items:[],materials:[],gear:gearProof()};
 msg.gear.session='s'.repeat(5500);
 assert.equal(fitHeartbeat(msg),null);
});
function gearFixture({
 held=[{name:'staff',level:5}],current={name:'staff',level:3},
 explicit=()=>null,peer=true,session='priest-live',age=0,optimizer=true
}={}){
 const profile=gearProof(current);profile.at-=age;
 const cfg={production:{gear:true,offlineProfiles:true,gearTargets:[],autoGear:false,
  autoGearBudget:100000,autoGearMaxLevel:5,minImprovement:.05},
  characters:[{name:'My_Priest',class:'priest',role:'farmer',enabled:true,gearRole:'auto'}],
  party:{selection:'adaptive'}};
 const p={realm:()=> 'EUII',c:{name:'My_Merchant',ctype:'merchant',level:58,slots:{},items:held},
  G:{items:{staff:{type:'weapon',wtype:'staff',upgrade:true,level:1},
      skullamulet:{type:'amulet',upgrade:true,level:1}},
     classes:{priest:{mainhand:{staff:true}},merchant:{mainhand:{staff:true}}}},
  read:()=>({'My_Priest':profile}),
  call:(kind,item)=>{assert.equal(kind,'item_properties');
   return {attack:10+15*(item?.level??0),int:5+7*(item?.level??0),hp:10};}};
 const bot={p,cfg,me:{name:'My_Merchant',role:'merchant'},session:'merchant-live',
   farmers:['My_Priest'],teamNames:['My_Merchant','My_Priest'],
   economy:{safe:i=>!!i&&!i.l&&!i.b,explicit},
   transport:{fresh:()=>peer?{name:'My_Priest',running:true,rip:false,
     realm:'EUII',session}:null},
   intelligence:{targets:()=>optimizer?[{name:'Optimiertes Gear My_Priest mainhand',
     character:'My_Priest',slot:'mainhand',item:'staff',level:4,
     enabled:true,priority:31,budget:100000}]:[]}};
 return {gear:createGear(bot),profile,p,bot};
}
test('staff +5 already owned by Merchant supersedes priest +4 production while priest wears +3',()=>{
 const {gear}=gearFixture();
 const goals=gear.goals();
 const handoff=goals.filter(x=>x.recipient==='My_Priest'&&x.gearSlot==='mainhand');
 assert.equal(handoff.length,1);
 assert.equal(handoff[0].item,'staff');
 assert.equal(handoff[0].level,5);
 assert.ok(handoff[0].urgentStockUpgrade);
 assert.ok(handoff[0].priority>=900);
 assert.equal(gear.status().find(x=>x.name==='Vorratsupgrade My_Priest mainhand')?.state,'requested');
 const available=()=>1;
 assert.deepEqual(pendingDeliveryRuleNeeds(handoff,()=>0,'My_Merchant',available)
  .map(x=>x.recipient),['My_Priest']);
});
test('protected, explicitly kept, stale, wrong-session and no-improvement stock cannot be dispatched',()=>{
 for(const opts of [
  {held:[{name:'staff',level:5,l:true}]},
  {held:[{name:'staff',level:5,b:true}]},
  {explicit:()=>({action:'keep'})},
  {explicit:()=>({action:'bank'})},
  {peer:false},{session:'other-live'},{age:121000},
  {held:[{name:'staff',level:3}]}
 ]){
  const {gear}=gearFixture(opts);
  assert.ok(!gear.goals().some(g=>g.urgentStockUpgrade),
   'no stock upgrade for '+JSON.stringify(opts.held??opts));
 }
});
test('physical skullamulet +2 send remains one reserved copy and one selected farmer',()=>{
 const item={name:'skullamulet',level:2};
 const rule={enabled:true,action:'send',_autoGearDelivery:true,
  recipient:'My_Ranger2',item:'skullamulet',minLevel:2,maxLevel:2,batch:1};
 assert.equal(physicalGearAllowanceFromSelectedRule([rule],[item],item,'My_Ranger2'),1);
 assert.equal(physicalGearAllowanceFromSelectedRule([rule],[item],item,'My_Ranger1'),0);
 assert.equal(physicalGearAllowanceFromSelectedRule([rule],[{...item,l:true}],item,'My_Ranger2'),0);
});

test('skullamulet +2 sender allocation can construct a session-bound offer after heartbeat trimming',()=>{
 const item={name:'skullamulet',level:2};
 const original={name:'My_Ranger2',realm:'EUII',running:true,rip:false,
  items:[],materials:[],gear:{...gearProof(),class:'ranger',session:'ranger2-session'},
  performance:'p'.repeat(2200),stock:'s'.repeat(1700)};
 const compact=fitHeartbeat(original),peer={...compact,session:'ranger2-session'};
 assert.ok(compact?.gear,'gear required for item allocation');
 const bot={me:{name:'My_Merchant'},session:'merchant-session',
  cfg:{general:{messageTtlMs:10000},party:{merchant:'My_Merchant'}},
  p:{c:{items:[item]},realm:()=> 'EUII',read:()=>null},
  gear:{goals:()=>[{name:'Gear for Ranger2',recipient:'My_Ranger2',
    item:'skullamulet',level:2,gearSlot:'amulet',quantity:1}]},
  transport:{fresh:()=>peer}};
 const alloc=createGearAllocation(bot),offer=alloc.offer(item,'My_Ranger2');
 assert.equal(offer?.slot,'amulet');
 assert.equal(offer?.goal,'Gear for Ranger2');
 assert.ok(typeof offer?.expected==='string');
 delete peer.gear;
 assert.equal(alloc.offer(item,'My_Ranger2'),false,
  'no full gear proof must remain a hard refusal');
});
