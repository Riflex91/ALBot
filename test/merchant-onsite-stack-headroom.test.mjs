import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogistics} from '../src/items/logistics.mjs';

function fixture({item={name:'mat',level:0,q:9998},
 offerItem={name:'mat',level:0,stat_type:'',p:'',title:''},
 offerQuantity=1,known=true,free=0,merchantReserve=4}={}){
 const contents=Array.from({length:42},(_,i)=>i===0?item:
   i<=free?null:{name:'other',level:0,q:1});
 const c={name:'Merchant',map:'main',in:'main',x:0,y:0,items:contents};
 const peer={name:'Farmer',map:'main',in:'main',x:30,y:0,
  running:true,rip:false,realm:'EUII',lootSlots:1,
  items:[{item:offerItem.name,variant:offerItem,to:'Merchant',
    surplus:offerQuantity,need:0}]};
 const counters={prepares:0,claims:0,moves:0};
 const cfg={general:{messageTtlMs:10000},farming:{
   hpBelow:.4,mpBelow:.4,freeSlots:4},
  merchant:{enabled:true,pickup:true,supply:false,stand:false,
   minFreeSlots:merchantReserve,pickupThreshold:1,maxDelivery:3000,
   servicePositionError:70},party:{merchant:'Merchant'},items:[]};
 const bot={p:{c,G:{items:known?{mat:{type:'material',s:9999}}:{}},
     realm:()=> 'EUII'},
   me:{name:'Merchant',role:'merchant'},cfg,farmers:['Farmer'],
   running:true,inventoryBlocked:false,journal:null,
   free:()=>c.items.filter(x=>!x).length,
   exec:{now:()=>1000,busy:()=>false},
   transport:{peers:new Map([['Farmer',{}]]),
     fresh:name=>name==='Farmer'?peer:null},
   rule:()=>null,reason:'',event:()=>{},
   strategy:{canVisit:()=>true},
   movement:{order:null,stop(){this.order=null;},
     go(){counters.moves++;return true;}},
   services:{active:false,waiting:false},
   gold:{reserved:false},economy:{rules:()=>null},
   merchant:{prepareDeparture(){counters.prepares++;return true;},
     claimService(){counters.claims++;return true;}}};
 bot.logistics=createLogistics(bot);
 return {bot,c,peer,counters};
}
test('zero empty slots but genuine matching headroom maintain bounded on-site pickup',()=>{
 const f=fixture();
 assert.equal(f.bot.free(),0);
 f.bot.logistics.travel();
 assert.equal(f.bot.logistics.pickupOnSite(),true);
 assert.equal(f.counters.prepares,1);
 f.bot.logistics.travel();
 assert.equal(f.counters.prepares,1,'on-site lease must not restart pickup planning');
 assert.equal(f.counters.moves,0);
});
test('an acknowledged stack becoming full revokes on-site pickup lease without a new slot',()=>{
 const f=fixture();
 f.bot.logistics.travel();
 assert.equal(f.bot.logistics.pickupOnSite(),true);
 f.c.items[0].q=9999;
 assert.equal(f.bot.logistics.pickupOnSite(),false);
 f.bot.logistics.travel();
 assert.equal(f.bot.logistics.pickupOnSite(),false);
});
test('locked, incompatible or unknown item variants never extend zero-slot pickup lease',()=>{
 const cases=[
  {name:'locked',item:{name:'mat',level:0,q:9998,l:'locked'}},
  {name:'different level',item:{name:'mat',level:1,q:9998}},
  {name:'different stat',item:{name:'mat',level:0,q:9998,stat_type:'int'}},
  {name:'different accession',item:{name:'mat',level:0,q:9998,acc:'A'}},
  {name:'different rid',item:{name:'mat',level:0,q:9998,rid:'B'}},
  {name:'different data',item:{name:'mat',level:0,q:9998,data:{tier:2}}},
  {name:'unknown game definition',known:false},
  {name:'non-positive advertised quantity',offerQuantity:0}
 ];
 for(const x of cases){
  const f=fixture(x);
  f.bot.logistics.travel();
  assert.equal(f.bot.logistics.pickupOnSite(),false,x.name);
 }
});
test('a valid nearby pickup lease ends as soon as farmer no longer has a fresh offer',()=>{
 const f=fixture();
 f.bot.logistics.travel();
 assert.equal(f.bot.logistics.pickupOnSite(),true);
 f.peer.items=[];
 assert.equal(f.bot.logistics.pickupOnSite(),false,
   'empty new heartbeat cannot prolong a zero-slot compatible-stack lease');
});
test('ordinary five-empty-slot on-site pickup remains unchanged for new item variants',()=>{
 const f=fixture({free:5,item:{name:'other',q:1}});
 assert.equal(f.bot.free(),5);
 f.bot.logistics.travel();
 assert.equal(f.bot.logistics.pickupOnSite(),true);
 assert.equal(f.counters.moves,0);
});
