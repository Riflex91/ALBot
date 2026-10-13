import test from 'node:test';
import assert from 'node:assert/strict';
import {createBehavior} from '../src/core/behavior.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';
import {emergencyMaterialSaleAllowed} from '../src/merchant/bank.mjs';

test('legacy recurring Bee rule cannot override autonomous verified team plan',()=>{
 const requests=[],cfg={farming:{autoTargets:true},rules:[{enabled:true,role:'farmer',character:'',
  priority:0,everyMs:1,cooldownMs:1000,match:'all',conditions:[],action:'farm',target:'bee'}]};
 const bot={p:{},cfg,me:{name:'Mage',role:'farmer'},teamPlan:{target:()=> 'minimush'},
  strategy:{requestTask:(...args)=>{requests.push(args);return true;}},
  measure:()=>({hpRatio:1}),event:()=>{},running:true};
 createBehavior(bot).tick();assert.deepEqual(requests,[]);
 const legacy={...bot,teamPlan:null};createBehavior(legacy).tick();
 assert.equal(requests.length,1,'legacy mode continues to honor configured farm rules');
 assert.equal(requests[0][0],'farm:bee');
});

test('leader does not consider a spawn 200+ units away reached',()=>{
 const moves=[],G={monsters:{goo:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},
  maps:{main:{monsters:[{type:'goo',boundaries:[['main',0,0,500,500]]}]}}};
 const c={name:'Leader',map:'main',in:'main',x:250,y:40,attack:50,frequency:1,
  max_hp:500,hp:500,mp:500,max_mp:500,level:20,items:[],xp:0,gold:0,speed:45};
 const bot={p:{c,G,root:{S:{}},parent:{S:{}},read:()=>null,realm:()=> 'EUII',entities:{}},
 cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:1,planHoldMs:300000,deathWindowMs:600000,orbitRadius:220},
  world:{excludedMaps:[],cacheTtlMs:60000},party:{enabled:true,waitForTeam:false}},
 me:{name:'Leader',role:'farmer',farmTargets:[]},leader:'Leader',farmers:['Leader'],transport:{fresh:()=>null},
 strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},monsters:()=>[],event:()=>{},
 decisionEpoch:1,movement:{order:null,stop(){},go:(d,owner)=>moves.push({d,owner})},
 gear:{snapshot:()=>({})},content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);plan.tick();assert.ok(plan.heartbeat());
 assert.equal(plan.travel(),true,'200 units away still needs movement');
 assert.equal(moves[0].owner,'farm');assert.ok(moves[0].d.radius<=85);
 c.y=240;moves.length=0;assert.equal(plan.travel(),false,'arrived at spawn center');
 assert.equal(moves.length,0);
});

test('merchant keeps staged depot reconciliation across ticks and checkpoints',()=>{
 const writes=[],events=[];
 const cfg={merchant:{enabled:true,bank:true,supply:false,stand:false,mluck:false,
  minFreeSlots:4,taskHoldMs:30000,starvationMs:120000},party:{merchant:'Merchant'}};
 const c={name:'Merchant',map:'main',in:'main',items:[],slots:{},stand:false,rip:false,gold:1000000};
 let atBank=false,auditCount=0;
 const bot={p:{c,G:{items:{},skills:{}},read:()=>({stage:'complete',completedAt:Date.now()-700000}),write:(...args)=>{writes.push(args);return true;}},
 cfg,me:{name:'Merchant',role:'merchant'},running:true,recovering:false,inventoryBlocked:false,journal:null,
 logistics:{reserved:false,travel:()=>false},movement:{order:null},gold:null,services:null,
 farmers:[],production:{status:()=>({intent:null}),tick:()=>false},bank:{pending:false,
  ready:()=>atBank,audit:()=>{auditCount++;return false;},manageStand:()=>false},
 exec:{busy:()=>false,pending:new Map()},economy:{safe:()=>true,rules:()=>null,remaining:()=>true,spare:()=>0},
 event:(...args)=>events.push(args),free:()=>42};
 const merchant=createMerchant(bot);merchant.tick();
 assert.equal(merchant.status().depot.stage,'reconcile');
 assert.equal(writes.at(-1)[0],'albot:merchant-depot:Merchant');
 atBank=true;merchant.tick();
 assert.equal(merchant.status().depot.stage,'mutation');
 assert.equal(auditCount,1);
 assert.ok(events.some(([type])=>type==='merchant.depotStage'));
});

test('bank pressure may reclaim only low-value plain material within a bounded total',()=>{
 assert.equal(emergencyMaterialSaleAllowed({type:'material'},5,20,100),true);
 assert.equal(emergencyMaterialSaleAllowed({type:'material'},101,1,100),false);
 assert.equal(emergencyMaterialSaleAllowed({type:'material'},10,1001,100),false);
 assert.equal(emergencyMaterialSaleAllowed({type:'weapon'},1,1,100),false);
 assert.equal(emergencyMaterialSaleAllowed({type:'material'},1,10000,100),false);
});
