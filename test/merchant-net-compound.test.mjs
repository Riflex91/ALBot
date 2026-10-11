import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarket} from '../src/merchant/market.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';

function marketFixture(prices=[101]){
 const item={name:'ring',level:1},c={name:'M',map:'main',in:'main',x:0,y:0,tax:.05,speed:40,gold:0,
  items:[{...item,q:3},...Array(41).fill(null)]},action=[];
 const buyers=Object.fromEntries(prices.map((price,k)=>{
  const name='Buyer'+k;
  return [name,{name,id:name,type:'character',stand:true,map:'main',in:'main',x:10,y:0,
   slots:{trade1:{...item,b:true,q:3,price,rid:'bid'+k}}}];
 }));
 const bot={p:{c,entities:buyers,has:()=>true,read:()=>null},me:{name:'M'},
  cfg:{merchant:{marketHistory:false},production:{goldPerHour:0}},
  economy:{safe:()=>true,spare:()=>3,value:()=>100,count:()=>3,
   rules:()=>({action:'sell'}),perform:(kind,opts)=>{action.push(opts);return true;}},
  entity:name=>buyers[name],exec:{}};
 return {bot,c,action,buyers,market:createMarket(bot)};
}
test('R01 101 gross with five percent tax is worth less than NPC100',()=>{
 const {market}=marketFixture();
 const bid=market.bidValuation({name:'ring',level:1},1,100,{future:false});
 assert.equal(bid.unitValue,100);
 assert.equal(bid.covered,0);
});
test('R01 chooses best bid rather than first one; rejects changed tax and RID',()=>{
 const {market,c,action,buyers}=marketFixture([150,200]);
 const rule={action:'sell',minPrice:1,_autoDisposition:true};
 assert.equal(market.sellToBid(0,rule),true);
 assert.equal(action.length,1);
 assert.equal(action[0].details.buyer,'Buyer1');
 assert.equal(action[0].details.expectedGold,570);
 assert.equal(action[0].guard(),true);
 c.tax=.1;assert.equal(action[0].guard(),false,'tax drift invalidates the payout');
 c.tax=.05;buyers.Buyer1.slots.trade1.rid='other';
 assert.equal(action[0].guard(),false,'changed offer invalidates trade');
});
test('R01 automatic sale rejects below-NPC net bid, explicit rule remains authoritative',()=>{
 const {market}=marketFixture([101]);
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:1,_autoDisposition:true}),false);
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:1}),true);
});
test('R01 unknown tax cannot be represented as positive net opportunity',()=>{
 const {market,c}=marketFixture([300]);delete c.tax;
 const v=market.bidValuation({name:'ring',level:1},1,100,{future:true});
 assert.equal(v.covered,0);assert.equal(v.reason,'unknown-tax');
 assert.equal(market.sellToBid(0,{action:'sell',minPrice:1,_autoDisposition:true}),false);
});
test('R02 six compound inputs and one single-unit buyer bid favor one batch',()=>{
 const items=[...Array.from({length:6},()=>({name:'ring',level:0})),...Array(36).fill(null)];
 const c={name:'M',map:'main',in:'main',x:0,y:0,tax:.05,speed:40,items};
 const G={version:1,items:{ring:{type:'ring',compound:true,grades:[10,20]},cscroll0:{g:1}},
  compounds:[[null,1,1]]};
 const buyer={id:'Buyer',name:'Buyer',type:'character',stand:true,map:'main',in:'main',x:10,y:0,
  slots:{trade1:{name:'ring',level:1,b:true,rid:'bid',price:100,q:1}}};
 const cfg={merchant:{marketHistory:false},production:{autoProfitMaxLevel:1,autoGearMaxLevel:1,helperMaxPrice:1000,
  minChance:.5,minImprovement:0,lossBudget:10000,goldPerHour:0}};
 const bot={p:{c,G,entities:{Buyer:buyer},read:()=>null,call:()=>0},cfg,
  me:{name:'M',role:'merchant'},economy:{value:i=>i.level===1?20:10,
   safe:i=>!!i},production:{reservedQuantity:()=>0},entity:()=>buyer};
 bot.market=createMarket(bot);
 const intelligence=createEconomicIntelligence(bot);
 const decision=intelligence.mutationEconomics({name:'ring',level:0});
 assert.equal(decision.action,'compound');
 assert.equal(decision.groups,1,'do not reuse a one-unit bid for both compound outputs');
});
