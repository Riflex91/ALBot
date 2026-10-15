import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarket} from '../src/merchant/market.mjs';

function fixture(){
 const c={name:'My_Merchant',map:'main',in:'main',x:0,y:0,
  items:Array(42).fill(null),gold:200000,slots:{}};
 const entities={},travel=[],events=[],orders=[];
 let atMarket=false,accepted=0;
 const bot={p:{c,entities,read:()=>null,write:()=>true},cfg:{
  merchant:{marketHistory:false,position:{enabled:false},
   marketMinSamples:3,marketHistoryTtlMs:21600000},
  general:{testLogging:true}},
  exec:{},me:{name:'My_Merchant'},
  movement:{order:null},free:()=>42,
  event:(type,data)=>events.push({type,data})};
 bot.economy={destination:()=>({map:'main',in:'main',x:2000,y:0}),
  npcAt:()=>atMarket,npcTravel:()=>{travel.push('market');
   bot.movement.order={owner:'economy'};return false;},
  at:()=>atMarket,travel:()=>false,
  value:()=>5,count:()=>0,
  perform:(kind,job)=>{accepted++;orders.push({kind,job});return true;}};
 const market=createMarket(bot);
 const rule={enabled:true,item:'poison',action:'marketBuy',
  priceSource:'fixed',maxPrice:100,batch:3,targetCount:20,maxCount:100};
 return {market,bot,c,entities,rule,travel,events,orders,
  setAtMarket:yes=>{atMarket=yes;bot.movement.order=null;},
  purchases:()=>accepted};
}
test('empty market visit never spends gold and is not repeated every scheduling epoch',()=>{
 const f=fixture();
 const old=Date.now;let time=old();Date.now=()=>time;
 try{
  assert.equal(f.market.buy({name:'poison',level:0},f.rule),true);
  assert.equal(f.travel.length,1);
  f.setAtMarket(true);
  time+=3000;
  assert.equal(f.market.buy({name:'poison',level:0},f.rule),false);
  assert.equal(f.events.filter(x=>x.type==='market.noOffer').length,0,
   'arrival within the same probe window does not spam a second diagnostic');
  f.setAtMarket(false);
  for(let i=0;i<9;i++){
   time+=10000;
   assert.equal(f.market.buy({name:'poison',level:0},f.rule),false);
  }
  assert.equal(f.travel.length,1);
  time+=31000;
  assert.equal(f.market.buy({name:'poison',level:0},f.rule),true);
  assert.equal(f.travel.length,2);
  assert.equal(f.purchases(),0);
 }finally{Date.now=old;}
});

test('a newly visible affordable seller bypasses probe cooldown immediately',()=>{
 const f=fixture();
 assert.equal(f.market.buy({name:'poison',level:0},f.rule),true);
 f.setAtMarket(false);
 f.entities.seller={id:'seller',name:'Seller',type:'character',stand:true,
  x:100,y:0,map:'main',in:'main',
  slots:{trade1:{name:'poison',level:0,rid:'trade-1',price:10,q:3}}};
 assert.equal(f.market.buy({name:'poison',level:0},f.rule),true);
 assert.equal(f.purchases(),1);
 assert.equal(f.orders[0].kind,'market.buy');
 assert.equal(f.travel.length,1);
});
