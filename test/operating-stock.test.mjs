import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticOperatingStockRule,operatingStockFloor,bankOperatingStockRule,bankOperatingReserveNeed,operatingReserveCohort,verifiedAvailableOperatingStockQuantity} from '../src/items/operating-stock.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
const fixture=()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.production.enabled=true;
 cfg.production.autoDisposition=true;cfg.merchant.enabled=true;
 cfg.merchant.preventiveStorage=true;
 const c={items:[{name:'scroll0',q:300}],gold:100000,slots:{},map:'main',x:0,y:0};
 const bot={cfg,p:{c,G:{items:{scroll0:{type:'uscroll',g:1000,s:9999}},skills:{}},
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


test('W02 configured active offline farmers remain in physical potion reserve',()=>{
 const bot=fixture();bot.farmers=['A'];
 bot.cfg.characters=[
  {name:'A',enabled:true,role:'farmer'},
  {name:'B',enabled:true,role:'farmer'},
  {name:'C',enabled:true,role:'farmer'},
  {name:'M',enabled:true,role:'merchant'},
  {name:'Disabled',enabled:false,role:'farmer'}];
 bot.p.G.items.hpot1={type:'pot',g:100,s:9999};
 bot.p.c.items=[{name:'hpot1',level:0,q:9999},
  {name:'hpot1',level:0,q:1}];
 const item=bot.p.c.items[0];
 assert.equal(operatingReserveCohort(bot),3);
 const rule=automaticOperatingStockRule(bot,item);
 assert.equal(rule?.keep,9000);
 assert.equal(rule?.batch,990,'gross production reservation remains protected');
 assert.equal(bot.economy.spare(0,rule),990);
 bot.cfg.characters[2].enabled=false;
 assert.equal(operatingReserveCohort(bot),2);
 assert.equal(bot.economy.spare(0,rule),0,'late changed roster invalidates earlier auto sell');
 const current=automaticOperatingStockRule(bot,item);
 assert.equal(current.keep,6000);
 bot.cfg.characters[2].enabled=true;
 assert.equal(bot.economy.spare(0,current),0,'adding an account reserve revokes a queued smaller-floor sale');
});
test('W02 bank staged stock cannot borrow missing active offline roster reserves',()=>{
 const bot=fixture();bot.farmers=['A'];
 bot.cfg.characters=['A','B','C'].map(name=>({name,role:'farmer',enabled:true}));
 bot.p.G.items.hpot1={type:'pot',g:100,s:9999};
 const bank={name:'hpot1',level:0,q:20};
 bot.p.c.items=[{name:'hpot1',level:0,q:6500}];
 assert.equal(bankOperatingStockRule(bot,bank),null,'bank surplus cannot cover a missing floor');
 assert.deepEqual(bankOperatingReserveNeed(bot,bank),{floor:9010,held:6500,missing:2510});
 bot.p.c.items[0].q=9010;
 assert.equal(bankOperatingReserveNeed(bot,bank),null);
 assert.equal(bankOperatingStockRule(bot,bank)?.keep,9000);
});
test('W02 invalid or oversized configured roster denies autogenerated stock disposal',()=>{
 const bot=fixture();bot.farmers=['A'];
 bot.p.G.items.hpot1={type:'pot',g:100,s:9999};
 bot.p.c.items=[{name:'hpot1',q:50000}];
 const original=bot.cfg.characters;
 for(const rows of [Array(129).fill({name:'A',role:'farmer',enabled:true}),
  [{name:'A',role:'farmer',enabled:'yes'}],null]){
  bot.cfg.characters=rows;
  if(rows===null){
   assert.equal(operatingReserveCohort(bot),1,'legacy fixture without roster uses existing selected farmer count');
  }else{
   assert.equal(operatingReserveCohort(bot),null);
   assert.equal(automaticOperatingStockRule(bot,bot.p.c.items[0]),null);
  }
 }
 bot.cfg.characters=original;
});
test('W02 disabled alternative or Merchant never inflates farmer reserve',()=>{
 const bot=fixture();bot.farmers=['A','A'];
 bot.cfg.characters=[
  {name:'A',enabled:true,role:'farmer'},
  {name:'M',enabled:true,role:'merchant'},
  {name:'B',enabled:false,role:'farmer'}];
 assert.equal(operatingReserveCohort(bot),1);
 bot.cfg.characters[2].enabled=true;
 assert.equal(operatingReserveCohort(bot),2);
});


test('W04 explicit null quantity never represents one bank reserve or surplus unit',()=>{
 const bot=fixture(),item={name:'scroll0',q:null};
 bot.p.c.items[0].q=110;
 assert.equal(bankOperatingReserveNeed(bot,item),null);
 assert.equal(bankOperatingStockRule(bot,item),null);
 // Missing q remains the ordinary single-unit source form.
 assert.equal(bankOperatingStockRule(bot,{name:'scroll0'})?.batch,1);
});

test('W02 operating disposal refuses phantom, overstacked and null local stock',()=>{
 const bot=fixture(),item=bot.p.c.items[0];
 assert.equal(automaticOperatingStockRule(bot,item)?.batch,190);
 for(const q of [null,0,-1,1.5,Infinity,10000,Number.MAX_SAFE_INTEGER]){
  item.q=q;
  assert.equal(automaticOperatingStockRule(bot,item),null,
   'invalid local physical quantity '+String(q));
 }
 item.q=300;
 bot.p.c.items.push({name:'scroll0',q:null});
 assert.equal(automaticOperatingStockRule(bot,item),null,
  'invalid matching variant cannot supplement the reserve');
 bot.p.c.items[1].q=2;
 assert.equal(automaticOperatingStockRule(bot,item)?.batch,192);
});

test('W04 explicit bank stock and staging are bounded by game-defined stack limit',()=>{
 const bot=fixture(),bank={name:'scroll0',q:20};
 bot.p.G.items.scroll0.s=99;
 bot.p.c.items=[{name:'scroll0',q:99},{name:'scroll0',q:11}];
 assert.equal(bankOperatingStockRule(bot,bank)?.batch,20);
 assert.equal(bankOperatingReserveNeed(bot,bank),null);
 bot.p.c.items[0].q=100;
 assert.equal(bankOperatingStockRule(bot,bank),null,
  'oversized carried stack cannot cover a bank sale');
 assert.equal(bankOperatingReserveNeed(bot,bank),null,
  'phantom carried reserve is not a physical staging need');
 bot.p.c.items[0].q=49;bot.p.c.items[1].q=11;
 assert.deepEqual(bankOperatingReserveNeed(bot,bank),
  {floor:110,held:60,missing:50});
 bank.q=100;
 assert.equal(bankOperatingStockRule(bot,bank),null);
 assert.equal(bankOperatingReserveNeed(bot,bank),null,
  'oversized bank source is not a real withdrawable stack');
});

test('W04 malformed reserve variants never silently fund an NPC sale or staged retrieval',()=>{
 const bot=fixture(),bank={name:'scroll0',q:20};
 bot.p.c.items=[{name:'scroll0',q:50},{name:'scroll0',q:60}];
 for(const bad of [null,0,2.5,10000]){
  bot.p.c.items[1].q=bad;
  assert.equal(bankOperatingStockRule(bot,bank),null);
  assert.equal(bankOperatingReserveNeed(bot,bank),null);
 }
 bot.p.c.items[1].q=60;
 assert.equal(bankOperatingStockRule(bot,bank)?.batch,20);
 for(const bad of [null,0,2.5,10000]){
  bank.q=bad;
  assert.equal(bankOperatingStockRule(bot,bank),null);
  assert.equal(bankOperatingReserveNeed(bot,bank),null);
 }
});

test('W04 nonstackable plain material cannot pretend to be a bank multi-copy stack',()=>{
 const bot=fixture();
 bot.p.G.items.ore={type:'material',g:2};
 bot.p.c.items=[{name:'ore'},{name:'ore'}];
 const itemRule={...defaultsFor(FULL_DESCRIPTOR.schema.properties.items.items),
  item:'ore',enabled:true,action:'keep',excessAction:'sell',
  keep:1,teamReserve:0,maxCount:1,batch:2};
 bot.cfg.items=[itemRule];
 bot.production.reservedQuantity=()=>0;
 assert.equal(bankOperatingStockRule(bot,{name:'ore',q:2}),null);
 assert.equal(bankOperatingReserveNeed(bot,{name:'ore',q:2}),null);
 itemRule.batch=1;
 assert.equal(bankOperatingStockRule(bot,{name:'ore'})?.batch,1);
});

test('W02 unencumbered physical count excludes same-variant locked and reserved stacks',()=>{
 const bot=fixture(),G=bot.p.G;
 const item={name:'scroll0',q:20};
 const carried=[{name:'scroll0',q:20},
  {name:'scroll0',q:90,locked:true},
  {name:'scroll0',q:70,reserved:true},
  {name:'scroll0',q:40,giveaway:true},
  {name:'scroll0',q:30,equipped:true}];
 assert.equal(verifiedAvailableOperatingStockQuantity(G,carried,item),20);
 bot.p.c.items=carried;
 assert.deepEqual(bankOperatingReserveNeed(bot,item),{
  floor:110,held:20,missing:90});
 assert.equal(bankOperatingStockRule(bot,item),null,
  'already committed copies never satisfy the carried floor for bank sale');
 carried[1].locked=false;
 assert.equal(verifiedAvailableOperatingStockQuantity(G,carried,item),110);
 assert.equal(bankOperatingReserveNeed(bot,item),null);
 assert.ok(bankOperatingStockRule(bot,item),
  'bank sale resumes only after free copies actually cover the reserve');
});

test('W02 same-variant encumbrances never inflate autonomous NPC sale quantity',()=>{
 const bot=fixture(),item=bot.p.c.items[0];
 bot.p.c.items.push({name:'scroll0',q:350,locked:true});
 bot.p.c.items.push({name:'scroll0',q:100,reserved:true});
 const r=automaticOperatingStockRule(bot,item);
 assert.equal(r?.keep,100);
 assert.equal(r?.batch,190,'only 300 unencumbered units minus 110 protected');
 assert.equal(bot.economy.spare(0,r),190);
 item.reserved=true;
 assert.equal(bot.economy.spare(0,r),0,
  'a late source reservation revokes pending automatic sale');
 assert.equal(automaticOperatingStockRule(bot,item),null);
});

test('W02 malformed encumbered stack invalidates physical inventory proof',()=>{
 const bot=fixture(),item={name:'scroll0',q:20};
 bot.p.c.items=[item,{name:'scroll0',q:10000,reserved:true}];
 assert.equal(verifiedAvailableOperatingStockQuantity(bot.p.G,bot.p.c.items,item),null);
 assert.equal(bankOperatingReserveNeed(bot,item),null);
 assert.equal(bankOperatingStockRule(bot,item),null);
 bot.p.c.items[1].q=null;
 assert.equal(verifiedAvailableOperatingStockQuantity(bot.p.G,bot.p.c.items,item),null);
});
