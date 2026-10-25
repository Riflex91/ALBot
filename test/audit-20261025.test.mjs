import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMovement} from '../src/core/movement.mjs';
import {chooseCommittedFarmArea} from '../src/world/team-plan.mjs';
import {createStrategy} from '../src/world/strategy.mjs';
import {marketRuleApproved} from '../src/merchant/market-purchase-policy.mjs';
import {createProduction} from '../src/production/production.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {Executor} from '../src/core/executor.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {ECONOMY_DESCRIPTOR} from '../src/config/live-b.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';
import {threatRegions,segmentThreatFree} from '../src/world/hazard-itinerary.mjs';
const G=JSON.parse(fs.readFileSync(new URL('./fixtures/audit-game-18183.json',import.meta.url),'utf8'));
test('actual Stoneworm farm destination is always rejected as a hostile endpoint',()=>{
 const p={map:'spookytown',x:676.5,y:129};
 const r=threatRegions(G,p.map);
 assert.equal(segmentThreatFree(r,p,p),false);
 assert.ok(r.rectangles.filter(b=>!segmentThreatFree({ok:true,rectangles:[b],circles:[]},p,p)).some(b=>b.type==='stoneworm'));
});
test('Ranger stops native movement only once while searching remains set',()=>{
 const events=[],calls=[],smart={moving:false,searching:true};
 const bot={running:true,session:'audit',me:{role:'farmer'},cfg:{world:{excludedMaps:[]}},
 p:{G,c:{name:'R',map:'main',x:293,y:1268,moving:false},root:{smart},parent:{},
 has:()=>true,call:(name,...args)=>{calls.push([name,...args]);if(name==='stop')smart.moving=false;return true;}},
 exec:{pending:new Map(),cancelResource(){},busy:()=>false,run(){throw Error('No dispatch expected');}},
 monsters:()=>[],event:(type,data)=>events.push({type,...data})};
 const m=createMovement(bot);
 for(let i=0;i<20;i++)assert.equal(m.go({map:'spookytown',x:676.5,y:129},'follow'),false);
 assert.equal(events.filter(e=>e.type==='travel.hazardLegacyRouteStopped').length,1);
 assert.equal(calls.filter(c=>c[0]==='stop').length,1);
 assert.equal(smart.searching,true);assert.equal(m.order,null);
});
test('ordinary trip commitment persists until independent failure evidence',()=>{
 const current={key:'blocked',map:'spookytown',in:'spookytown',x:676.5,y:129,started:1,arrivedAt:null};
 const old={...current,score:1},candidate={key:'local',score:1000000,travelSeconds:1};
 const result=chooseCommittedFarmArea({current,currentRank:old,candidate,
 character:{map:'main',in:'main',x:160,y:1381},now:1e12,holdMs:300000});
 assert.equal(result.reason,'committed-farm-trip');assert.equal(result.choice,old);
});
test('merchant uses safe service edge for actual Warrior coordinates',()=>{
 const bot={p:{G,c:{max_hp:3430},read:()=>null},cfg:{world:{},general:{testLogging:true},
 farming:{resumeAbove:.85,pullHp:.75},merchant:{servicePositionError:70}},me:{name:'M'}};
 const strategy=createStrategy(bot);
 const peer={map:'main',x:160,y:1381,hp:3484,max_hp:3722,threats:0};
 assert.equal(strategy.canVisit(peer),false);
 assert.equal(strategy.canVisit({...peer,x:400}),true);const point=strategy.serviceDestination(peer);assert.ok(point);assert.ok(strategy.canVisit(point));assert.ok(Math.hypot(point.x-peer.x,point.y-peer.y)<=161);
});
test('autoMarket and acquireBy market do not constitute market permission',()=>{
 assert.equal(marketRuleApproved(null),false);
 assert.equal(marketRuleApproved({enabled:true,action:'marketBuy'}),true);
});
test('server grace preview > 1 admits a valid low-level upgrade',async()=>{
 const cfg=defaultsFor(ECONOMY_DESCRIPTOR.schema);
 cfg.general.testLogging=true;
 Object.assign(cfg.production,{enabled:true,upgrade:true,minChance:.65,lossBudget:10000});
 cfg.merchant.goldReserve=100;cfg.merchant.maxSpendPerHour=10000;cfg.party.merchant='M';
 const rule={...defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.items.items),
 name:'audit shoes',item:'shoes',role:'merchant',action:'upgrade',targetLevel:3,
 maxLevel:2,minChance:.65,goldBudget:10000,lossBudget:5000};cfg.items=[rule];
 const c={name:'M',map:'main',in:'main',x:0,y:0,gold:10000,items:[{name:'shoes',level:2},{name:'scroll0',q:2},...Array(40).fill(null)],slots:{}};
 let mutations=0;const events=[],data=new Map();
 const bot={cfg,me:{name:'M',role:'merchant',goldReserve:100},session:'audit',
 p:{c,G,read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;},realm:()=> 'EUII',call:(name,...args)=>{
 if(name==='find_npc')return {map:'main',in:'main',x:0,y:0};
 if(name==='item_grade')return 0;if(name==='item_value')return 100;
 if(name==='upgrade'){if(args.at(-1)===true)return Promise.resolve({calculate:true,chance:1.0309934435684873,cost:0});mutations++;return Promise.resolve();}
 throw Error(name);}},running:true,checkpoint:{durable:true},journal:null,logistics:{reserved:false},
 free:()=>40,event:(type,data)=>events.push({type,...data}),report(){},movement:{go:()=>false},
 beginValue(j){this.journal=j;},endValue(){this.journal=null;}};
 bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:4,onError(){}});
 bot.economy=createEconomy(bot);bot.production=createProduction(bot);
 assert.equal(bot.production.mutate(0,rule),true);
 await new Promise(r=>setImmediate(r));bot.exec.poll();
 assert.equal(bot.production.mutate(0,rule),true);await new Promise(r=>setImmediate(r));bot.exec.poll();assert.equal(mutations,1);
 assert.ok(events.some(e=>e.type==='production.preview-result'&&e.rawChance>1&&e.chance===1));
});
test('catalog discovery includes Merchant own empty cape',()=>{
 const slots={cape:null,earring1:null,earring2:null};
 const profile={class:'merchant',level:58,complete:true,at:Date.now(),realm:'EUII',session:'m',slots};
 const cfg={general:{testLogging:true,planningTickMs:10000},merchant:{budgetMode:'bounded'},
 characters:[{name:'M',enabled:true,role:'merchant',gearRole:'auto'}],
 production:{autoGear:true,gear:true,optimizeGear:true,autoGearItems:[],gearTargets:[],
 autoGearBudget:100000,autoGearMaxLevel:0,minImprovement:.05,minChance:.65,craft:false}};
 const bot={cfg,me:{name:'M',role:'merchant'},farmers:[],p:{G:{version:1,items:{cape:{type:'cape',g:10}},classes:{}},c:{items:[]},realm:()=> 'EUII',call:()=>({luck:10})},
 transport:{peers:new Map(),fresh:()=>null},gear:{snapshot:()=>profile},bank:{packs:()=>[]},
 economy:{safe:()=>true,explicit:()=>null,npcFor:()=>({map:'main',x:0,y:0})}};
 const i=createEconomicIntelligence(bot);
 assert.ok(i.targets().some(g=>g.item==='cape'&&g.character==='M'));assert.ok(i.status().accessoryVacancies.length>0);
});
test('one bank earring fills one empty slot at its physical level',()=>{
 const profile={class:'warrior',level:37,complete:true,at:Date.now(),realm:'EUII',session:'w',
 slots:{earring1:null,earring2:null}};
 const peer={name:'W',running:true,rip:false,realm:'EUII',session:'w',gear:profile};
 const cfg={general:{testLogging:true,planningTickMs:10000},merchant:{budgetMode:'bounded'},
 characters:[{name:'W',enabled:true,role:'farmer',gearRole:'auto'}],production:{
 autoGear:true,gear:true,optimizeGear:true,autoGearItems:[],gearTargets:[],autoGearBudget:100000,
 autoGearMaxLevel:1,minImprovement:.05,minChance:.65,craft:false,maxFarmHours:12}};
 const bot={cfg,me:{name:'M',role:'merchant'},farmers:['W'],p:{G,c:{items:[]},realm:()=> 'EUII',
 call:(name,item)=>name==='item_grade'?0:name==='item_properties'?{str:3+2*(item.level??0)}:null},
 transport:{peers:new Map(),fresh:()=>peer},gear:{profile:()=>profile,snapshot:()=>null},
 bank:{catalogStock:()=>[{pack:'items0',item:{name:'strearring',level:0}}]},
 economy:{safe:()=>true,explicit:()=>null,npcFor:()=>null},production:{estimateAcquisition:()=>null}};
 const targets=createEconomicIntelligence(bot).targets().filter(g=>['earring1','earring2'].includes(g.slot));
 assert.equal(targets.length,1);assert.equal(targets[0].level,0);assert.equal(targets[0].estimatedCost,0);
});

import {serverMutationChance} from '../src/production/helpers.mjs';
import {farmStagingPoint,farmEntryRegions,segmentHazardEscape} from '../src/world/hazard-itinerary.mjs';
test('server normalization rejects malformed chance quotes',()=>{
 for(const raw of [NaN,Infinity,-.1,'1',null,undefined])assert.equal(serverMutationChance({chance:raw}),null);
 for(const raw of [0,.5,1,1.0309934435684873])assert.equal(serverMutationChance({chance:raw}),Math.min(1,raw));
});
test('aggressive farm stages outside and requires collision proof for entry',()=>{
 const zone=G.maps.spookytown.monsters.find(z=>z.type==='stoneworm');
 const plan={map:'spookytown',target:'stoneworm',bounds:['spookytown',...zone.boundary],x:(zone.boundary[0]+zone.boundary[2])/2,y:(zone.boundary[1]+zone.boundary[3])/2};
 const full=threatRegions(G,plan.map);assert.equal(farmStagingPoint(full,plan,()=>true),null);
 const regions={...full,rectangles:full.rectangles.filter(r=>r.type==='stoneworm'&&r.x1===zone.boundary[0]),circles:[]},stage=farmStagingPoint(regions,plan,()=>true);
 assert.ok(stage);assert.ok(segmentThreatFree(regions,stage,stage));assert.equal(segmentThreatFree(regions,stage,plan),false);
 assert.ok(segmentThreatFree(farmEntryRegions(regions,plan),stage,plan));assert.equal(farmStagingPoint(regions,plan,()=>false),null);
 assert.equal(farmEntryRegions(regions,{...plan,target:'bee'}),null);
});
test('escape reduces existing hazard without reentry or crossing another spawn',()=>{
 const origin={map:'main',x:0,y:0},out={map:'main',x:120,y:0},r={ok:true,rectangles:[{x1:-100,y1:-100,x2:100,y2:100,pad:0,type:'bee'}],circles:[]};
 assert.equal(segmentHazardEscape(r,origin,out,origin,['bee']),true);
 assert.equal(segmentHazardEscape(r,origin,out,origin,[]),false);
 assert.equal(segmentHazardEscape(r,out,origin,origin,['bee']),false);
 assert.equal(segmentHazardEscape({...r,rectangles:[...r.rectangles,{x1:110,y1:-100,x2:150,y2:100,pad:0,type:'other'}]},origin,out,origin,['bee']),false);
});
