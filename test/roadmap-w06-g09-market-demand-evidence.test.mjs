import test from 'node:test';
import assert from 'node:assert/strict';
import {identity} from '../src/core/policy.mjs';
import {createMarketDemand} from '../src/merchant/market-demand.mjs';

const item={name:'cake'};
const rule={action:'sell',_autoDisposition:true,minPrice:1};
function fixture({prior=null,limit=99,ttl=7200000}={}){
 const state=new Map(),calls=[];
 if(prior!==null)state.set('albot:sales:v1:M',prior);
 const bot={
  me:{name:'M'},
  cfg:{merchant:{autoMarket:true,listingTtlMs:ttl,minFreeSlots:1},
   production:{goldPerHour:0,minImprovement:.1}},
  p:{G:{items:{cake:{s:limit},ring:{}}},
   c:{tax:.05,slots:{}},read:key=>state.get(key)??null,
   write:(key,row)=>{state.set(key,structuredClone(row));return true;},
   has:name=>name==='unequip',
   call:(...args)=>{calls.push(['api',...args]);return null;}},
  economy:{explicit:()=>null,value:()=>10,count:()=>10,
   perform:(name,options)=>{calls.push([name,options]);return true;}},
  production:{reservedQuantity:()=>0},
  free:()=>10
 };
 const market=createMarketDemand(bot);
 return {market,bot,state,calls};
}
const trade=(q,buyer='B',name='cake')=>{
 const sold={name,price:100};
 if(q!=='absent')sold.q=q;
 return {item:sold,seller:'A',buyer};
};

test('W06/G09 recorded sales must meet actual stack ceilings, not just positive integers',()=>{
 for(const q of [null,0,-1,1.5,NaN,Infinity,100,9999,
  Number.MAX_SAFE_INTEGER]){
  const f=fixture();
  assert.equal(f.market.sale(trade(q)),false,'q='+String(q));
  assert.equal(f.market.status().confirmedTrades,0);
  assert.equal(f.market.proposal(item,rule),null);
 }
 for(const q of [null,2]){
  const f=fixture();
  assert.equal(f.market.sale(trade(q,'B','ring')),false,
   'non-stackable copies cannot be traded as a single physical stack');
 }
 const f=fixture();
 assert.equal(f.market.sale(trade('absent')),true);
 assert.equal(f.market.sale(trade(99,'C')),true);
 assert.equal(f.market.sale(trade(1,'D')),true);
 assert.equal(f.market.status().confirmedTrades,3);
 assert.equal(f.market.proposal(item,rule)?.action,'list');
});

test('W06/G09 stored forged quantity or variant cannot authorize automatic liquidation',()=>{
 const at=Date.now()-1000,key=identity(item);
 const rows=[
  {variant:key,price:100,quantity:100,at},
  {variant:key,price:100,quantity:99,at},
  {variant:key,price:100,quantity:1,at},
  {variant:'{broken',price:100,quantity:1,at},
  {variant:identity({name:'unknown'}),price:100,quantity:1,at},
  {variant:key,price:100,quantity:2,at}
 ];
 const f=fixture({prior:{sales:rows}});
 assert.equal(f.market.status().confirmedTrades,3);
 assert.equal(f.market.proposal(item,rule)?.action,'list');
 const untrusted=fixture({prior:{sales:rows.slice(0,2)}});
 assert.equal(untrusted.market.status().confirmedTrades,1);
 assert.equal(untrusted.market.proposal(item,rule),null);
 const bogus=fixture({prior:{sales:Array(3).fill(
  {variant:key,price:100,quantity:Number.MAX_SAFE_INTEGER,at})}});
 assert.equal(bogus.market.status().confirmedTrades,0);
 assert.equal(bogus.market.proposal(item,rule),null);
});

test('W06/G09 an unknown item or invalid trade party does not change demand',()=>{
 const f=fixture();
 for(const data of [
  {...trade(1),seller:''},
  {...trade(1),buyer:''},
  {...trade(1),seller:'B',buyer:'B'},
  {...trade(1),item:{name:'missing',price:100}},
  {...trade(1),item:{name:'cake',price:100,q:null}}
 ])assert.equal(f.market.sale(data),false);
 assert.equal(f.market.status().confirmedTrades,0);
});

test('W06/G09 offer expiry rejects physically impossible or changed stand quantities',()=>{
 const f=fixture({ttl:0});
 const stand=f.bot.p.c.slots;
 stand.trade1={name:'cake',price:100,q:100};
 assert.equal(f.market.posted('trade1',item,{_autoMarket:true}),false,
  'invalid stand stack must not be recorded');
 assert.equal(f.market.expire(),false);
 assert.equal(f.calls.length,0,'invalid stack must not dispatch unequip');
 stand.trade1={name:'cake',price:100,q:null};
 assert.equal(f.market.posted('trade1',item,{_autoMarket:true}),false,
  'explicit null quantity cannot become owned listing');
 assert.equal(f.market.expire(),false);
 assert.equal(f.calls.length,0);
 stand.trade1={name:'cake',price:100,q:99};
 assert.equal(f.market.posted('trade1',item,{_autoMarket:true}),true);
 assert.equal(f.market.expire(),true);
 const [kind,operation]=f.calls.at(-1);
 assert.equal(kind,'market.expire');
 assert.equal(operation.details.quantity,99);
 assert.equal(operation.guard(),true);
 stand.trade1={name:'cake',price:100,q:100};
 assert.equal(operation.guard(),false,
  'a quantity drift after scheduling can never authorize delayed unequip');
});

test('W06/G09 unstackable own stand rejects a forged multi-item stack',()=>{
 const f=fixture({limit:1,ttl:0});
 f.bot.p.c.slots.trade2={name:'cake',price:100,q:2};
 assert.equal(f.market.posted('trade2',item,{_autoMarket:true}),false,
  'nonstackable phantom stand cannot become owned listing');
 assert.equal(f.market.expire(),false);
 assert.equal(f.calls.length,0);
});

test('W06/G09 market rejects prototype item names as actual game definitions',()=>{
 const f=fixture();
 for(const name of ['constructor','toString','__proto__','unknown']){
  assert.equal(f.market.sale(trade(1,'B',name)),false,name);
  assert.equal(f.market.proposal({name},rule),null,name);
 }
 assert.equal(f.market.status().confirmedTrades,0);
});
test('W06/G09 cyclic item metadata cannot crash real demand planning',()=>{
 const f=fixture(),cycle={self:null};cycle.self=cycle;
 const bad={name:'cake',data:cycle,price:100};
 assert.doesNotThrow(()=>f.market.sale({item:bad,seller:'A',buyer:'B'}));
 assert.equal(f.market.sale({item:bad,seller:'A',buyer:'C'}),false);
 assert.doesNotThrow(()=>f.market.proposal(bad,rule));
 assert.equal(f.market.proposal(bad,rule),null);
 assert.equal(f.market.status().confirmedTrades,0);
 const normal=fixture();
 for(const buyer of ['B','C','D'])normal.market.sale(trade(1,buyer));
 assert.equal(normal.market.proposal(item,rule)?.action,'list',
  'malformed variants must not disable real, independently evidenced proposals');
});
test('W06/G09 stored or live malformed stand variants cannot dispatch a reclaim',()=>{
 const f=fixture({ttl:0}),cycle={self:null};cycle.self=cycle;
 f.bot.p.c.slots.trade1={name:'cake',price:100,data:cycle};
 assert.doesNotThrow(()=>f.market.posted('trade1',item,{_autoMarket:true}));
 assert.equal(f.market.posted('trade1',item,{_autoMarket:true}),false);
 assert.equal(f.market.status().ownedListings,0);
 assert.doesNotThrow(()=>f.market.expire());
 assert.equal(f.market.expire(),false);
 assert.equal(f.calls.length,0);
 f.bot.p.c.slots.trade1={name:'cake',price:100};
 assert.equal(f.market.posted('trade1',item,{_autoMarket:true}),true);
 f.bot.p.c.slots.trade1={name:'cake',price:100,data:cycle};
 assert.doesNotThrow(()=>f.market.expire());
 assert.equal(f.market.expire(),false);
 assert.equal(f.calls.length,0);
});
