import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogistics} from '../src/items/logistics.mjs';

function receiver({free=8,storageReserve=8,merchantMin=4,
  recovery=false,stack=false,offered='loot',quantity=1}={}){
 const inventory=Array.from({length:42},(_,n)=>n<42-free?
   {name:'kept'+n,level:0}:null);
 if(stack)inventory[0]={name:'loot',level:0,q:2};
 const item={name:offered,level:0,stat_type:'',p:'',title:''};
 const c={name:'Merchant',map:'main',in:'main',x:0,y:0,items:inventory};
 const messages=[],events=[];
 const bot={
  me:{name:'Merchant',role:'merchant'},session:'m1',
  cfg:{general:{messageTtlMs:10000},merchant:{enabled:true,pickup:true,
   maxDelivery:3000,minFreeSlots:merchantMin},farming:{freeSlots:4},items:[],
   party:{merchant:'Merchant'}},
  p:{c,G:{items:{loot:{type:'material',s:stack?100:false}}},
   realm:()=> 'USV'},
  running:true,journal:null,inventoryBlocked:false,
  free:()=>c.items.filter(x=>!x).length,
  rule:()=>null,economy:{safe:()=>true},
  entity:n=>n==='Ranger'?{name:'Ranger',map:'main',in:'main',x:30,y:0}:null,
  storage:{receiveNewSlots:()=>Math.max(0,c.items.filter(x=>!x).length-storageReserve)},
  merchant:{status:()=>({capacityRecovery:recovery})},
  movement:{stop(){}},event:(type,details)=>events.push({type,details}),
  checkpoint:{durable:true},exec:{now:()=>1000,pending:new Map(),busy:()=>false},
  transport:{fresh:()=>({name:'Ranger',session:'r1',running:true,
   rip:false,realm:'USV',map:'main',in:'main',x:30,y:0}),
   send:(to,type,data,id)=>{messages.push({to,type,data,id});return true;}},
  beginValue(j){assert.equal(this.journal,null);this.journal=j;},
  endValue(){}
 };
 bot.logistics=createLogistics(bot);
 return {bot,c,events,messages,offer(){
  bot.logistics.receive('Ranger',{type:'offer',id:'r1:1',session:'r1',
   data:{item,quantity}});
 }};
}
test('Merchant with 8 free and 8-slot preventive reserve accepts one verified loot stack',()=>{
 const f=receiver();
 assert.equal(f.bot.storage.receiveNewSlots(),0,
  'old code blocked all new variant pickups at exactly eight free slots');
 f.offer();
 assert.equal(f.bot.journal?.kind,'receive');
 assert.equal(f.bot.journal?.quantity,1);
 assert.equal(f.messages[0]?.type,'accept');
 assert.equal(f.messages[0]?.data.quantity,1);
 assert.equal(f.bot.free(),8,'an acknowledgement cannot synthesize a received item');
});
test('four free working slots remain protected against new incoming variant',()=>{
 const f=receiver({free:4});
 f.offer();
 assert.equal(f.bot.journal,null);
 assert.equal(f.messages.some(x=>x.type==='accept'),false);
 assert.equal(f.events[0]?.type,'logistics.receiveCapacity');
});
test('active capacity-recovery still blocks new slots above the minimum',()=>{
 const f=receiver({free:8,recovery:true});
 f.offer();
 assert.equal(f.bot.journal,null);
 assert.equal(f.messages.some(x=>x.type==='accept'),false);
});
test('true compatible stack headroom is accepted even at the hard working reserve',()=>{
 const f=receiver({free:4,stack:true,quantity:3});
 f.offer();
 assert.equal(f.bot.journal?.kind,'receive');
 assert.equal(f.bot.journal?.quantity,3);
 assert.equal(f.bot.free(),4);
});
test('unknown incoming item cannot bypass the validated game definition',()=>{
 const f=receiver({offered:'unverified_item'});
 f.offer();
 assert.equal(f.bot.journal,null);
 assert.equal(f.messages.length,0);
});
test('below or at customized Merchant minimum does not admit a new variant',()=>{
 for(const free of [5,6]){
  const f=receiver({free,merchantMin:6,storageReserve:8});
  f.offer();
  assert.equal(f.bot.journal,null);
 }
 const safe=receiver({free:7,merchantMin:6,storageReserve:8});
 safe.offer();
 assert.equal(safe.bot.journal?.kind,'receive');
});
