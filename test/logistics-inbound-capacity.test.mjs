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
function pair(){
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema);
 cfg.merchant.enabled=true;cfg.merchant.pickup=true;cfg.merchant.maxDelivery=3000;
 const rule=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 cfg.items=[{...rule,name:'Testloot',enabled:true,action:'send',item:'hpot1',
  recipient:'Merchant',role:'farmer',batch:3,keep:0,teamReserve:0}];
 const bots={};let sends=0;
 for(const [name,role] of [['Merchant','merchant'],['Farmer','farmer']]){
  const c={name,map:'main',in:'main',x:0,y:0,
   items:name==='Merchant'?[{...potion,q:9998},...Array(41).fill({name:'other'})]:
    [{...potion,q:4},...Array(41).fill(null)]};
  const bot={cfg,me:{name,role},session:name,running:true,inventoryBlocked:false,
   journal:null,p:{c,G:{items:{hpot1:meta}},realm:()=> 'EUII'},
   free:()=>c.items.filter(x=>!x).length,entity:n=>bots[n]?.p.c,
   rule:i=>chooseRule(cfg.items,i,{character:name,role}),
   beginValue(v){assert.equal(this.journal,null);this.journal=v;},
   endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;},
   event:()=>{}};
  bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:4,onError(){}});
  bot.transport={fresh:n=>({name:n,running:true,rip:false,realm:'EUII',
   map:'main',in:'main',x:0,y:0,session:n,items:[]}),
   send(to,type,data,id){bots[to].logistics.receive(name,{type,data,id,session:name});return Promise.resolve(true);}};
  bot.p.call=(fn,to,slot,quantity)=>{
   assert.equal(fn,'send_item');sends++;
   const i=c.items[slot];c.items[slot]=i.q===quantity?null:{...i,q:i.q-quantity};
   const dest=bots[to].p.c.items[0];dest.q+=quantity;
   return Promise.resolve({success:true});
  };
  bots[name]=bot;bot.logistics=createLogistics(bot);
 }
 bots.Merchant.merchant={status:()=>({capacityRecovery:true})};
 return {...bots,sends:()=>sends};
}
test('merchant at 42/42 only acknowledges quantity that fits an existing stack',()=>{
 const f=pair();
 f.Farmer.logistics.poll();
 assert.equal(f.Merchant.journal?.quantity,1);
 f.Farmer.logistics.poll();
 assert.equal(f.sends(),1);
 assert.equal(f.Merchant.p.c.items[0].q,9999);
 assert.equal(f.Farmer.p.c.items[0].q,3);
});
test('merchant at 42/42 with no compatible stack refuses new loot before any value journal',()=>{
 const f=pair();f.Merchant.p.c.items[0]={name:'ringsj',level:0};
 f.Farmer.logistics.poll();
 assert.equal(f.Merchant.journal,null);
 assert.equal(f.Farmer.logistics.stats().offersSent,1);
 assert.equal(f.Farmer.logistics.stats().sendsStarted,0);
 f.Farmer.logistics.poll();
 assert.equal(f.sends(),0);
});
