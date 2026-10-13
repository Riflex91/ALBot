import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalReceiveCapacity,createLogistics} from '../src/items/logistics.mjs';
import {Executor} from '../src/core/executor.mjs';
import {chooseRule} from '../src/core/policy.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';

const meta={s:9999,type:'pot'};
const potion={name:'hpot1',level:0,stat_type:'',p:'',title:''};
test('a 9,998/9,999 potion stack with no empty slot admits one, never three',()=>{
 const inventory=[{...potion,q:9998},...Array.from({length:41},()=>({name:'other'}))];
 assert.equal(physicalReceiveCapacity(inventory,potion,meta),1);
 assert.equal(physicalReceiveCapacity(inventory,potion,meta,{maxNewSlots:0}),1);
 inventory[0].q=9999;
 assert.equal(physicalReceiveCapacity(inventory,potion,meta),0);
});
test('physical receive requires exact variants and a real free slot for nonstackables',()=>{
 const inventory=[{...potion,q:40,stat_type:'dex'},...Array(40).fill({name:'other'}),null];
 assert.equal(physicalReceiveCapacity(inventory,potion,meta,{maxNewSlots:0}),0);
 assert.equal(physicalReceiveCapacity(inventory,potion,meta),9999);
 assert.equal(physicalReceiveCapacity(inventory,{name:'ring',level:1},{type:'ring'}),1);
 assert.equal(physicalReceiveCapacity(inventory,{name:'ring',level:1},null),0);
});
test('physical receive never merges protected or invalid stacks',()=>{
 const inventory=[{...potion,q:40,l:true},...Array(41).fill({name:'other'})];
 assert.equal(physicalReceiveCapacity(inventory,potion,meta),0);
 inventory[0]={...potion,q:10001};
 assert.equal(physicalReceiveCapacity(inventory,potion,meta),0);
});
function merchantReceiver(){
 const messages=[];
 const c={name:'Merchant',map:'main',in:'main',x:0,y:0,items:[
  {...potion,q:9998},...Array(41).fill({name:'other'})]};
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema);
 cfg.merchant.enabled=true;cfg.merchant.pickup=true;
 cfg.merchant.maxDelivery=3000;cfg.merchant.minFreeSlots=4;
 const bot={cfg,me:{name:'Merchant',role:'merchant'},session:'Merchant',
  running:true,inventoryBlocked:false,journal:null,
  p:{c,G:{items:{hpot1:meta}},realm:()=> 'EUII'},
  free:()=>c.items.filter(x=>!x).length,
  entity:n=>n==='Farmer'?{name:n,map:'main',in:'main',x:10,y:0}:null,
  rule:()=>null,reason:'',
  beginValue(j){assert.equal(this.journal,null);this.journal=j;},
  endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;},
  event:()=>{},checkpoint:{durable:true},exec:{now:()=>Date.now(),busy:()=>false},
  movement:{stop(){}},merchant:{status:()=>({capacityRecovery:true})},
  transport:{fresh:()=>({name:'Farmer',running:true,rip:false,realm:'EUII',
   map:'main',in:'main',x:10,y:0,session:'Farmer'}),
   send:(to,type,data,id)=>messages.push({to,type,data,id})}};
 bot.logistics=createLogistics(bot);
 return {bot,c,messages,offer(){bot.logistics.receive('Farmer',{type:'offer',
  session:'Farmer',id:'offer-1',data:{item:potion,quantity:3}});}};
}
test('full Merchant acknowledges only exact physical remaining stack capacity',()=>{
 const f=merchantReceiver();
 f.offer();
 assert.equal(f.bot.journal?.kind,'receive');
 assert.equal(f.bot.journal?.quantity,1);
 assert.equal(f.messages[0]?.type,'accept');
 assert.equal(f.messages[0]?.data.quantity,1);
 assert.equal(f.c.items[0].q,9998,'an acknowledgement is not an item delta');
});
test('full Merchant with incompatible inventory refuses loot without a journal',()=>{
 const f=merchantReceiver();f.c.items[0]={name:'ringsj',level:0};
 f.offer();
 assert.equal(f.bot.journal,null);
 assert.equal(f.messages.some(m=>m.type==='accept'),false);
 assert.equal(f.c.items.filter(x=>!x).length,0);
});
