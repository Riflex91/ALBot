import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticOperatingStockRule,operatingStockFloor,bankOperatingStockRule} from '../src/items/operating-stock.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
const fixture=()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.production.enabled=true;
 cfg.production.autoDisposition=true;cfg.merchant.enabled=true;
 cfg.merchant.preventiveStorage=true;
 const c={items:[{name:'scroll0',q:300}],gold:100000,slots:{},map:'main',x:0,y:0};
 const bot={cfg,p:{c,G:{items:{scroll0:{type:'uscroll',g:1000}},skills:{}},
  realm:()=>'EUI',read:()=>null,write:()=>true,call:()=>100},
  me:{name:'M',role:'merchant'},farmers:['A','B','C'],task:()=> 'supply',
  production:{reservedQuantity:()=>10}};
 bot.economy=createEconomy(bot);
 bot.economy.npcFor=()=>({map:'main',x:0,y:0});
 return bot;
};
test('working reserve covers all farmers and preserves non-replaceable supplies',()=>{
 const bot=fixture();
 assert.equal(operatingStockFloor('hpot1',bot.cfg,3),9000);
 assert.equal(operatingStockFloor('mpot1',bot.cfg,3),900);
 assert.equal(operatingStockFloor('scroll2',bot.cfg,3),null);
 assert.equal(operatingStockFloor('cryptkey',bot.cfg,3),null);
 const rule=automaticOperatingStockRule(bot,bot.p.c.items[0]);
 assert.equal(rule.keep,100);assert.equal(rule.batch,190);
});
test('explicit keep, variants, gold price and active reservations block automatic sale',()=>{
 const bot=fixture(),item=bot.p.c.items[0];
 const base=defaultsFor(FULL_DESCRIPTOR.schema.properties.items.items);
 bot.cfg.items=[{...base,item:'scroll0',action:'keep',enabled:true}];
 assert.equal(automaticOperatingStockRule(bot,item),null);
 bot.cfg.items=[];
 for(const extra of [{l:true},{b:true},{p:'lucky'},{stat_type:'str'},{expires:100}])
  assert.equal(automaticOperatingStockRule(bot,{...item,...extra}),null);
 bot.production.reservedQuantity=()=>201;
 assert.equal(automaticOperatingStockRule(bot,item),null);
 bot.production.reservedQuantity=()=>0;bot.p.G.items.scroll0.cash=true;
 assert.equal(automaticOperatingStockRule(bot,item),null);
});
test('dispatch recalculates quantity, configuration and reservation instead of trusting derived sale',()=>{
 const bot=fixture(),item=bot.p.c.items[0],rule=automaticOperatingStockRule(bot,item);
 assert.equal(bot.economy.spare(0,rule),190);
 bot.production.reservedQuantity=()=>199;assert.equal(bot.economy.spare(0,rule),1);
 bot.production.reservedQuantity=()=>200;assert.equal(bot.economy.spare(0,rule),0);
 bot.production.reservedQuantity=()=>0;bot.cfg.merchant.preventiveStorage=false;
 assert.equal(bot.economy.spare(0,rule),0);
});

test('bank operating-stock sale only uses a physical carried floor, including after withdrawal',()=>{
 const bot=fixture(),bankItem={name:'scroll0',q:20};
 bot.p.c.items[0].q=110;
 assert.equal(bankOperatingStockRule(bot,bankItem).batch,20);
 bot.p.c.items[0].q=109;
 assert.equal(bankOperatingStockRule(bot,bankItem),null);
 bot.p.c.items.push(bankItem); // Retrieved stack cannot back its OWN reserve.
 assert.equal(bankOperatingStockRule(bot,bankItem,{carried:true}),null);
 bot.p.c.items[0].q=110;
 const rule=bankOperatingStockRule(bot,bankItem,{carried:true});
 assert.equal(bot.economy.spare(1,rule),20);
 bot.production.reservedQuantity=()=>11;
 assert.equal(bot.economy.spare(1,rule),0);
});
test('explicit bounded bank rule keeps maximum, reserve and user batch; revocation stops the final sale',()=>{
 const bot=fixture(),item={name:'scroll0',q:20};
 const base=defaultsFor(FULL_DESCRIPTOR.schema.properties.items.items);
 bot.cfg.items=[{...base,item:'scroll0',enabled:true,action:'keep',excessAction:'sell',
  keep:20,teamReserve:10,maxCount:150,batch:20}];
 bot.p.c.items[0].q=150;
 const r=bankOperatingStockRule(bot,item);assert.equal(r.batch,20);
 bot.p.c.items.push(item);assert.equal(bot.economy.spare(1,r),20);
 bot.cfg.items[0].excessAction='hold';assert.equal(bot.economy.spare(1,r),0);
 bot.cfg.items[0].excessAction='sell';bot.cfg.items[0].batch=19;
 assert.equal(bankOperatingStockRule(bot,item,{carried:true}),null);
});
