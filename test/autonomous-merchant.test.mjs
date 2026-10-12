import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeDrops,materialDrops} from '../src/production/materials.mjs';
import {itemPurposes} from '../src/items/purposes.mjs';
import {assessCombat} from '../src/world/risk.mjs';
import {saleReceiptMatches} from '../src/merchant/economy.mjs';
import {createLearning} from '../src/world/learning.mjs';
import {createCloudSync} from '../src/world/cloud.mjs';
import {reserveBudget,validSnapshot,boundedText,BudgetLedger} from '../cloud/worker.mjs';
import {bestMutationHelper} from '../src/production/helpers.mjs';
import {tokenOffer,dismantleOutputs,createConversions} from '../src/production/conversions.mjs';
import {createSupplies} from '../src/items/supplies.mjs';

test('exchange weights normalize while independent monster probabilities do not',()=>{
 const G={drops:{nested:[[8,'a'],[2,'b']]}};
 assert.deepEqual(exchangeDrops(G,[[80,'a'],[20,'b']]),[{item:'a',chance:.8,quantity:1},{item:'b',chance:.2,quantity:1}]);
 assert.equal(materialDrops(G,[[.8,'a'],[.8,'b']]).reduce((s,r)=>s+r.chance,0),1.6);
 assert.equal(exchangeDrops(G,[[2,'open','nested'],[2,null]])[0].chance,.4);
 assert.deepEqual(exchangeDrops(G,[[NaN,'a']]),[]);
});
test('functional purposes precede price and preserve exact recipe levels',()=>{
 const G={items:{blade:{upgrade:true},monstertoken:{},cryptkey:{},xptome:{},poison:{}},
  skills:{poisonarrow:{consume:'poison'}},craft:{sword:{items:[[2,'blade',4]]}}};
 for(const name of ['monstertoken','cryptkey','xptome','poison'])assert.equal(itemPurposes(G,{name}).protected,true,name);
 assert.equal(itemPurposes(G,{name:'blade',level:4}).recipes.length,1);
 assert.equal(itemPurposes(G,{name:'blade',level:3}).recipes.length,0);
 assert.equal(itemPurposes(G,{name:'missing'}).protected,true);
});
test('receipt requires exact variant quantity and proceeds, not merely success',()=>{
 const item={name:'carrot',q:2};
 assert.equal(saleReceiptMatches({success:true,gold:20,item},item,2,20),true);
 assert.equal(saleReceiptMatches({success:true,gold:200,item},item,2,20),false);
 assert.equal(saleReceiptMatches({success:true,gold:20,item:{name:'carrot',p:'shiny',q:2}},item,2,20),false);
 assert.equal(saleReceiptMatches({success:true},item,2,20),false);
});
test('Pink Goo is evaluated by effective hits and healing is subtracted',()=>{
 const members=Array.from({length:3},()=>({hp:10000,max_hp:10000,attack:2000,frequency:2}));
 const result=assessCombat({hp:40,attack:100,frequency:1,'1hp':true,avoidance:98},members);
 assert.equal(result.safe,false);assert.ok(result.seconds>300);
 assert.equal(assessCombat({hp:100,attack:1,frequency:1,abilities:{self_healing:{heal:20000,cooldown:1000}}},members).safe,false);
 assert.equal(assessCombat({hp:100,attack:1,frequency:1,abilities:{multi_burn:{damage:4000,cooldown:24000}}},members).safe,false);
});
function learningFixture(){const memory=new Map();const bot={me:{name:'M',role:'merchant'},running:true,
 p:{G:{version:1},root:{},realm:()=> 'EUI',read:k=>memory.get(k),write:(k,v)=>{memory.set(k,structuredClone(v));return true;}}};return {bot,memory};}
test('learning survives reload, distinguishes random failure and invalidates changed G',()=>{
 const {bot}=learningFixture();let l=createLearning(bot);
 l.observe('action.end',{key:'buy',result:'unknown'});l.observe('action.end',{key:'buy',result:'unknown'});
 assert.equal(l.retryDelay('buy'),12000);l.flush(true);l=createLearning(bot);assert.equal(l.retryDelay('buy'),12000);
 l.observe('action.end',{key:'upgrade',result:'confirmed',outcome:'randomFailure'});
 assert.equal(l.retryDelay('upgrade'),3000);assert.equal(l.status().rows.find(r=>r.key==='upgrade').randomFailures,1);
 bot.p.G.version=2;assert.equal(l.retryDelay('buy'),3000);
});
test('cloud is opt-in and provider credentials never belong in payload',async()=>{
 const {bot}=learningFixture();let calls=0;bot.p.root.fetch=async()=>{calls++;return new Response(null,{status:204});};
 let cloud=createCloudSync(bot);await cloud.tick();assert.equal(calls,0);
 bot.p.root.ALBotCloudConfig={enabled:true,url:'https://albot-new.example.workers.dev',token:'x'.repeat(32)};
 bot.learning={status:()=>({rows:[]})};cloud=createCloudSync(bot);await cloud.tick();await cloud.tick();assert.equal(calls,1);
 assert.equal(JSON.stringify(cloud.status()).includes('xxxxxxxx'),false);
});
test('central budget is bounded across days and corrupt counters fail closed',()=>{
 const t=Date.now();let state=null;
 for(let n=0;n<24;n++)state=reserveBudget(state,100,t);
 assert.equal(reserveBudget(state,100,t),null);
 assert.equal(reserveBudget(state,100,t+86400000).totalBytes,2500);
 assert.equal(reserveBudget({...state,totalBytes:1048576},1,t+86400000),null);
 assert.equal(reserveBudget({...state,requests:-1},100,t),null);
});
test('helpers maximize net result rather than raw success chance and retain ultimate failure value',()=>{
 const inputs={inputValue:1000,outputValue:2000,minChance:.65,margin:.05};
 const chosen=bestMutationHelper([{scroll:'cheap',chance:.7,cost:100},{scroll:'dear',chance:.9,cost:600}],inputs);
 assert.equal(chosen.scroll,'cheap');assert.equal(chosen.ev,1300);
 assert.equal(bestMutationHelper([{chance:.7,cost:600}],inputs).action,'sell');
 assert.equal(bestMutationHelper([{chance:.7,cost:600,preserves:true}],inputs).action,'upgrade');
 assert.equal(bestMutationHelper([{chance:.4,cost:100}],{...inputs,factor:3,outputValue:5000}).action,'sell');
});
test('token fractions, nonvariant shop outputs and deterministic dismantle have distinct quantities',()=>{
 const G={tokens:{funtoken:{confetti:.2,coat:5,'jar-special':2}},items:{coat:{},mat:{},ring:{compound:true}},dismantle:{coat:{cost:40,items:[[2,'mat']]}}};
 assert.deepEqual(tokenOffer(G,'funtoken','confetti'),{cost:1,quantity:5});
 assert.equal(tokenOffer(G,'funtoken','jar-special'),null);
 assert.deepEqual(dismantleOutputs(G,{name:'coat'},100),{cost:40,outputs:[{name:'mat',level:0,quantity:2}]});
 assert.deepEqual(dismantleOutputs(G,{name:'ring',level:2},100),{cost:1000,outputs:[{name:'ring',level:1,quantity:3}]});
 G.dismantle.coat.items=[[.5,'mat']];assert.equal(dismantleOutputs(G,{name:'coat'},100),null);
});
test('cloud payload rejects arbitrary text, identities and oversize streams',async()=>{
 const snapshot={version:1,character:'M',at:Date.now(),learning:[]};
 assert.equal(validSnapshot(snapshot,['M']),true);assert.equal(validSnapshot(snapshot,['A']),false);
 assert.equal(validSnapshot({...snapshot,token:'secret'},['M']),false);
 await assert.rejects(()=>boundedText(new Request('https://test',{method:'POST',body:'x'.repeat(16385)})));
});
test('cloud backend remains closed without verified current free budgets',async()=>{
 let storageCalls=0;const ledger=new BudgetLedger({storage:{transaction(){storageCalls++;}}},{FREE_PLANS_CONFIRMED:'false'});
 const r=await ledger.fetch(new Request('https://test'));assert.equal(r.status,503);assert.equal(storageCalls,0);
});

test('recipe reserves sum repeated ingredients and malformed quantities protect the item',()=>{
 const G={items:{mat:{}},craft:{out:{items:[[2,'mat'],[3,'mat']]}}};
 assert.equal(itemPurposes(G,{name:'mat'}).recipes[0].quantity,5);
 G.craft.out.items.push([NaN,'mat']);assert.equal(itemPurposes(G,{name:'mat'}).protected,true);
});

test('token purchase revalidates reduced goal and token budget immediately before dispatch',()=>{
 const {bot}=learningFixture();let pending,calls=0;
 const goal={name:'goal',enabled:true,item:'coat',quantity:1,level:0,budget:100};
 bot.cfg={production:{enabled:true,tokenBuy:true,tokenMaxPerPurchase:5,goals:[goal],lossBudget:100},merchant:{minFreeSlots:2}};
 bot.p.c={items:[{name:'token',q:10},null]};bot.p.G={items:{token:{npc:'tokens'},coat:{}},tokens:{token:{coat:5}}};
 bot.free=()=>10;bot.p.has=()=>true;bot.p.call=()=>{calls++;};
 bot.production={reservedQuantity:()=>0};
 bot.economy={safe:i=>!!i,count:i=>i.name==='token'?10:0,explicit:()=>null,rules:()=>null,value:()=>1,
  destination:()=>({}),npcTravel:()=>true,npcAt:()=>true,perform:(key,job)=>{pending=job;return true;}};
 const conversions=createConversions(bot);assert.equal(conversions.tick(),true);assert.equal(pending.guard(),true);
 goal.quantity=0;assert.equal(pending.guard(),false);goal.quantity=1;
 bot.cfg.production.tokenMaxPerPurchase=1;assert.equal(pending.guard(),false);assert.equal(calls,0);
});

test('skill supply requests survive reload and become bounded same-realm delivery goals',()=>{
 const {bot}=learningFixture();let held=0;
 bot.me={name:'R',role:'farmer'};bot.p.c={ctype:'ranger',level:30};
 bot.cfg={skills:[{enabled:true,skill:'poisonarrow',role:'farmer'}],production:{skillSupplies:true,skillSupplyCount:20,helperMaxPrice:500}};
 bot.p.G={items:{poison:{}},skills:{poisonarrow:{class:['ranger'],level:20,consume:'poison'}}};
 bot.economy={explicit:()=>null};bot.count=()=>held;
 const first=createSupplies(bot).request();assert.equal(first[0].quantity,20);
 assert.deepEqual(createSupplies(bot).request(),first);
 held=20;assert.deepEqual(createSupplies(bot).request(),[]);
 bot.me={name:'M',role:'merchant'};bot.p.c.ctype='merchant';bot.farmers=['R'];
 const peer={running:true,realm:'EUI',class:'ranger',supplies:first};bot.transport={fresh:()=>peer};
 const supplies=createSupplies(bot);assert.equal(supplies.goals()[0].recipient,'R');
 peer.realm='USI';assert.deepEqual(supplies.goals(),[]);
});

test('central storage reservation admits only 24 snapshots and duplicates never call providers',async()=>{
 const rows=new Map();let chain=Promise.resolve();
 const storage={transaction(fn){const work=chain.then(()=>fn({get:async k=>rows.get(k),put:async(k,v)=>{rows.set(k,v);}}));chain=work.catch(()=>{});return work;}};
 const now=Date.now(),ledger=new BudgetLedger({storage},{FREE_PLANS_CONFIRMED:'true',BUDGET_VERIFIED_AT:new Date(now).toISOString(),CHARACTERS:'M'});
 const request=at=>new Request('https://test',{method:'POST',body:JSON.stringify({version:1,character:'M',at,learning:[]})});
 const results=await Promise.all(Array.from({length:25},(_,n)=>ledger.fetch(request(now+n))));
 assert.equal(results.filter(r=>r.status===200).length,24);assert.equal(results[24].status,429);
 assert.equal((await ledger.fetch(request(now))).status,429);assert.equal(rows.get('budget').requests,24);
 assert.equal(reserveBudget(null,NaN),null);
});
