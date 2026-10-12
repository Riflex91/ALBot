import test from 'node:test';
import assert from 'node:assert/strict';
import {createBank} from '../src/merchant/bank.mjs';
import {createMarket} from '../src/merchant/market.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';

function fixture({inventory=[],bankStandCount=2,bankPartials=false}={}){
 const items=Array(42).fill(null);inventory.forEach((i,n)=>items[n]=i);
 const bank=Array(42).fill(null);
 for(let k=0;k<bankStandCount;k++)bank[k]={name:'stand0',level:0};
 if(bankPartials)bank[10]={name:'mat',level:0,q:9};
 const c={name:'Merchant',map:'bank',in:'bank',x:0,y:-100,items,
  bank:{items0:bank,items1:Array(42).fill(null),gold:0},gold:1000000,slots:{},stand:false};
 const actions=[];
 const bot={
  p:{c,G:{items:{stand0:{stand:true,g:10000},mat:{type:'material',s:100}}},
   read:()=>null,write:()=>true,realm:()=> 'EUII',root:{},parent:{},call:()=>null},
  me:{name:'Merchant',role:'merchant'},running:true,cfg:{
   merchant:{enabled:true,stand:true,bank:true,consolidate:true,minFreeSlots:4,
    taskHoldMs:30000,starvationMs:120000},
   party:{merchant:'Merchant'},items:[],production:{goals:[]}},
  checkpoint:{durable:true},movement:{order:null},
  logistics:{reserved:false},inventoryBlocked:false,journal:null,
  free:()=>items.filter(i=>!i).length,
  exec:{busy:()=>false},
  event:()=>{},reason:'',
  economy:{safe:i=>!!i&&!i.l,spare:(slot,r)=>r?.action==='bank'||r?.action==='sell'?(c.items[slot]?.q??1):0,
   value:()=>200,explicit:()=>null,rules:()=>null,
   npcSell:(slot,r)=>{actions.push(['sell',slot,r.item,r.minPrice]);return true;},
   perform:(kind,d)=>{actions.push([kind,d.details]);return true;},
   travel:()=>true,note:()=>{},count:()=>1,remaining:()=>true},
  transport:{peers:new Map()}
 };
 bot.bank=createBank(bot);
 return {bot,c,actions};
}

test('stand in inventory is a surplus when bank already retains one stand',()=>{
 const {bot,actions}=fixture({inventory:[{name:'stand0',level:0}],bankStandCount:2});
 assert.equal(bot.bank.manageStand(),true);
 assert.deepEqual(actions[0],['sell',0,'stand0',200]);
});
test('stand with no bank copy is stored, not sold, and stand is not opened',()=>{
 const {bot,actions}=fixture({inventory:[{name:'stand0',level:0}],bankStandCount:0});
 assert.equal(bot.bank.manageStand(),true);
 assert.equal(actions[0][0],'bank.store');
 assert.equal(actions.some(x=>x[0]==='sell'),false);
});
test('multiple bank stands withdraw only one duplicate with a checked bank journal',()=>{
 const {bot,actions}=fixture({bankStandCount:2});
 assert.equal(bot.bank.manageStand(),true);
 assert.equal(actions[0][0],'bank.stand.surplus');
 assert.equal(actions[0][1].item,'stand0');
});
test('a single ordinary stand already in bank stays in bank',()=>{
 const {bot,actions}=fixture({bankStandCount:1});
 assert.equal(bot.bank.manageStand(),false);
 assert.deepEqual(actions,[]);
});
test('bank partial stack is retrieved into inventory for exact-variant merge',()=>{
 const {bot,actions}=fixture({inventory:[{name:'mat',level:0,q:13}],bankStandCount:0,
   bankPartials:true});
 assert.equal(bot.bank.consolidateAcross(),true);
 assert.equal(actions[0][0],'bank.merge.retrieve');
 assert.equal(actions[0][1].quantity,9);
});
test('market listing activates the stand only for a valid empty trade slot',()=>{
 const {bot,c,actions}=fixture({bankStandCount:1});
 let calls=0;bot.merchant={activateStand(){calls++;return true;}};
 bot.cfg.merchant.marketHistory=false;bot.cfg.merchant.marketHistoryTtlMs=21600000;
 bot.cfg.general={testLogging:undefined};
 bot.p.entities={};c.items[0]={name:'mat',level:0,q:5};
 bot.economy.spare=()=>5;bot.economy.count=()=>5;
 const market=createMarket(bot);
 const rule={name:'List material',enabled:true,action:'list',item:'mat',
  slot:'trade1',minPrice:30,batch:5,keep:0,teamReserve:0};
 assert.equal(market.listing(0,rule),true);
 assert.equal(calls,1);
 assert.equal(actions.length,0,'no trade without a successfully opened stand');
 assert.equal(market.listing(0,{...rule,slot:'invalid'}),false);
 assert.equal(calls,1,'an invalid order must not withdraw a stand');
});
test('merchant depot accepts ordinary exchangeable materials for storage',()=>{
 const {bot,c,actions}=fixture({inventory:[{name:'mat',level:0,q:12}],bankStandCount:0});
 bot.p.G.items.mat.e=10;bot.economy.rules=()=>({action:'exchange'});
 bot.cfg.production={enabled:true};
 bot.production={reservedQuantity:()=>0,status:()=>({}),mutate:()=>false};
 bot.services={active:false,waiting:false,restore:()=>false};
 bot.transport={fresh:()=>({running:true,realm:'EUII',potions:{hpot0:3000,mpot0:3000}})};
 bot.farmers=['Farmer'];
 const m=createMerchant(bot);
 assert.equal(m.prepareDeparture({name:'Farmer',items:[]}),false);
 assert.equal(m.status().departure.phase,'materials');
 assert.equal(m.prepareDeparture({name:'Farmer',items:[]}),false);
 assert.equal(actions.some(x=>x[0]==='bank.store'),true);
});
