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
import {createGear} from '../src/production/gear.mjs';
function fixture(){
 const cfg=defaultsFor(ECONOMY_DESCRIPTOR.schema);cfg.merchant.goldReserve=100;cfg.merchant.maxSpendPerHour=10000;cfg.production.lossBudget=1000;cfg.party.merchant='M';
 const data=new Map(),c={name:'M',map:'bank',in:'bank',x:0,y:-100,gold:10000,items:[{name:'hpot0',q:10},...Array(41).fill(null)],slots:{},bank:{items0:Array(42).fill(null),gold:0}};
 const bot={cfg,me:{name:'M',role:'merchant',goldReserve:100},p:{c,G:{items:{hpot0:{g:20,s:9999}},npcs:{}},read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;},realm:()=> 'EUII',call(){throw Error('Unexpected API');}},running:true,inventoryBlocked:false,checkpoint:{durable:true},journal:null,logistics:{reserved:false},free:()=>c.items.filter(x=>!x).length,event(){},report(){},movement:{go(){return false;}},beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
 let now=Date.now();bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});bot.economy=createEconomy(bot);bot.bank=createBank(bot);
 const rule={...defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.items.items),item:'hpot0',role:'merchant',action:'bank',batch:10,maxCount:100,goldBudget:10000};
 return {bot,c,rule,data,advance:()=>{now+=30000;bot.exec.poll();}};
}

test('bank workspace remains free both at selection and delayed dispatch',()=>{
 const {bot,c,rule}=fixture();bot.cfg.merchant.bankWorkspace=2;
 c.bank.items0=Array.from({length:42},(_,n)=>n<40?{name:'locked',l:true}:null);
 assert.equal(bot.bank.store(0,rule),false);
 c.bank.items0[39]=null;bot.exec.beginFrame();assert.equal(bot.bank.store(0,rule),true);
 c.bank.items0[39]={name:'locked',l:true};bot.exec.flush();assert.equal(bot.exec.pending.size,0);
});
test('bank reclaim records an exact sale receipt despite unrelated farm income',async()=>{
 const {bot,c,rule,data}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.bankWorkspace=2;
 bot.cfg.items=[{...rule,name:'Sale',item:'carrot',action:'sell',minPrice:1,keep:0,teamReserve:0}];
 bot.p.G.items.carrot={g:20,s:9999};c.bank.items0=Array.from({length:42},()=>({name:'locked',l:true}));
 c.bank.items0[3]={name:'carrot',q:2};let sales=0;
 bot.p.call=(name,...args)=>{
  if(name==='item_value')return 10;
  if(name==='find_npc')return {map:'bank',in:'bank',x:0,y:-100};
  if(name==='bank_retrieve'){c.items[args[2]]=c.bank[args[0]][args[1]];c.bank[args[0]][args[1]]=null;return Promise.resolve();}
  if(name==='sell'){sales++;const item={...c.items[args[0]]};c.items[args[0]]=null;c.gold+=1020;return Promise.resolve({success:true,gold:20,item});}
  assert.fail(name);
 };
 bot.decisionEpoch=1;bot.bank.reclaim();bot.decisionEpoch=2;assert.equal(bot.bank.reclaim(),true);
 await Promise.resolve();bot.exec.poll();c.gold+=50;
 bot.bank.recoverCapacity();await Promise.resolve();await Promise.resolve();bot.exec.poll();
 assert.equal(bot.journal,null);assert.equal(data.get('albot:bank-reclaim:M').saleConfirmed,true);
 bot.bank=createBank(bot);bot.bank.recoverCapacity();assert.equal(bot.bank.pending,false);assert.equal(sales,1);
});

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
test('empty bank pack exposes 42 slots but an occupied stack is never used as bank_store target',async()=>{
 const {bot,c,rule}=fixture();c.bank.items0=[];assert.equal(bot.bank.capacity()[0].free,42);
 c.bank.items0=Array.from({length:42},()=>({name:'protected',l:true}));c.bank.items0[7]={name:'hpot0',q:50};
 const calls=[];bot.p.call=(name,...args)=>{calls.push([name,...args]);return Promise.resolve();};
 assert.equal(bot.bank.store(0,rule),false);
 assert.equal(calls.some(x=>x[0]==='bank_store'),false,'occupied bank slot may swap instead of merging');
 assert.equal(c.bank.items0[7].q,50);
 assert.deepEqual(c.items[0],{name:'hpot0',q:10});
 assert.equal(bot.journal,null);
});
test('bank pressure reclaims only an explicit unreserved sale and resumes sale before other inventory jobs',async()=>{
 const {bot,c,rule}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.bankWorkspace=2;const sale={...rule,name:'Carrot sale',item:'carrot',action:'sell',keep:0,teamReserve:0,minPrice:1,maxActions:1};bot.cfg.items=[sale];bot.p.G.items.carrot={g:20,s:9999};c.bank.items0=Array.from({length:42},()=>({name:'protected',l:true}));c.bank.items0[4]={name:'carrot',q:2};const calls=[];
 bot.p.call=(name,...args)=>{calls.push(name);if(name==='item_value')return 10;if(name==='find_npc')return {map:'bank',in:'bank',x:0,y:-100};if(name==='bank_retrieve'){const [pack,slot,dest]=args;c.items[dest]=c.bank[pack][slot];c.bank[pack][slot]=null;}if(name==='sell'){const [slot,q]=args;c.items[slot]=null;c.gold+=q*10;}return Promise.resolve();};
 bot.decisionEpoch=0;assert.equal(bot.bank.reclaim(),false,'first pressure reading cannot start destructive recovery');bot.decisionEpoch=1;assert.equal(bot.bank.reclaim(),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.bank.pending,true);bot.bank=createBank(bot);assert.equal(bot.bank.recoverCapacity(),true);await Promise.resolve();bot.exec.poll();bot.bank.recoverCapacity();assert.equal(bot.bank.pending,false);assert.equal(c.bank.items0[4],null);assert.equal(calls.filter(x=>x==='bank_retrieve').length,1);assert.equal(calls.filter(x=>x==='sell').length,1);
});
test('bank partial stack keeps reserves and verifies a split before storage',async()=>{
 const {bot,c,rule}=fixture();rule.keep=7;bot.p.call=(name,slot,q)=>{assert.equal(name,'split');assert.equal(q,3);c.items[slot].q-=q;c.items[1]={name:'hpot0',q};return Promise.resolve();};
 assert.equal(bot.bank.store(0,rule),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.journal,null);assert.equal(c.items[0].q,7);assert.equal(c.items[1].q,3);
});
test('unobserved value action blocks instead of treating a resolved promise as success',async()=>{
 const {bot,advance}=fixture();assert.equal(bot.economy.perform('buy',{call:()=>Promise.resolve({success:true}),observe:()=>false}),true);await Promise.resolve();advance();assert.equal(bot.inventoryBlocked,true);assert.equal(bot.journal.kind,'buy');
});

test('partial bank retrieve returns excess before any other inventory action, survives reload and counts one rule action',async()=>{
 const {bot,c,rule,advance}=fixture();bot.cfg.merchant.partialBank=true;bot.cfg.merchant.partialBankMaxStack=100;rule.action='retrieve';rule.batch=5;rule.maxCount=15;rule.maxActions=1;c.bank.items0[0]={name:'hpot0',q:90};const calls=[];
 bot.p.call=(name,...args)=>{calls.push(name);if(name==='bank_retrieve'){const [pack,slot,dest]=args;c.items[dest]=c.bank[pack][slot];c.bank[pack][slot]=null;}else if(name==='split'){const [slot,q]=args,dest=c.items.findIndex(i=>!i);c.items[slot].q-=q;c.items[dest]={name:'hpot0',q};}else if(name==='bank_store'){const [slot,pack,dest]=args;c.bank[pack][dest]=c.items[slot];c.items[slot]=null;}else assert.fail(name);return Promise.resolve();};
 assert.equal(bot.bank.retrieve({name:'hpot0'},rule,5),true);await Promise.resolve();bot.exec.poll();assert.equal(bot.economy.count({name:'hpot0'}),100);assert.equal(bot.bank.pending,true);
 assert.equal(bot.economy.perform('sell',{call:()=>assert.fail('No sell while temporary excess is held'),observe:()=>true}),false);
 bot.bank=createBank(bot);bot.cfg.merchant.bank=false;assert.equal(bot.bank.recover(),true);await Promise.resolve();bot.exec.poll();assert.equal(c.items[1].q,85);assert.equal(c.items[2].q,5);
 bot.bank=createBank(bot);bot.bank.recover();await Promise.resolve();bot.exec.poll();bot.bank.recover();assert.equal(bot.bank.pending,false);assert.equal(bot.economy.count({name:'hpot0'}),15);assert.equal(c.bank.items0[0].q,85);assert.deepEqual(calls,['bank_retrieve','split','bank_store']);assert.equal(bot.economy.remaining(rule),false);advance();
});

test('partial bank rejects disabled, oversized and protected stacks and never retries an ambiguous withdrawal',async()=>{
 for(const mode of ['disabled','oversize','protected','unknown','changed']){
  const {bot,c,rule,advance}=fixture();rule.action='retrieve';rule.batch=5;rule.maxCount=15;c.bank.items0[0]={name:'hpot0',q:90};bot.cfg.merchant.partialBank=mode!=='disabled';bot.cfg.merchant.partialBankMaxStack=mode==='oversize'?80:100;if(mode==='protected')c.bank.items0[0].l='locked';let calls=0;
  bot.p.call=()=>{calls++;if(mode==='changed'){c.items[1]=c.bank.items0[0];c.bank.items0[0]=null;}return Promise.resolve();};
  const accepted=bot.bank.retrieve({name:'hpot0'},rule,5);assert.equal(accepted,['unknown','changed'].includes(mode));if(!accepted){assert.equal(calls,0);continue;}await Promise.resolve();if(mode==='unknown')advance();else{bot.exec.poll();c.items[1].q--;}
  bot.bank=createBank(bot);bot.bank.recover();assert.equal(bot.inventoryBlocked,true);assert.equal(calls,1);assert.equal(bot.bank.pending,true);
 }
});

test('Merrit accepts its own shell event, persists cooldown and never infers a gift from an unrelated cash change',()=>{
 const {bot,c,data}=fixture();bot.cfg.merchant.merrit=true;bot.cfg.merchant.stand=true;c.map=c.in='main';c.x=c.y=24;c.stand=true;c.slots.trade1={name:'hpot0',q:1,price:20};c.cash=0;bot.count=name=>c.items.reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);bot.p.entities={};bot.p.G.maps={main:{npcs:[]}};bot.p.G.npcs.citizen22={market:{areas:[[0,0,100,100]],hour_ms:3600000}};
 bot.services=createServices(bot);assert.equal(bot.services.merrit(),true);c.cash=10;assert.equal(bot.services.merrit(),true);assert.equal(bot.services.status().merritCooldownUntil,0);
 bot.services.observeMerrit({shells:1});assert.equal(bot.services.merrit(),false);assert.equal(bot.services.status().merritReward.source,'character-event');assert.equal(bot.services.status().merritReward.shells,1);assert.ok(data.get('albot:merrit:M')>Date.now());bot.services=createServices(bot);assert.equal(bot.services.merrit(),false);
});

test('Merrit ignores an old or foreign receipt and accepts a new receipt without a parcel increment',()=>{
 const {bot,c}=fixture();bot.cfg.merchant.merrit=true;bot.cfg.merchant.stand=true;c.map=c.in='main';c.x=c.y=24;c.stand=true;c.slots.trade1={name:'hpot0',q:1,price:20};bot.count=()=>0;bot.p.entities={};bot.p.G.maps={main:{npcs:[]}};bot.p.G.npcs.citizen22={market:{areas:[[0,0,100,100]],hour_ms:3600000}};c.merrit_receipt={id:'old',name:'M',at:Date.now(),shells:1};bot.services=createServices(bot);
 assert.equal(bot.services.merrit(),true);assert.equal(bot.services.merrit(),true);c.merrit_receipt={id:'foreign',name:'Other',at:Date.now(),shells:1};assert.equal(bot.services.merrit(),true);c.merrit_receipt={id:'new',name:'M',at:Date.now(),shells:1};assert.equal(bot.services.merrit(),false);assert.equal(bot.services.status().merritReward.source,'receipt');assert.equal(bot.services.status().merritReward.parcel,false);
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

test('helper comparison previews alternatives and dispatches the most profitable available scroll',async()=>{
 const {bot,c,rule,advance}=fixture();
 Object.assign(bot.cfg.production,{enabled:true,upgrade:true,autoHelpers:true,helperMaxPrice:1000,minChance:.65,minImprovement:.05,lossBudget:10000});
 Object.assign(rule,{item:'helmet',action:'upgrade',targetLevel:1,maxLevel:0,maxActions:1,lossBudget:5000,minChance:.65,_autoDisposition:true});bot.cfg.items=[rule];
 bot.account={spendAllowed:()=>true};
 c.items=[{name:'helmet',level:0},{name:'scroll0',q:2},{name:'scroll1',q:2},...Array(39).fill(null)];
 Object.assign(bot.p.G.items,{helmet:{upgrade:{}},scroll0:{type:'uscroll',grade:0,g:100},scroll1:{type:'uscroll',grade:1,g:600}});
 const previews=[],mutations=[];
 bot.p.call=(name,...args)=>{
  if(name==='find_npc')return {map:'bank',in:'bank',x:0,y:-100};if(name==='item_grade')return 0;
  if(name==='item_value')return args[0].name==='helmet'?(args[0].level?2000:1000):bot.p.G.items[args[0].name].g;
  assert.equal(name,'upgrade');const scroll=args[1];
  if(args.at(-1)===true){previews.push(scroll);return Promise.resolve({chance:scroll===1?.7:.9,cost:0});}
  mutations.push(scroll);c.items[0].level=1;c.items[scroll].q--;return Promise.resolve({success:true});
 };
 bot.production=createProduction(bot);
 for(let n=0;n<6&&!mutations.length;n++){
  bot.production.mutate(0,rule);await new Promise(r=>setImmediate(r));bot.exec.poll();advance();
 }
 assert.ok(previews.includes(1)&&previews.includes(2));assert.deepEqual(mutations,[1]);assert.equal(bot.journal,null);
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

test('NPC lookup skips unplaced sellers and buys potions from the nearest valid seller',async()=>{
 const {bot,c,rule}=fixture();c.map=c.in='main';c.x=c.y=0;bot.p.G.npcs={pots:{items:['hpot0']},fancypots:{items:['hpot0']},other:{items:['hpot0']}};const calls=[];bot.p.call=(name,...args)=>{if(name==='find_npc')return args[0]==='pots'?null:{map:args[0]==='other'?'remote':'main',in:args[0]==='other'?'remote':'main',x:0,y:0};if(name==='buy_with_gold'){calls.push(args);c.items[0].q+=args[1];c.gold-=20*args[1];return Promise.resolve();}throw Error(name);};
 assert.equal(bot.economy.npcFor('hpot0').map,'main');const buy={...rule,action:'buy',maxPrice:20};assert.equal(bot.economy.npcBuy({name:'hpot0'},buy,5),true);await Promise.resolve();bot.exec.poll();assert.deepEqual(calls,[['hpot0',5]]);assert.equal(bot.journal,null);
});

test('merchant with five free slots and four-slot minimum can unequip offhand for gathering',async()=>{
 const {bot,c}=fixture();const calls=[];
 bot.cfg.merchant.minFreeSlots=4;bot.cfg.merchant.mining=true;bot.cfg.merchant.fishing=false;bot.cfg.merchant.merrit=false;bot.cfg.merchant.massBuffs=false;
 c.map=c.in='main';c.x=16;c.y=0;c.level=60;c.mp=1000;c.slots={mainhand:{name:'staff'},offhand:{name:'shield'}};
 c.items=[{name:'pickaxe',level:0},...Array.from({length:36},()=>({name:'hpot0',q:1})),...Array(5).fill(null)];
 bot.free=()=>c.items.filter(i=>!i).length;
 bot.p.G.maps={main:{zones:[{type:'mining',polygon:[[-10,-10],[10,-10],[10,10],[-10,10]]}]}};
 bot.p.G.skills={mining:{level:16,mp:120}};
 bot.p.call=(name,...args)=>{
  if(name==='is_on_cooldown')return false;
  calls.push(name);if(name==='unequip'){const slot=c.items.findIndex(i=>!i);c.items[slot]=c.slots[args[0]];delete c.slots[args[0]];}
  return Promise.resolve();
 };
 bot.monsters=()=>[];
 const services=createServices(bot);
 assert.equal(bot.free(),5);
 assert.equal(services.tick(),true,'available fifth slot must be used to free offhand');
 await Promise.resolve();bot.exec.poll();
 assert.equal(c.slots.offhand,undefined);
 assert.equal(bot.free(),4);
 assert.ok(calls.includes('unequip'));
 assert.equal(bot.inventoryBlocked,false);
});

test('gear slot missing from sparse character.slots can still be equipped if class permits',()=>{
 const {bot,c}=fixture();
 c.ctype='rogue';c.level=38;c.slots={mainhand:{name:'fireblade',level:0}};
 c.items[0]={name:'poker',level:3};
 bot.cfg.production.gear=true;bot.cfg.production.minImprovement=.01;
 bot.me.gearRole='auto';bot.me.role='farmer';
 bot.p.G.items={...bot.p.G.items,poker:{type:'gloves'},fireblade:{type:'weapon',wtype:'sword'}};
 bot.p.G.classes={rogue:{mainhand:{sword:true},offhand:{dagger:true}}};
 bot.p.call=(name)=>{if(name==='item_properties')return {attack:20,dex:6,hp:100};return null;};
 let called=false;
 bot.economy.perform=(name,options)=>{called=true;assert.equal(name,'gear.equip');assert.equal(options.details.slot,'gloves');return true;};
 bot.allocation={equipGuard:()=>true};
 bot.teamNames=['M'];
 bot.gear=createGear(bot);
 assert.equal(Object.hasOwn(c.slots,'gloves'),false);
 assert.equal(bot.gear.equip(0,{slot:'gloves'}),true);
 assert.equal(called,true);
});

test('NPC working range stops 25 units short of the server 400 limit without changing regular travel',()=>{
 const {bot,c}=fixture(),economy=bot.economy,move=[];
 const npc={map:'main',in:'main',x:0,y:0};
 c.map=c.in='main';c.x=375;c.y=0;c.moving=false;
 bot.movement.go=(dest,owner)=>{move.push({dest,owner});return false;};
 assert.equal(economy.npcAt(npc),true);
 assert.equal(economy.npcTravel(npc,'NPC shop'),true);
 assert.equal(move.length,0,'no movement when already safely within the interaction radius');
 c.x=376;
 assert.equal(economy.npcAt(npc),false);
 assert.equal(economy.npcTravel(npc,'NPC shop'),false);
 assert.equal(move.length,1);
 assert.equal(move[0].dest.radius,375);
 assert.equal(move[0].owner,'economy');
 assert.equal(economy.at(npc),false,'unrelated strict 110-distance test must stay unchanged');
 assert.equal(economy.travel(npc,'Bank'),false);
 assert.equal(move[1].dest.radius,90,'general non-NPC travel range stays narrow');
});

test('NPC purchase and sale execute from 375 units, retaining server-side value observation',async()=>{
 const {bot,c,rule}=fixture();c.map=c.in='main';c.x=375;c.y=0;c.moving=false;
 bot.p.G.npcs={potions:{items:['hpot0']}};
 const calls=[];
 bot.p.call=(name,...args)=>{
  if(name==='find_npc')return {map:'main',in:'main',x:0,y:0};
  if(name==='item_value')return 20;
  calls.push(name);
  if(name==='buy_with_gold'){c.items[0].q+=args[1];c.gold-=20*args[1];return Promise.resolve();}
  if(name==='sell'){c.items[0].q-=args[1];c.gold+=20*args[1];return Promise.resolve();}
  throw Error('unexpected '+name);
 };
 rule.action='buy';rule.maxPrice=20;
 assert.equal(bot.economy.npcBuy({name:'hpot0',level:0},rule,2),true);
 await Promise.resolve();bot.exec.poll();
 assert.equal(bot.journal,null);assert.ok(calls.includes('buy_with_gold'));
 rule.action='sell';rule.minPrice=1;rule.batch=2;
 assert.equal(bot.economy.npcSell(0,rule),true);
 await Promise.resolve();bot.exec.poll();
 assert.equal(bot.journal,null);assert.ok(calls.includes('sell'));
});

test('unsafe auto-sale budget denies NPC travel before choosing a destination',()=>{
 const {bot,c,rule}=fixture();c.items[0]={name:'claw',level:0};bot.p.G.items.claw={g:5};
 rule.action='sell';rule.item='claw';rule.minPrice=1;rule._autoDisposition=true;rule.batch=1;
 let queries=0,moves=0;
 bot.p.call=name=>{if(name==='item_value')return 1;if(name==='find_npc'){queries++;return {map:'main',x:1,y:1};}throw Error('unexpected '+name);};
 bot.movement.go=()=>{moves++;return true;};bot.account={spendAllowed:()=>false};
 assert.equal(bot.economy.npcSell(0,rule),false);assert.equal(queries,0);assert.equal(moves,0);
});
test('bank reclaim requires explicit sale rule rather than synthetic auto-disposition',()=>{
 const {bot,c}=fixture();bot.cfg.production.autoDisposition=true;bot.cfg.merchant.bankReclaim=true;
 c.bank.items0=Array.from({length:42},()=>({name:'blocked',l:true}));
 c.bank.items0[3]={name:'cxjar',level:0,data:'makeawish'};bot.p.G.items.cxjar={g:1,upgrade:true};
 bot.intelligence={disposition:()=>({...defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.items.items),item:'cxjar',action:'sell',batch:1,minPrice:1})};
 bot.p.call=name=>{if(name==='item_value')return 1;throw Error('Unexpected bank operation: '+name);};
 assert.equal(bot.bank.reclaim(),false);assert.equal(bot.journal,null);
});

test('bank store confirmation is based on exact source and bank slot despite other inventory gains',async()=>{
 const {bot,c,rule}=fixture();c.items[0]={name:'hpot0',q:10};
 let called=false;
 bot.p.call=(name,source,pack,dest)=>{
  assert.equal(name,'bank_store');
  assert.equal(source,0);
  // A separate incoming packet adds matching goods elsewhere. Aggregate
  // variantCount no longer reflects the amount this bank action transferred.
  c.items[1]={name:'hpot0',q:120};
  c.bank[pack][dest]={...c.items[source]};
  c.items[source]=null;called=true;
  return Promise.resolve();
 };
 assert.equal(bot.bank.store(0,rule),true);
 await Promise.resolve();bot.exec.poll();
 assert.equal(called,true);
 assert.equal(bot.economy.count({name:'hpot0'}),120);
 assert.equal(bot.journal,null);
 assert.equal(bot.inventoryBlocked,false);
});
test('bank store does not confirm when the source remains and the destination was unchanged',async()=>{
 const {bot,c,rule,advance}=fixture();
 bot.p.call=name=>{assert.equal(name,'bank_store');return Promise.resolve();};
 assert.equal(bot.bank.store(0,rule),true);
 await Promise.resolve();advance();
 assert.equal(bot.inventoryBlocked,true);
 assert.equal(bot.journal?.kind,'bank.store');
});

test('v3-aligned merchant merges safe matching inventory stacks via official swap',async()=>{
 const {bot,c}=fixture();c.items[0]={name:'hpot0',q:10};c.items[1]={name:'hpot0',q:20};
 let count=0;bot.p.call=(method,a,b)=>{assert.equal(method,'swap');assert.deepEqual([a,b],[0,1]);count++;c.items[a].q+=c.items[b].q;c.items[b]=null;return Promise.resolve();};
 assert.equal(bot.bank.consolidateInventory(),true);await Promise.resolve();bot.exec.poll();
 assert.equal(count,1);assert.equal(c.items[0].q,30);assert.equal(c.items[1],null);assert.equal(bot.journal,null);
});
test('inventory consolidation rejects overflow, locked items and custom variants',()=>{
 const {bot,c}=fixture();c.items[0]={name:'hpot0',q:5000};c.items[1]={name:'hpot0',q:5000};
 assert.equal(bot.bank.consolidateInventory(),false);
 c.items[1]={name:'hpot0',q:10,l:'locked'};assert.equal(bot.bank.consolidateInventory(),false);
 c.items[1]={name:'hpot0',q:10,data:'makeawish'};assert.equal(bot.bank.consolidateInventory(),false);
});
test('existing bank stacks consolidate through bank_swap and are verified',async()=>{
 const {bot,c}=fixture();bot.cfg.merchant.consolidate=true;
 c.bank.items0[0]={name:'hpot0',q:7};c.bank.items0[1]={name:'hpot0',q:9};
 bot.p.call=(name,pack,a,b)=>{assert.equal(name,'bank_swap');assert.equal(pack,'items0');c.bank[pack][b].q+=c.bank[pack][a].q;c.bank[pack][a]=null;return Promise.resolve();};
 assert.equal(bot.bank.consolidate(),true);await Promise.resolve();bot.exec.poll();
 assert.equal(c.bank.items0[0],null);assert.equal(c.bank.items0[1].q,16);assert.equal(bot.journal,null);
});
test('full-bank reclaim selects the least-value eligible explicit-sale candidate',async()=>{
 const {bot,c,rule}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.bankWorkspace=2;bot.cfg.merchant.expandBank=false;
 c.bank.items0=Array.from({length:42},()=>({name:'reserved',l:true}));
 c.bank.items0[2]={name:'expensive',q:1};c.bank.items0[30]={name:'cheap',q:1};
 bot.p.G.items.expensive={g:10000};bot.p.G.items.cheap={g:2};
 bot.cfg.items=[
  {...rule,name:'Expensive sale',item:'expensive',action:'sell',batch:1,maxCount:1000,minPrice:1},
  {...rule,name:'Cheap sale',item:'cheap',action:'sell',batch:1,maxCount:1000,minPrice:1}
 ];
 let chosen=-1;
 bot.p.call=(name,...args)=>{
  if(name==='item_value')return bot.p.G.items[args[0].name]?.g??Infinity;
  if(name==='bank_retrieve'){const [pack,slot,dest]=args;chosen=slot;c.items[dest]=c.bank[pack][slot];c.bank[pack][slot]=null;return Promise.resolve();}
  throw Error('unexpected '+name);
 };
 bot.decisionEpoch=0;assert.equal(bot.bank.reclaim(),false,'first pressure reading cannot start destructive recovery');bot.decisionEpoch=1;assert.equal(bot.bank.reclaim(),true);await Promise.resolve();bot.exec.poll();
 assert.equal(chosen,30);assert.equal(bot.journal,null);
});
test('full bank never silently sells unique-data jar even if synthetic sell policy requests it',()=>{
 const {bot,c,rule}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.expandBank=false;bot.cfg.merchant.bankWorkspace=2;bot.cfg.production.autoDisposition=true;
 c.bank.items0=Array.from({length:42},()=>({name:'cxjar',data:'makeawish',q:1}));
 bot.p.G.items.cxjar={g:1,type:'material',s:9999};
 bot.intelligence={disposition:()=>({...rule,enabled:true,item:'cxjar',action:'sell',minPrice:1,_autoDisposition:true})};
 bot.p.call=(name)=>{if(name==='item_value')return 1;throw Error('unexpected mutation '+name);};
 assert.equal(bot.bank.reclaim(),false);assert.equal(bot.journal,null);
});

test('idle bank recovery does not buy bank capacity while many free slots remain',()=>{
 const {bot,c}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.expandBank=true;
 bot.cfg.merchant.bankWorkspace=2;bot.cfg.merchant.bankBudget=1000;
 bot.p.G.bank_packs={items0:['bank',100],items1:['bank',100]};
 let calls=0;bot.p.call=(method)=>{calls++;throw Error('Unexpected bank purchase '+method);};
 assert.equal(bot.bank.reclaim(),false);
 assert.equal(c.bank.items0.filter(i=>!i).length,42);
 assert.equal(calls,0);
});
test('a high-value upgrade item is not a valid bank emergency sale even with explicit SELL rule',()=>{
 const {bot,c,rule}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.expandBank=false;bot.cfg.merchant.bankWorkspace=2;
 c.bank.items0=Array.from({length:42},()=>({name:'protected',l:true}));c.bank.items0[0]={name:'sword',q:1};
 bot.p.G.items.sword={g:5,upgrade:true};
 bot.cfg.items=[{...rule,name:'SWORD',item:'sword',action:'sell',batch:1,maxCount:1000,minPrice:1}];
 bot.p.call=name=>{if(name==='item_value')return 5;throw Error('No bank mutation allowed '+name);};
 assert.equal(bot.bank.reclaim(),false);
 assert.equal(bot.journal,null);
});

test('audit M04 trade_sell confirms server-rounded net proceeds and exact item loss',async()=>{
 const {bot,c,rule}=fixture();
 c.map=c.in='main';c.x=c.y=0;c.tax=.05;
 c.items=[{name:'hpot0',q:2},...Array(41).fill(null)];
 Object.assign(rule,{enabled:true,name:'Explicit approved sale',action:'sell',batch:2,keep:0,teamReserve:0,minPrice:1,maxCount:1000});
 bot.cfg.items=[rule];bot.p.has=()=>true;
 const offer={name:'hpot0',level:0,b:true,q:2,price:100,rid:'buyer-bid'};
 const buyer={name:'Buyer',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:offer}};
 bot.p.entities={Buyer:buyer};bot.entity=()=>buyer;
 bot.p.call=(name,...args)=>{
  if(name==='item_value')return 20;
  assert.equal(name,'trade_sell');assert.deepEqual(args,[buyer,'trade1',2]);
  c.items[0]=null;c.gold+=190;return Promise.resolve();
 };
 bot.market=createMarket(bot);
 assert.equal(bot.market.sellToBid(0,rule),true);
 await Promise.resolve();bot.exec.poll();
 assert.equal(bot.journal,null);
 assert.equal(bot.inventoryBlocked,false);
});
test('audit M04 unrelated gold gain cannot falsely confirm a partially observed trade',async()=>{
 const {bot,c,rule,advance}=fixture();c.map=c.in='main';c.x=c.y=0;c.tax=.05;
 c.items=[{name:'hpot0',q:2},...Array(41).fill(null)];
 Object.assign(rule,{enabled:true,name:'Explicit sale',action:'sell',batch:2,keep:0,teamReserve:0,minPrice:1,maxCount:1000});
 bot.cfg.items=[rule];bot.p.has=()=>true;
 const buyer={name:'Buyer',type:'character',stand:true,map:'main',in:'main',x:10,y:0,slots:{trade1:{name:'hpot0',level:0,b:true,q:2,price:100,rid:'bid'}}};
 bot.p.entities={Buyer:buyer};bot.entity=()=>buyer;
 bot.p.call=name=>{if(name==='item_value')return 20;c.items[0]=null;c.gold+=250;return Promise.resolve();};
 bot.market=createMarket(bot);
 assert.equal(bot.market.sellToBid(0,rule),true);
 await Promise.resolve();advance();
 assert.equal(bot.inventoryBlocked,true);assert.equal(bot.journal?.kind,'market.sell');
});

test('audit M05 temporary bank pressure is cleared by another available pack',()=>{
 const {bot,c}=fixture();bot.cfg.merchant.bankReclaim=true;bot.cfg.merchant.bankWorkspace=2;
 c.bank.items0=Array.from({length:42},()=>({name:'protected',l:true}));
 c.bank.items1=Array(42).fill(null);bot.p.G.bank_packs={items0:['bank',100],items1:['bank',100]};
 bot.decisionEpoch=1;assert.equal(bot.bank.reclaim(),false);
 assert.equal(bot.bank.pressureStatus().observations,0);
});

test('audit bank.retrieve cannot complete from unrelated same-variant bank and bag changes',async()=>{
 const {bot,c,rule,advance}=fixture();rule.action='retrieve';rule.batch=20;rule.maxCount=1000;
 c.bank.items0[0]={name:'hpot0',q:5};
 c.bank.items0[1]={name:'hpot0',q:5};
 c.items[0]=null;
 let dispatched=0;
 bot.p.call=(name,pack,source,dest)=>{
  assert.equal(name,'bank_retrieve');assert.equal(source,0);assert.equal(dest,0);
  // Simulate unrelated transfer with precisely the same aggregate delta.
  c.bank.items0[1]=null;c.items[2]={name:'hpot0',q:5};dispatched++;
  return Promise.resolve();
 };
 assert.equal(bot.bank.retrieve({name:'hpot0'},rule,5),true);
 await Promise.resolve();advance();
 assert.equal(dispatched,1);assert.equal(bot.inventoryBlocked,true);
 assert.equal(bot.journal?.kind,'bank.retrieve');
 assert.deepEqual(c.bank.items0[0],{name:'hpot0',q:5});
 assert.equal(c.items[0],null);
});
