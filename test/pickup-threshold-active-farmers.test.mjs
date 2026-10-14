import test from 'node:test';
import assert from 'node:assert/strict';
import {teamPickupThreshold,createLogistics} from '../src/items/logistics.mjs';

const peer=(name,lootSlots,other={})=>({
 name,running:true,rip:false,realm:'EUII',map:'main',in:'main',
 x:10,y:0,lootSlots,items:[],...other
});
test('one offline selected farmer cannot suppress a ready active pickup',()=>{
 const active=peer('Active',30);
 const result=teamPickupThreshold([active,null], 'EUII',30);
 assert.deepEqual(result,{ready:true,slots:30,trigger:true});
});
test('dead and cross-realm farmers do not dilute active loot or block a trip',()=>{
 const result=teamPickupThreshold([
   peer('Active',16),peer('Second',14),
   peer('Dead',42,{rip:true}),peer('OtherRealm',42,{realm:'USIV'}),
   peer('Stopped',42,{running:false})], 'EUII',30);
 assert.deepEqual(result,{ready:true,slots:30,trigger:true});
});
test('unknown or malformed ACTIVE loot count blocks pickup instead of guessing',()=>{
 for(const count of [-1,43,NaN,1.5,undefined]){
  const result=teamPickupThreshold([peer('Active',30),peer('Unknown',count)],'EUII',30);
  assert.deepEqual(result,{ready:false,slots:0,trigger:false});
 }
});
test('no online same-realm farmer is not a zero-loot successful observation',()=>{
 const result=teamPickupThreshold([null,peer('Offline',42,{running:false})],'EUII',30);
 assert.deepEqual(result,{ready:false,slots:0,trigger:false});
 assert.equal(teamPickupThreshold([],'EUII').ready,false);
});
test('active farmers still respect normal pickup threshold without phantom offline loot',()=>{
 assert.deepEqual(teamPickupThreshold([
  peer('Active',24),peer('Offline',42,{running:false})],'EUII',30),
  {ready:true,slots:24,trigger:false});
});
test('Merchant logistics actually starts a trip for active loot with another selected farmer offline',()=>{
 const inventory=Array(42).fill(null),
  c={name:'Merchant',map:'main',in:'main',x:0,y:0,items:inventory};
 const active=peer('Active',30,{x:700,items:[{item:'mat',
  variant:{name:'mat',level:0,stat_type:'',p:'',title:''},
  to:'Merchant',surplus:30,need:0}]});
 const trips=[],prepares=[];
 const cfg={
  merchant:{enabled:true,pickup:true,supply:false,stand:false,
    minFreeSlots:4,pickupThreshold:30,maxDelivery:3000},
  party:{merchant:'Merchant'},farming:{freeSlots:4,hpBelow:.4,mpBelow:.4},
  general:{messageTtlMs:10000},items:[]
 };
 const bot={
  cfg,p:{c,G:{items:{mat:{type:'material',s:9999}}},realm:()=> 'EUII'},
  me:{name:'Merchant',role:'merchant'},farmers:['Active','Offline'],
  exec:{now:()=>1000,busy:()=>false},
  transport:{peers:new Map([['Active',{}],['Offline',{}]]),
    fresh:name=>name==='Active'?active:null},
  movement:{order:null,stop(){this.order=null;},go(destination,owner){
    trips.push({destination,owner});this.order={owner,dest:destination};return true;
  }},
  merchant:{prepareDeparture:h=>{prepares.push(h.name);return true;},
    claimService:()=>true},
  economy:{rules:()=>null},
  strategy:{canVisit:()=>true},
  services:{active:false,waiting:false},
  gold:{reserved:false},running:true,inventoryBlocked:false,journal:null,
  free:()=>c.items.filter(x=>!x).length,reason:'',rule:()=>null,event:()=>{}
 };
 const logistics=createLogistics(bot);
 logistics.travel();
 assert.equal(logistics.pickupCycle,true,'offline peer must not veto threshold');
 assert.deepEqual(prepares,['Active']);
 assert.deepEqual(trips.map(t=>[t.owner,t.destination.map,t.destination.x]),
  [['logistics','main',700]]);
});
