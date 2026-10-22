import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarket} from '../src/merchant/market.mjs';
import {bankGoldTransferPlan} from '../src/merchant/bank.mjs';

function fixture({bankGold=1000,budgetAllowed=true}={}){
 const c={name:'M',map:'main',in:'main',x:0,y:0,gold:150,
  bank:{gold:bankGold},items:Array(42).fill(null),
  slots:{trade1:{b:true,price:300,q:1}}};
 const seller={name:'Seller',id:'seller',type:'character',stand:true,
  map:'main',in:'main',x:20,y:0,slots:{trade2:
   {name:'poison',level:0,price:100,q:1,rid:'RID'}}};
 const item={name:'poison',level:0};
 const rule={name:'market reagent',action:'marketBuy',enabled:true,item:'poison',
  batch:1,targetCount:20,maxCount:20,maxPrice:120,priceSource:'fixed'};
 const stored=new Map(),events=[],trades=[],paths=[];
 const bot={me:{name:'M',role:'merchant'},running:true,
  p:{c,G:{items:{poison:{s:100}}},entities:{seller},realm:()=> 'EU',
   read:k=>stored.get(k),write:(k,v)=>{stored.set(k,v);return true;}},
  cfg:{general:{testLogging:true},merchant:{
   bank:true,bankGold:true,goldTarget:200,goldReserve:100,minFreeSlots:2,
   budgetMode:'account-loss',marketHistory:false,position:{enabled:false}}},
  event:(type,detail)=>events.push({type,detail}),free:()=>42,
  movement:{order:null},entity:id=>id==='seller'?seller:null};
 const e={count:()=>0,committedGold:()=>300,rules:()=>rule,explicit:()=>rule,
  budget:cost=>c.gold-300>=cost,
  budgetAtGold:(gold,cost)=>budgetAllowed&&gold-300>=cost,
  budgetExplanation:()=> 'policy denied',note:reason=>events.push({type:'note',detail:reason}),
  at:(pos,radius=110)=>pos.map===c.map&&
   Math.hypot(c.x-pos.x,c.y-pos.y)<=radius,
  travel:(pos,label)=>{paths.push(label);c.map=pos.map;c.in=pos.in;
   c.x=pos.x;c.y=pos.y;bot.movement.order={owner:'economy'};return false;},
  destination:()=>({map:'main',in:'main',x:0,y:0}),
  npcAt:()=>true,npcTravel:()=>true,
  perform:(kind,job)=>{trades.push({kind,job});return job.guard();}};
 bot.economy=e;
 bot.bank={ready:()=>{if(c.map==='bank')return true;
   paths.push('Bank');c.map=c.in='bank';c.x=0;c.y=-100;
   bot.movement.order={owner:'economy'};return false;},
  gold:()=>{const target=bot.market.fundingMinimumGold();
   const need=Math.max(0,target-c.gold);if(c.bank.gold<need)return false;
   c.gold+=need;c.bank.gold-=need;events.push({type:'bank.withdraw',detail:need});return true;}};
 const market=createMarket(bot);bot.market=market;
 return {market,bot,c,seller,rule,item,events,trades,paths,stored};
}
test('one market purchase funds only after actual offer price and commitments',()=>{
 const f=fixture();
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.market.fundingPending(),true);
 assert.equal(f.market.fundingMinimumGold(),500);
 assert.equal(f.c.map,'bank');
 assert.deepEqual(f.trades,[]);
 assert.equal(f.market.fundingTick(),true);
 assert.equal(f.c.gold,500);
 assert.equal(f.c.bank.gold,650);
 assert.equal(f.market.fundingTick(),true);
 assert.equal(f.c.map,'main');
 assert.equal(f.market.fundingTick(),false);
 assert.equal(f.market.fundingPending(),true,
  'pinned purchase quote must survive the bank-to-market return');
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.market.fundingPending(),false,
  'durable funding checkpoint retires only at authorized purchase handoff');
 assert.equal(f.trades[0]?.kind,'market.buy');
 assert.equal(f.trades[0].job.cost,100);
 assert.equal(f.trades[0].job.guard(),true);
});
test('changed offer price after return cannot spend the withdrawn gold',()=>{
 const f=fixture();
 f.market.buy(f.item,f.rule);f.market.fundingTick();f.market.fundingTick();
 f.market.fundingTick();
 f.seller.slots.trade2.price=1000;
 f.market.buy(f.item,f.rule);
 assert.deepEqual(f.trades,[]);
});
test('insufficient bank gold gives an exact diagnostic without attempting a trade',()=>{
 const f=fixture({bankGold:200});
 f.market.buy(f.item,f.rule);
 assert.equal(f.market.fundingTick(),false);
 assert.equal(f.market.fundingPending(),false);
 const problem=f.events.find(e=>e.type==='market.fundingBlocked');
 assert.equal(problem?.detail.missingGold,350);
 assert.equal(problem?.detail.availableBankGold,200);
 assert.deepEqual(f.trades,[]);
});
test('independent account and spending limits block speculative withdrawal',()=>{
 const f=fixture({budgetAllowed:false});
 assert.equal(f.market.buy(f.item,f.rule),false);
 assert.equal(f.market.fundingPending(),false);
 assert.equal(f.c.map,'main');
 assert.deepEqual(f.trades,[]);
});
test('changed market authorization cancels a funded bank trip',()=>{
 const f=fixture();
 f.market.buy(f.item,f.rule);
 f.rule.maxPrice=90;
 assert.equal(f.market.fundingTick(),false);
 assert.equal(f.market.fundingPending(),false);
 assert.deepEqual(f.trades,[]);
});

test('W03 validated bank-gold plan incorporates purchase floor without releasing stand bids',()=>{
 const slots={trade1:{b:true,price:300,q:1}};
 assert.deepEqual(bankGoldTransferPlan({wallet:150,bankGold:1000,slots,
  goldTarget:200,goldReserve:100,purchaseMinimum:500}),
  {method:'bank_withdraw',quantity:350,target:500,committed:300});
 assert.equal(bankGoldTransferPlan({wallet:150,bankGold:1000,
  slots:{trade1:{b:true,price:NaN}},goldTarget:200,goldReserve:100,
  purchaseMinimum:500}),null,'malformed trade bids can never justify a withdrawal');
});

function fundedAtOrigin(){
 const f=fixture();
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.market.fundingTick(),true);
 assert.equal(f.market.fundingTick(),true);
 assert.equal(f.c.map,'main');
 return f;
}
test('W03 exact market seller, trade slot, RID, price and quantity survive bank return',()=>{
 const f=fundedAtOrigin();
 const checkpoint=f.stored.get('albot:market-funding:v1:M');
 assert.equal(checkpoint.sellerId,'seller');
 assert.equal(checkpoint.slot,'trade2');
 assert.equal(checkpoint.rid,'RID');
 assert.equal(checkpoint.quantity,1);
 assert.equal(checkpoint.unitPrice,100);
 assert.equal(f.market.fundingTick(),false);
 assert.equal(f.market.fundingPending(),true);
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.trades.length,1);
 assert.equal(f.trades[0].job.details.rid,'RID');
 assert.equal(f.trades[0].job.guard(),true);
 assert.equal(f.market.fundingPending(),false);
 assert.equal(f.stored.get('albot:market-funding:v1:M'),null);
});
test('W03 every post-trip quote drift cancels funded purchase without trade',()=>{
 const changes=[
  f=>{f.seller.slots.trade2.rid='RID-NEW';},
  f=>{f.seller.slots.trade2.price=105;},
  f=>{f.seller.slots.trade2.q=0;},
  f=>{f.seller.slots.trade2.q=1.25;},
  f=>{f.seller.slots.trade2={name:'different',level:0,price:100,q:1,rid:'RID'};},
  f=>{f.seller.slots.trade2=null;},
  f=>{f.seller.stand=false;},
  f=>{f.seller.x=1000;},
  f=>{f.seller.id='new-seller';}
 ];
 for(const change of changes){
  const f=fundedAtOrigin();
  change(f);
  assert.equal(f.market.fundingTick(),false);
  assert.equal(f.market.fundingPending(),false);
  assert.equal(f.trades.length,0,'no trade on invalid original funded quote');
  assert.equal(f.events.some(e=>e.type==='market.fundingBlocked'),true);
 }
});
test('W03 cheaper unrelated live offer cannot consume the pinned funding',()=>{
 const f=fundedAtOrigin();
 const cheaper={name:'Cheaper',id:'cheaper',type:'character',
  stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:{
   name:'poison',level:0,price:1,q:1,rid:'OTHER'}}};
 f.bot.p.entities={cheaper,seller:f.seller};
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.trades.length,1);
 assert.equal(f.trades[0].job.details.seller,'Seller');
 assert.equal(f.trades[0].job.details.unitPrice,100);
});
test('W03 quote checkpoint remains binding across restart at the market',()=>{
 const f=fundedAtOrigin();
 f.bot.market=createMarket(f.bot);
 assert.equal(f.bot.market.fundingPending(),true);
 assert.equal(f.bot.market.fundingTick(),false);
 assert.equal(f.bot.market.buy(f.item,f.rule),true);
 assert.equal(f.trades[0].job.details.rid,'RID');
 assert.equal(f.bot.market.fundingPending(),false);
});
test('W03 failed checkpoint retirement never grants permission for trade dispatch',()=>{
 const f=fundedAtOrigin(),saved=f.bot.p.write;
 f.bot.p.write=(key,value)=>value===null?false:saved(key,value);
 assert.equal(f.market.buy(f.item,f.rule),false);
 assert.equal(f.market.fundingPending(),true);
 assert.deepEqual(f.trades,[]);
});
test('W03 pre-migration market financing cannot withdraw without seller evidence',()=>{
 const f=fixture();
 const key='albot:market-funding:v1:M';
 f.stored.set(key,{source:'market',item:{name:'poison',level:0},
  realm:'EU',required:500,cost:100,quantity:1,unitPrice:100,
  at:Date.now(),ruleStamp:'old',commitments:300});
 f.bot.market=createMarket(f.bot);
 assert.equal(f.bot.market.fundingMinimumGold(),0);
 assert.equal(f.bot.market.fundingTick(),false);
 assert.deepEqual(f.trades,[]);
 assert.equal(f.bot.market.fundingPending(),false);
});
