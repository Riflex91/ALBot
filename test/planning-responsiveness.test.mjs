import test from 'node:test';
import assert from 'node:assert/strict';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';
import {createGear} from '../src/production/gear.mjs';
import {createTestReport} from '../src/core/test-report.mjs';
import {estimateRoutes} from '../src/production/costs.mjs';
function fixture(count=3){
 const member={name:'M',role:'merchant',enabled:true,gearRole:'auto'};
 const G={version:1,items:{mat:{type:'material',g:1}},craft:{},classes:{merchant:{}}};
 for(let n=0;n<count;n++){G.items['hat'+n]={type:'helmet',g:10};G.craft['hat'+n]={items:[[1,'mat']],cost:1};}
 const profile={class:'merchant',level:60,slots:{}};
 let quotes=0,stats=0;
 const bot={decisionEpoch:0,me:member,teamNames:['M'],farmers:[],
  cfg:{general:{testLogging:true,planningTickMs:10000},characters:[member],party:{merchant:'M'},
   merchant:{budgetMode:'account-loss'},production:{gear:true,autoGear:true,optimizeGear:true,
    craft:true,autonomy:true,acquireBy:['farm','craft'],autoGearItems:[],gearTargets:[],
    autoGearBudget:1000,autoGearMaxLevel:0,minChance:.5,minImprovement:0,maxFarmHours:100,goldPerHour:10}},
  p:{G,c:{items:[],slots:{},ctype:'merchant',level:60},read:()=>null,realm:()=> 'EUII',
   call:(name,item)=>{if(name==='item_properties'){stats++;return {armor:10};}return 0;}},
  gear:{snapshot:()=>profile,profile:()=>profile},
  economy:{safe:()=>true,explicit:()=>null},transport:{peers:new Map(),fresh:()=>null},
  production:{estimateAcquisition:()=>{quotes++;return {gold:1,hours:1};}}};
 bot.intelligence=createEconomicIntelligence(bot);
 return {bot,get quotes(){return quotes;},get stats(){return stats;}};
}
function finish(intel){for(let n=0;n<10000;n++){intel.advance(8,Infinity);if(intel.status().planning.state==='ready')return;}assert.fail('planner failed to finish');}
test('live target and status reads never calculate; bounded slices publish only complete generations',()=>{
 const f=fixture(100),i=f.bot.intelligence;
 for(let n=0;n<10;n++){assert.deepEqual(i.targets(),[]);assert.deepEqual(i.status().targets,[]);}
 assert.equal(f.quotes,0);i.advance(3,Infinity);assert.ok(f.quotes<=3);
 assert.deepEqual(i.targets(),[]);assert.equal(i.status().planning.state,'calculating');
 finish(i);assert.equal(i.targets().length,1);assert.equal(f.quotes,100);
 const count=f.quotes;for(let n=0;n<100;n++)i.targets();assert.equal(f.quotes,count);
});
test('a quote longer than the cache interval cannot reenter evaluation and TTL starts at completion',()=>{
 const old=Date.now;let time=100000;Date.now=()=>time;
 try{const f=fixture(1),i=f.bot.intelligence;delete f.bot.decisionEpoch;let queries=0;
 f.bot.production.estimateAcquisition=()=>{queries++;time+=40000;assert.deepEqual(i.targets(),[]);return {gold:1,hours:1};};
 assert.equal(i.targets().length,1);assert.equal(queries,1);
 i.targets();assert.equal(queries,1);assert.equal(i.status().planning.completedAt,time);
 }finally{Date.now=old;}
});
test('invalidation discards partial work and diagnostic reads cannot restart it',()=>{
 const f=fixture(8),i=f.bot.intelligence;i.advance(2,Infinity);assert.ok(f.quotes>0);
 i.invalidate();f.bot.diagnosticRead=true;i.advance();i.targets();assert.equal(i.status().planning.state,'pending');
 f.bot.diagnosticRead=false;finish(i);assert.equal(i.status().planning.revision,1);
});
test('farmer does not duplicate account-wide craft acquisition searches',()=>{
 const f=fixture(20);f.bot.me.role='farmer';finish(f.bot.intelligence);
 assert.equal(f.quotes,0);assert.deepEqual(f.bot.intelligence.targets(),[]);
});
test('an unfinished merchant gear generation cannot prove equipment disposable',()=>{
 const f=fixture(1);f.bot.cfg.production.autoDisposition=true;
 const b=f.bot;b.p.G.items.hat0.upgrade={};b.p.G.items.scroll0={g:1};b.cfg.production.autoGearMaxLevel=1;
 b.gear.snapshot=()=>({class:'merchant',level:60,slots:{helmet:{name:'hat0',level:0}}});
 b.p.call=(name,item)=>name==='item_properties'?{armor:10+(item.level??0)*20}:0;
 assert.equal(f.bot.intelligence.gearUse({name:'hat0'}).state,'unknown');
 assert.equal(f.bot.intelligence.gearUse({name:'hat0'}).reason,'economic-gear-plan-pending');
 finish(f.bot.intelligence);assert.equal(f.bot.intelligence.gearUse({name:'hat0'}).state,'gear-useful');
});
test('gear diagnostics do not invoke goals or the optimizer',()=>{
 const f=fixture();f.bot.diagnosticRead=true;f.bot.intelligence.targets=()=>assert.fail('optimizer called by report');
 const gear=createGear(f.bot);assert.deepEqual(gear.status(),[]);assert.deepEqual(gear.goals(),[]);
});
test('continuous decision sampling uses its cheap provider, full report remains available',()=>{
 let full=0,cheap=0;const report=createTestReport({c:{name:'M',items:[]},G:{},realm:()=> 'EUII'},'test');
 report.configure({continuous:true});report.setProvider(()=>{full++;return {settings:{test:true}};},()=>{cheap++;return {production:{goal:'hat'}};});
 report.sample({running:true});assert.equal(cheap,1);assert.equal(full,0);
 assert.equal(report.document().settings.test,true);assert.equal(full,1);
});
test('exchange route catalog is decoded once per estimate, dynamic event evidence remains fresh',()=>{
 let scans=0;const items={token:{e:1},mat:{},hat:{}};
 const G={items:new Proxy(items,{ownKeys:t=>{scans++;return Reflect.ownKeys(t);}}),
  craft:{hat:{cost:1,items:[[1,'mat'],[1,'token']]}},drops:{token:[[1,'mat']]}};
 const options={G,item:'hat',allowed:['exchange','craft','farm'],farmHours:()=>1,npcPrice:()=>Infinity,marketPrice:()=>Infinity};
 assert.ok(estimateRoutes(options).length);assert.equal(scans,1);
 estimateRoutes(options);assert.equal(scans,2);
});

test('disabled optimizer does not create a perpetual gear-sale waiting state',()=>{
 const f=fixture(1),b=f.bot;b.cfg.production.optimizeGear=false;
 b.gear.snapshot=()=>({class:'merchant',level:60,slots:{helmet:{name:'hat0',level:0}}});
 b.intelligence.advance();assert.equal(b.intelligence.gearUse({name:'hat0'}).state,'no-gear-use');
});
