import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant} from '../src/merchant/controller.mjs';

function setup(){
 const peers=new Map(Object.entries({
  A:{hpot0:50,mpot0:2850},
  B:{hpot0:2900,mpot0:2400},
  C:{hpot0:2200,mpot0:2999}
 }).map(([name,potions])=>[name,{name,running:true,rip:false,realm:'EUII',potions}]));
 const storage=new Map(),owned={hpot0:0,mpot0:0},buys=[],events=[];
 const c={name:'M',items:Array(42).fill(null),gold:1000000,map:'main'};
 const cfg={merchant:{enabled:true,supply:true,potionTeamRefill:true,potionAlertBelow:50,
  hpPotionTarget:3000,mpPotionTarget:3000,minFreeSlots:4,maxDelivery:3000,
  maxSpendPerHour:5000000,pickup:true,bank:false},
  party:{merchant:'M',maxFarmers:3},farming:{potionCarryMax:10000},items:[]};
 const bot={cfg,me:{name:'M',role:'merchant',goldReserve:0},farmers:['A','B','C'],
  running:true,p:{c,G:{items:{hpot0:{g:20},mpot0:{g:20}}},
   realm:()=> 'EUII',read:k=>storage.get(k)??null,
   write:(k,v)=>{storage.set(k,v);return true;}},
  transport:{fresh:n=>peers.get(n)??null},movement:{order:null},
  free:()=>42,inventoryBlocked:false,journal:null,logistics:{reserved:false},
  exec:{pending:new Map(),busy:()=>false},gold:{reserved:false},
  bank:{pending:false,manageStand:()=>false,consolidateInventory:()=>false,
   consolidate:()=>false,consolidateAcross:()=>false,stock:()=>0},
  services:{active:false,waiting:false},
  economy:{count:item=>owned[item.name],safe:item=>!!item,explicit:()=>null,ledger:{spent:0},
   npcBuy:(item,rule,qty,guard)=>{assert.equal(guard(),true);
    assert.ok(qty<=cfg.merchant.maxDelivery);
    buys.push({item:item.name,qty});owned[item.name]+=qty;return true;}},
  event:(type,data)=>events.push({type,data}),reason:''};
 return {bot,peers,storage,owned,buys,events};
}
test('real merchant supply preflight acquires both potion deficits in bounded NPC batches',()=>{
 const {bot,buys,owned,storage,events}=setup();
 const merchant=createMerchant(bot);bot.merchant=merchant;
 assert.equal(merchant.potionSupplyActive(),true);
 assert.deepEqual(storage.get('albot:potion-tour:M').names,['A','B','C']);
 for(let n=0;n<12&&(owned.hpot0<4050||owned.mpot0<951);n++)
  merchant.prepareDeparture({name:'A',items:[]});
 assert.ok(buys.some(x=>x.item==='hpot0'),'buys HP potions');
 assert.ok(buys.some(x=>x.item==='mpot0'),'buys MP potions');
 assert.equal(owned.hpot0,4050,'3850 team HP shortage plus protected 200 merchant reserve');
 assert.equal(owned.mpot0,951,'751 team MP shortage plus protected 200 merchant reserve');
 assert.ok(events.some(x=>x.type==='merchant.potionTeamAlarm'));
});
test('team refill persists after reload and stops buying while any stock report is missing',()=>{
 const {bot,peers,storage}=setup();
 const merchant=createMerchant(bot);bot.merchant=merchant;
 assert.equal(merchant.potionSupplyActive(),true);
 peers.get('A').potions.hpot0=51;
 const reloaded=createMerchant(bot);bot.merchant=reloaded;
 assert.equal(reloaded.potionSupplyActive(),true,'continuation does not require another 50-potion alarm');
 peers.delete('C');assert.equal(reloaded.potionSupplyActive(),false,'no buying against missing farmer count');
 peers.set('C',{name:'C',running:true,realm:'EUII',potions:{hpot0:3000,mpot0:3000}});
 assert.equal(reloaded.potionSupplyActive(),true);
 for(const h of peers.values())h.potions={hpot0:3000,mpot0:3000};
 assert.equal(reloaded.potionSupplyActive(),false);
 assert.equal(storage.get('albot:potion-tour:M'),null);
});
