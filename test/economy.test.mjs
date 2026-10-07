import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {ECONOMY_DESCRIPTOR} from '../src/config/live-b.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {createBank} from '../src/merchant/bank.mjs';
import {Executor} from '../src/core/executor.mjs';
import {planProduction} from '../src/production/planner.mjs';
import {createProduction} from '../src/production/production.mjs';
import {createMarket} from '../src/merchant/market.mjs';
import {createServices} from '../src/merchant/services.mjs';
function fixture(){
 const cfg=defaultsFor(ECONOMY_DESCRIPTOR.schema);cfg.merchant.goldReserve=100;cfg.merchant.maxSpendPerHour=10000;cfg.production.lossBudget=1000;cfg.party.merchant='M';
 const data=new Map(),c={name:'M',map:'bank',in:'bank',x:0,y:-100,gold:10000,items:[{name:'hpot0',q:10},...Array(41).fill(null)],slots:{},bank:{items0:Array(42).fill(null),gold:0}};
 const bot={cfg,me:{name:'M',role:'merchant',goldReserve:100},p:{c,G:{items:{hpot0:{g:20,s:9999}},npcs:{}},read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;},realm:()=> 'EUII',call(){throw Error('Unexpected API');}},running:true,inventoryBlocked:false,checkpoint:{durable:true},journal:null,logistics:{reserved:false},free:()=>c.items.filter(x=>!x).length,event(){},report(){},movement:{go(){return false;}},beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
 let now=Date.now();bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});bot.economy=createEconomy(bot);bot.bank=createBank(bot);
 const rule={...defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.items.items),item:'hpot0',role:'merchant',action:'bank',batch:10,maxCount:100,goldBudget:10000};
 return {bot,c,rule,data,advance:()=>{now+=30000;bot.exec.poll();}};
}

test('production recipient goal remembers confirmed quantity and transfer ID across reload',()=>{
 const {bot}=fixture();bot.cfg.production.goals=[{name:'Eine Lieferung',enabled:true,item:'helmet',level:1,quantity:2,recipient:'A',budget:1000,priority:0}];bot.production=createProduction(bot);
 const j={kind:'send',id:'first',to:'A',item:{name:'helmet',level:1},quantity:1};assert.equal(bot.production.recordDelivery(j),true);assert.equal(bot.production.recordDelivery(j),true);bot.production=createProduction(bot);assert.equal(bot.production.recordDelivery(j),true);assert.equal(bot.production.status().deliveries[0].quantity,1);assert.equal(bot.production.recordDelivery({...j,id:'second'}),true);assert.equal(bot.production.status().deliveries[0].quantity,2);
});

test('gathering removes offhand before doublehand tool, observes cast and restores both slots after reload',async()=>{
 const {bot,c,data,advance}=fixture();bot.cfg.merchant.fishing=true;bot.cfg.merchant.mining=false;bot.cfg.merchant.merrit=false;bot.cfg.merchant.massBuffs=false;c.map=c.in='main';c.x=16;c.y=0;c.level=60;c.mp=1000;c.slots={mainhand:{name:'sword'},offhand:{name:'shield'}};c.items[0]={name:'rod'};c.q={};
 bot.monsters=()=>[];bot.p.G.maps={main:{zones:[{type:'fishing',polygon:[[-10,-10],[10,-10],[10,10],[-10,10]]}]}};bot.p.G.skills={fishing:{level:16,mp:120}};const calls=[];
 bot.p.call=(name,...args)=>{if(name==='is_on_cooldown')return false;calls.push([name,...args]);if(name==='unequip'){const dest=c.items.findIndex(i=>!i);c.items[dest]=c.slots[args[0]];delete c.slots[args[0]];}else if(name==='equip'){const old=c.slots[args[1]];c.slots[args[1]]=c.items[args[0]];c.items[args[0]]=old??null;}else if(name==='use_skill')c.q.fishing={};else assert.fail(name);return Promise.resolve();};
 bot.services=createServices(bot);const step=async()=>{bot.services.tick();await Promise.resolve();bot.exec.poll();};await step();assert.equal(calls[0][0],'unequip');await step();assert.equal(c.slots.mainhand.name,'rod');await step();assert.equal(calls[2][0],'use_skill');assert.equal(bot.journal,null);
 bot.services=createServices(bot);assert.equal(bot.services.restore(),true);delete c.q.fishing;
 for(let n=0;n<3;n++){bot.services.restore();await Promise.resolve();bot.exec.poll();advance();}
 assert.equal(c.slots.mainhand.name,'sword');assert.equal(c.slots.offhand.name,'shield');assert.equal(data.get('albot:tools:M'),null);assert.equal(bot.inventoryBlocked,false);
});
test('bank confirms both sides and does not consume a protected or changed slot',async()=>{
 const {bot,c,rule}=fixture();bot.p.call=(name,slot,pack,dest)=>{assert.equal(name,'bank_store');c.bank[pack][dest]=c.items[slot];c.items[slot]=null;return Promise.resolve();};
 assert.equal(bot.bank.store(0,rule),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.journal,null);assert.equal(c.bank.items0[0].q,10);
 c.items[0]={name:'hpot0',q:10,l:'l'};assert.equal(bot.bank.store(0,rule),false);
});
test('bank partial stack keeps reserves and verifies a split before storage',async()=>{
 const {bot,c,rule}=fixture();rule.keep=7;bot.p.call=(name,slot,q)=>{assert.equal(name,'split');assert.equal(q,3);c.items[slot].q-=q;c.items[1]={name:'hpot0',q};return Promise.resolve();};
 assert.equal(bot.bank.store(0,rule),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.journal,null);assert.equal(c.items[0].q,7);assert.equal(c.items[1].q,3);
});
test('unobserved value action blocks instead of treating a resolved promise as success',async()=>{
 const {bot,advance}=fixture();assert.equal(bot.economy.perform('buy',{call:()=>Promise.resolve({success:true}),observe:()=>false}),true);await Promise.resolve();advance();assert.equal(bot.inventoryBlocked,true);assert.equal(bot.journal.kind,'buy');
});
test('budgets survive module reload and include outstanding wishlist liabilities',()=>{
 const {bot,c}=fixture();bot.cfg.merchant.maxSpendPerHour=500;
 assert.equal(bot.economy.perform('buy',{cost:400,call:()=>Promise.resolve(),observe:()=>false}),true);
 bot.economy=createEconomy(bot);assert.equal(bot.economy.budget(101),false);
 c.slots.trade1={b:true,price:9900,q:1};assert.equal(bot.economy.budget(1),false);
});
test('NPC buying uses gold API and rechecks the configured ceiling',async()=>{
 const {bot,c,rule}=fixture();c.map=c.in='main';bot.p.G.npcs.potions={items:['hpot0']};
 bot.p.call=(name,...args)=>{if(name==='find_npc')return {map:'main',in:'main',x:0,y:-100};assert.equal(name,'buy_with_gold');assert.deepEqual(args,['hpot0',2]);c.items[0].q+=2;return Promise.resolve();};
 rule.action='buy';rule.maxPrice=19;assert.equal(bot.economy.npcBuy({name:'hpot0',level:0},rule,2),false);
 rule.maxPrice=20;assert.equal(bot.economy.npcBuy({name:'hpot0',level:0},rule,2),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.journal,null);
});
test('recipe planner allocates shared stock once, respects yield and detects cycles',()=>{
 const options={G:{items:{},craft:{a:{q:2,items:[[2,'ore']]},b:{items:[[1,'a'],[1,'a']]}}},item:'b',quantity:1,stock:(n)=>n==='ore'?2:0,bank:()=>0,canBuy:n=>n==='ore',allowed:['npc','craft'],maxDepth:8};
 const steps=planProduction(options);assert.equal(steps.some(s=>s.kind==='buy'&&s.item==='ore'),false);assert.equal(steps.filter(s=>s.item==='a').length,1);assert.equal(steps.at(-1).item,'b');
 options.G.craft.a={items:[[1,'b']]};assert.throws(()=>planProduction(options),/Rezeptzyklus/);
 options.G.craft.a={items:[[1,'ore']]};options.maxDepth=1;assert.throws(()=>planProduction(options),/Tiefe|tiefe/);
});

test('one-action limit counts dispatch, excludes stack splitting and survives pause/resume',async()=>{
 const {bot,rule}=fixture();rule.maxActions=1;
 assert.equal(bot.economy.perform('bank.split',{rule,call:()=>Promise.resolve(),observe:()=>true}),true);
 await Promise.resolve();bot.exec.poll();assert.equal(bot.economy.remaining(rule),true);
 assert.equal(bot.economy.perform('bank.store',{rule,call:()=>Promise.resolve(),observe:()=>true}),true);
 await Promise.resolve();bot.exec.poll();bot.economy.close();bot.economy.resume();
 assert.equal(bot.economy.remaining(rule),false);
 assert.equal(bot.economy.perform('sell',{rule,call:()=>assert.fail('must not dispatch'),observe:()=>true}),false);
});

test('dependency planner bounds broad recipes as well as cycles',()=>{
 const G={items:{},craft:{root:{items:Array.from({length:257},(_,n)=>[1,'ore'+n])}}};
 assert.throws(()=>planProduction({G,item:'root',stock:()=>0,bank:()=>0,canBuy:()=>false,allowed:['craft','farm']}),/256/);
});

test('upgrade refreshes chance after a changed input and dispatches only once',async()=>{
 const {bot,c,rule,advance}=fixture();bot.cfg.production.enabled=true;bot.cfg.production.upgrade=true;bot.cfg.production.lossBudget=10000;
 Object.assign(rule,{item:'helmet',action:'upgrade',targetLevel:1,maxLevel:0,maxActions:1,lossBudget:5000});bot.cfg.items=[rule];
 c.items=[{name:'helmet',level:0},{name:'scroll0',q:2},...Array(40).fill(null)];bot.p.G.items.helmet={upgrade:{}};let previews=0,mutations=0;
 bot.p.call=(name,...args)=>{if(name==='find_npc')return {map:'bank',in:'bank',x:0,y:-100};if(name==='item_grade')return 0;if(name==='item_value')return 100;
  assert.equal(name,'upgrade');if(args.at(-1)===true){previews++;return Promise.resolve({chance:1});}mutations++;c.items[0].level=1;c.items[1].q--;return Promise.resolve();};
 bot.production=createProduction(bot);assert.equal(bot.production.mutate(0,rule),true);await new Promise(r=>setImmediate(r));bot.exec.poll();
 c.items[1].q=3;assert.equal(bot.production.mutate(0,rule),false);assert.equal(mutations,0);advance();assert.equal(bot.production.mutate(0,rule),true);assert.equal(previews,2);
 await new Promise(r=>setImmediate(r));bot.exec.poll();assert.equal(bot.production.mutate(0,rule),true);
 await new Promise(r=>setImmediate(r));bot.exec.poll();assert.equal(mutations,1);assert.equal(bot.journal,null);assert.equal(bot.production.mutate(0,rule),false);
});

test('craft rejects protected ingredients and output beyond the target quantity',()=>{
 const {bot,c,rule}=fixture();bot.cfg.production.enabled=true;bot.cfg.production.craft=true;bot.p.G.craft={result:{cost:10,q:2,items:[[2,'hpot0']]}};
 const protect={...rule,action:'keep'};bot.cfg.items=[protect];bot.production=createProduction(bot);
 assert.equal(bot.production.craft('result',{...rule,item:'result',action:'craft',targetCount:2}),false);
 bot.cfg.items=[];assert.equal(bot.production.craft('result',{...rule,item:'result',action:'craft',targetCount:1}),false);assert.equal(c.items[0].q,10);
});

test('market buy rejects an offer whose price changes before dispatch',()=>{
 const {bot,c,rule}=fixture();const offer={name:'hpot0',q:2,price:20,rid:'offer-1'};
 const player={name:'Seller',type:'character',stand:true,x:0,y:-100,slots:{trade1:offer}};bot.p.entities={Seller:player};bot.entity=()=>player;
 Object.assign(rule,{action:'marketBuy',maxPrice:20,targetCount:12});bot.market=createMarket(bot);
 bot.economy.perform=(kind,action)=>{assert.equal(action.cost,40);assert.equal(action.guard(),true);offer.price=100;assert.equal(action.guard(),false);return false;};
 assert.equal(bot.market.buy({name:'hpot0',level:0},rule),false);assert.equal(c.items[0].q,10);
});


test('fulfilled upgrade target suppresses reacquisition of the consumed base item',()=>{
 const {bot,c,rule}=fixture();
 const buy={...rule,name:'Basishelm',item:'helmet',action:'buy',minLevel:0,maxLevel:0,targetCount:1,maxCount:1};
 const upgrade={...rule,name:'Upgradehelm',item:'helmet',action:'upgrade',minLevel:0,maxLevel:0,targetLevel:1,targetCount:1,maxCount:1};
 bot.cfg.items=[buy,upgrade];c.items=[{name:'helmet',level:1},...Array(41).fill(null)];
 const base={name:'helmet',level:0,stat_type:'',p:'',title:''};
 assert.equal(bot.economy.downstreamSatisfied(base,buy),true);
 c.items[0]=null;assert.equal(bot.economy.downstreamSatisfied(base,buy),false);
});
