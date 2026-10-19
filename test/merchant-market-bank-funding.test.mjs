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
 const e={count:()=>0,committedGold:()=>300,rules:()=>rule,
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
 assert.equal(f.market.fundingPending(),false);
 assert.equal(f.market.buy(f.item,f.rule),true);
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
