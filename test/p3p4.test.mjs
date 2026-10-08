import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor,validateProfile,addMissingDefaults} from '../editor/lib/contract.mjs';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {P3P4_DESCRIPTOR} from '../src/config/p3p4.mjs';
import {INTEGRATION_DESCRIPTOR} from '../src/config/live-c.mjs';
import {planProduction} from '../src/production/planner.mjs';
import {createProduction} from '../src/production/production.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {createGear} from '../src/production/gear.mjs';
import {createObservations} from '../src/production/observations.mjs';
import {Executor} from '../src/core/executor.mjs';
import {estimateRoutes} from '../src/production/costs.mjs';
import {createServices} from '../src/merchant/services.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';

function fixture(){
 const cfg=defaultsFor(P3P4_DESCRIPTOR.schema);cfg.production.enabled=cfg.production.autonomy=cfg.production.gear=true;cfg.production.upgrade=true;cfg.production.lossBudget=1000;cfg.production.acquireBy=['npc','craft'];cfg.merchant.goldReserve=0;cfg.party.merchant='M';
 cfg.characters=['M','A','B'].map(name=>({...defaultsFor(P3P4_DESCRIPTOR.schema.properties.characters.items),name,class:name==='M'?'merchant':'ranger',role:name==='M'?'merchant':'farmer',goldReserve:0}));
 const c={name:'M',ctype:'merchant',level:60,gold:10000,map:'main',in:'main',x:0,y:0,items:Array(42).fill(null),slots:{helmet:null},q:{}},data=new Map();
 const bot={cfg,me:cfg.characters[0],running:true,inventoryBlocked:false,journal:null,checkpoint:{durable:true},teamNames:['M','A','B'],farmers:['A','B'],free:()=>c.items.filter(i=>!i).length,logistics:{reserved:false},bank:{packs:()=>[],pending:false},transport:{fresh:()=>null},movement:{go:()=>false},report(){},event(){},p:{c,entities:{},G:{items:{helmet:{g:10,type:'helmet',upgrade:{},grades:[7,8]},scroll0:{g:100,s:9999}},npcs:{potions:{items:['helmet','scroll0']}},craft:{},classes:{ranger:{}}},realm:()=> 'EUII',read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;},call:(name,item)=>name==='find_npc'?{map:'main',in:'main',x:0,y:0}:name==='item_grade'?0:name==='item_properties'?{attack:(item.level??0)+1}:name==='item_value'?10:null},beginValue(j){this.journal=j;},endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
 bot.exec=new Executor({now:()=>Date.now(),active:()=>bot.running,limit:4,onError(){}});bot.economy=createEconomy(bot);bot.production=createProduction(bot);bot.gear=createGear(bot);return {bot,c,cfg,data};
}

test('P3/P4 migration preserves old C values and validates unique account equipment slots',()=>{
 const old=defaultsFor(INTEGRATION_DESCRIPTOR.schema);old.general.autostart=false;old.characters=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'A'}];
 const next=addMissingDefaults(P3P4_DESCRIPTOR.schema,old);assert.equal(next.general.autostart,false);assert.equal(next.production.autonomy,false);assert.deepEqual(validateProfile(DESCRIPTOR,addMissingDefaults(DESCRIPTOR.schema,next)),[]);
 const target={...defaultsFor(P3P4_DESCRIPTOR.schema.properties.production.properties.gearTargets.items),character:'A',item:'helmet',slot:'helmet'};next.production.gearTargets=[target,{...target}];assert.ok(validateProfile(DESCRIPTOR,addMissingDefaults(DESCRIPTOR.schema,next)).some(s=>s.includes('doppeltes')));
});
test('dependency plan includes shared scroll/offering stocks and recipe output aliases',()=>{
 const G={items:{helmet:{upgrade:{}},scroll0:{},offering:{}},craft:{alias:{output:{name:'result'},cost:1,items:[[2,'helmet',1]]}}};
 const plan=planProduction({G,item:'result',stock:()=>0,bank:()=>0,canBuy:n=>['helmet','scroll0','offering'].includes(n),allowed:['npc','craft'],helpers:()=>[{item:'scroll0',quantity:1},{item:'offering',quantity:1}]});
 assert.equal(plan.find(s=>s.item==='helmet'&&s.kind==='buy').quantity,2);assert.equal(plan.find(s=>s.item==='scroll0').quantity,2);assert.equal(plan.find(s=>s.item==='offering').quantity,2);assert.equal(plan.at(-1).recipe,'alias');
});
test('route comparison includes ingredients, travel, time value and missing market observations',()=>{
 const options={G:{items:{x:{},base:{}},craft:{x:{cost:5,items:[[2,'base']]}}},item:'x',quantity:1,allowed:['npc','craft','market','farm'],npcPrice:n=>n==='x'?100:20,marketPrice:()=>Infinity,farmHours:()=>2,travelHours:kind=>kind==='buy'?.01:0,strategy:'balanced',goldPerHour:100};
 const routes=estimateRoutes(options);assert.equal(routes[0].kind,'craft');assert.equal(routes[0].gold,45);assert.ok(routes[0].hours>=.01);assert.equal(routes.some(x=>x.kind==='marketBuy'),false);assert.equal(estimateRoutes({...options,strategy:'cost'})[0].kind,'farm');
});
test('planner chooses bounded alternatives and explicit keep blocks an automatic acquisition',()=>{
 const {bot,cfg}=fixture();cfg.production.goals=[{name:'Helmet',enabled:true,item:'helmet',level:1,quantity:1,recipient:'A',budget:1000,priority:1}];bot.production.planGoals();assert.deepEqual(bot.production.status().steps.map(s=>s.item),['helmet','scroll0','helmet']);assert.equal(bot.economy.rules({name:'scroll0',level:0},'acquisition').action,'buy');
 cfg.items=[{...defaultsFor(P3P4_DESCRIPTOR.schema.properties.items.items),item:'scroll0',action:'keep'}];bot.production.planGoals();assert.equal(bot.production.status().steps.length,0);assert.equal(bot.economy.rules({name:'scroll0',level:0},'acquisition').action,'keep');
 const plan=planProduction({G:{items:{x:{g:10}}},item:'x',stock:()=>0,bank:()=>0,canBuy:()=>true,allowed:['npc','market'],score:s=>s.kind==='marketBuy'?1:10});assert.equal(plan[0].kind,'marketBuy');
});
test('account assigns a scarce output to the highest goal and persists confirmed delivery',()=>{
 const {bot,c,cfg}=fixture();const goal={name:'First',enabled:true,item:'helmet',level:0,quantity:1,recipient:'A',budget:1000,priority:10};cfg.production.goals=[goal,{...goal,name:'Second',recipient:'B',priority:0}];c.items[0]={name:'helmet'};
 bot.production.planGoals();assert.equal(bot.production.activeGoal.name,'First');assert.deepEqual(bot.production.effectiveRules().filter(r=>r.action==='send').map(r=>r.recipient),['A']);assert.equal(bot.production.recordDelivery({kind:'send',id:'transfer1',to:'A',item:{name:'helmet',level:0},quantity:1}),true);
 bot.production=createProduction(bot);assert.deepEqual(bot.production.effectiveRules().filter(r=>r.action==='send').map(r=>r.recipient),['B']);
});
test('recipe preparation merges identical stacks once and observes both quantity and slot release',async()=>{
 const {bot,c,cfg}=fixture();cfg.production.craft=true;bot.p.G.items.herb={s:9999};bot.p.G.items.result={};bot.p.G.craft.alias={cost:1,output:{name:'result'},items:[[5,'herb']]};c.items[0]={name:'herb',q:2};c.items[1]={name:'herb',q:3};let calls=0;
 const original=bot.p.call;bot.p.call=(name,...args)=>{if(name!=='swap')return original(name,...args);calls++;assert.deepEqual(args,[0,1]);c.items[0].q=5;c.items[1]=null;return Promise.resolve();};
 const r={...defaultsFor(P3P4_DESCRIPTOR.schema.properties.items.items),item:'result',action:'craft',recipe:'alias',targetCount:1,maxCount:1,maxActions:1};assert.equal(bot.production.craft('result',r),true);await Promise.resolve();bot.exec.poll();assert.equal(calls,1);assert.equal(bot.journal,null);assert.equal(bot.economy.remaining(r),true);
});
test('ready craft inputs stay reserved while surplus is available and completed own targets are not consumed',()=>{
 const {bot,c,cfg}=fixture();cfg.production.craft=true;bot.p.G.items.herb={s:9999};bot.p.G.items.result={};bot.p.G.craft.result={cost:1,items:[[5,'herb']]};c.items[0]={name:'herb',q:8};cfg.production.goals=[{name:'Result',enabled:true,item:'result',level:0,quantity:1,recipient:'',budget:1000,priority:0}];bot.production.planGoals();
 assert.equal(bot.production.status().steps[0].kind,'craft');assert.equal(bot.production.reservedQuantity(c.items[0]),5);const sell={...defaultsFor(P3P4_DESCRIPTOR.schema.properties.items.items),item:'herb',action:'sell'};assert.equal(bot.economy.spare(0,sell),3);
 cfg.production.goals.push({name:'Own herb reserve',enabled:true,item:'herb',level:0,quantity:4,recipient:'',budget:1000,priority:10});bot.production.planGoals();assert.equal(bot.production.status().steps.length,0);assert.equal(bot.economy.spare(0,sell),4); // No route to replace the missing unreserved fifth ingredient.
});

test('full operation yields an unavailable production goal while preserving its allocated ingredients',()=>{
 const {bot,c,cfg}=fixture();cfg.general.testLogging=true;cfg.production.craft=true;bot.p.G.items.herb={s:9999};bot.p.G.items.result={};bot.p.G.craft.result={cost:1,items:[[5,'herb']]};c.items[0]={name:'herb',q:8};
 cfg.production.goals=[{name:'Result',enabled:true,item:'result',level:0,quantity:1,recipient:'',budget:1000,priority:10},{name:'Other',enabled:true,item:'helmet',level:0,quantity:1,recipient:'',budget:1000,priority:0}];
 bot.production.planGoals();assert.equal(bot.production.activeGoal.name,'Result');bot.economy.travel=()=>false;assert.equal(bot.production.tick(),false);assert.equal(bot.production.status().waiting.length,1);
 bot.production.planGoals();assert.equal(bot.production.activeGoal.name,'Other');assert.equal(bot.production.reservedQuantity(c.items[0]),5);
});
test('one physical transfer satisfies one matching goal and replay does not spill into another',()=>{
 const {bot,cfg}=fixture(),g={name:'First',enabled:true,item:'helmet',level:0,quantity:1,recipient:'A',budget:1000,priority:10};cfg.production.goals=[g,{...g,name:'Second',priority:0}];const j={kind:'send',id:'same',to:'A',item:{name:'helmet',level:0},quantity:1};assert.equal(bot.production.recordDelivery(j),true);assert.equal(bot.production.recordDelivery(j),true);assert.deepEqual(bot.production.status().deliveries.map(x=>x.quantity),[1,0]);
});
test('farm observation excludes disappearance and foreign hits, resets on realm and uses explicit fallback',()=>{
 const {bot,c,cfg}=fixture();cfg.production.fallbackKillsPerHour=37;bot.entity=id=>id==='g'?{type:'monster',mtype:'goo'}:null;bot.observations=createObservations(bot);bot.observations.sample();bot.observations.death({id:'g'});bot.observations.hit({actor:'foreign',target:'g',damage:10});bot.observations.death({id:'g'});assert.equal(bot.observations.heartbeat().rows.length,0);
 bot.observations.hit({actor:'M',target:'g',damage:10});bot.observations.death({id:'g'});assert.equal(bot.observations.heartbeat().rows.length,0);bot.observations.hit({actor:'M',target:'g',damage:10,kill:true});bot.observations.death({id:'g',actor:'M'});assert.equal(bot.observations.heartbeat().rows[0].kills,1);assert.deepEqual(bot.observations.rate('goo'),{value:37,source:'configured-estimate'});bot.p.realm=()=> 'EUI';bot.observations.sample();assert.equal(bot.observations.heartbeat().rows.length,0);
});
test('fresh matching team contexts sum disjoint server-confirmed kills after sufficient observation',()=>{
 const originalNow=Date.now;let now=1000;Date.now=()=>now;
 try{const {bot,c}=fixture();bot.me=bot.cfg.characters[1];c.name='A';c.ctype='ranger';let performance=null;bot.transport.fresh=name=>name==='B'?{running:true,rip:false,realm:'EUII',class:'ranger',level:60,gear:{slots:{}},performance}:null;bot.entity=()=>({type:'monster',mtype:'goo'});bot.observations=createObservations(bot);bot.observations.sample();for(const id of ['g1','g2','g3'])bot.observations.hit({actor:'A',target:id,damage:10,kill:true});now+=60000;performance={...bot.observations.heartbeat(),rows:[{monster:'goo',kills:2}]};assert.deepEqual(bot.observations.rate('goo'),{value:300,source:'observed-team'});performance.team='different-team';assert.equal(bot.observations.rate('goo').value,180);
 }finally{Date.now=originalNow;}
});
test('an unavailable foreground market job does not repeatedly erase Merrit reward observation',()=>{
 const {bot,c,cfg}=fixture();cfg.production.enabled=false;cfg.merchant.merrit=cfg.merchant.stand=true;cfg.merchant.mluck=cfg.merchant.massBuffs=false;c.x=c.y=24;c.stand=true;bot.p.entities={};bot.p.G.maps={main:{npcs:[]}};bot.p.G.skills={};bot.p.G.items.herb={};bot.p.G.npcs.citizen22={market:{areas:[[0,0,100,100]]}};c.slots.trade1={name:'herb',q:1,price:20};
 bot.count=name=>c.items.reduce((n,i)=>n+(i?.name===name?i.q??1:0),0);bot.logistics.travel=()=>{};bot.bank.gold=bot.bank.consolidate=()=>false;bot.market={buy:()=>false,background:()=>false};cfg.items=[{...defaultsFor(P3P4_DESCRIPTOR.schema.properties.items.items),item:'whiteegg',action:'marketBuy',priority:100}];bot.services=createServices(bot);assert.equal(bot.services.merrit(),true);const merchant=createMerchant(bot);merchant.tick();merchant.tick();bot.services.observeMerrit({shells:1});assert.equal(bot.services.merrit(),false);assert.equal(bot.services.status().merritReward.source,'character-event');
});
