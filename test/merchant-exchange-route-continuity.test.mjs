import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant,exchangeNpcJourneyMatches} from '../src/merchant/controller.mjs';

function fixture({validTicket=true}={}){
 const events=[],c={name:'My_Merchant',map:'main',in:'main',
  x:0,y:0,items:Array(42).fill(null),slots:{},moving:false,stand:false,
  gold:250000,mp:200,max_mp:300};
 c.items[25]={name:'seashell',level:0,q:345};
 let phase='exchange',attempts=0,resumes=0,otherWork=0,continued=null;
 const target={map:'main',in:'main',x:550,y:50,radius:375};
 const bot={
  running:true,recovering:false,inventoryBlocked:false,journal:null,
  me:{name:c.name,role:'merchant'},farmers:[],
  p:{c,G:{items:{seashell:{e:10,quest:'seashells'}},quests:{seashells:{map:'main',x:550,y:50}},maps:{main:{}},skills:{}},
   root:{},parent:{},read:()=>null,write:()=>true,
   realm:()=> 'USIV',call:()=>null},
  cfg:{merchant:{enabled:true,stand:false,supply:false,bank:false,
    potionTeamRefill:false,mluck:false,minFreeSlots:4,bankReclaim:false,
    position:{enabled:false},taskHoldMs:30000,starvationMs:120000},
   production:{enabled:true,exchange:true,goals:[]},
   general:{testLogging:true,economyTickMs:500},items:[],
   party:{merchant:c.name}},
  exec:{busy:()=>false,pending:new Map()},
  movement:{order:null,townActive:false,stop(){this.order=null;}},
  free:()=>c.items.filter(i=>!i).length,
  event:(name,data)=>events.push({name,data}),reason:'',
  bank:{pending:false,gold:()=>false,consolidate:()=>false,
   consolidateInventory:()=>false,manageStand:()=>false},
  storage:{active:false,tick:()=>false,status:()=>({reserve:8})},
  logistics:{reserved:false,travel:()=>false,pickupOnSite:()=>false,
   actionableGearDelivery:()=>false},
  gold:{travel:()=>false,reserved:false},
  services:{active:false,approaching:false,waiting:false,tick:()=>false,
   interrupt:()=>{},restore:()=>false},
  strategy:{status:()=>({manual:null})},
  transport:{fresh:()=>null},
  economy:{
   safe:i=>!!i&&!i.l&&!i.b,
   rules:()=>null,explicit:()=>null,remaining:()=>true,spare:()=>0,
   note:()=>{},value:()=>1,npcAt:()=>true,npcTravel:()=>true
  },
  market:{background:()=>{otherWork++;return false;}},
  production:{
   status:()=>({steps:phase==='exchange'?
    [{kind:'exchange',item:'seashell',level:0,
      sourceProof:{quest:'seashells'}}]:
    [{kind:'marketBuy',item:'poison',level:0}]}),
   captureExchangeRoute:step=>validTicket?{
    kind:'exchange',item:step.item,level:step.level,variant:'seashell:0',
    rule:{name:'Autonomer Seashell Exchange',action:'exchange',item:'seashell',
      recipe:'elixirdex0',_autoProduction:true},
    goalKey:'original-elixir-demand',sourceProof:step.sourceProof}:null,
   resumeExchangeRoute:ticket=>{
    resumed.push(ticket);resumes++;return true;
   },
   tick:()=>{attempts++;bot.movement.order={owner:'economy',dest:{...target}};
    return false;},
   reservedQuantity:()=>0,helperSupply:()=>false
  }
 };
 const resumed=[];
 const merchant=createMerchant(bot);
 return {bot,c,merchant,target,events,resumed,
  phase:v=>{phase=v}, attempts:()=>attempts,resumes:()=>resumes,
  otherWork:()=>otherWork};
}

test('seashell route retains original exchange authorization across new poison/ringsj plan',()=>{
 const f=fixture();
 f.merchant.tick();
 assert.equal(f.attempts(),1);
 const ticket=f.merchant.status().productionContinuation;
 assert.equal(ticket.kind,'exchange');
 assert.equal(ticket.ticket.rule.recipe,'elixirdex0');
 assert.equal(f.c.items[25].q,345);
 f.phase('marketBuy');
 f.c.x=f.target.x;f.c.y=f.target.y;
 f.bot.movement.order=null;
 f.merchant.tick();
 assert.equal(f.resumes(),1);
 assert.equal(f.resumed[0].goalKey,'original-elixir-demand');
 assert.equal(f.attempts(),1,'changed plan must not replace the admitted NPC exchange');
 assert.equal(f.merchant.status().productionContinuation,null);
 assert.ok(f.events.some(e=>e.name==='merchant.productionResume'&&
  e.data.item==='seashell'));
 assert.equal(f.c.items[25].q,345,
  'real exchange consumes items only via guarded server call and journal');
});

test('failed/cancelled or expired route never reuses old exchange ticket',()=>{
 const a=fixture();a.merchant.tick();
 a.phase('marketBuy');a.bot.movement.order=null;
 a.c.x=0;a.c.y=0;
 a.merchant.tick();
 assert.equal(a.resumes(),0,'must not exchange away from original NPC');
 assert.notEqual(a.merchant.status().productionContinuation?.kind,'exchange',
  'original Seashell ticket discarded; unrelated production may start a new route');
 const b=fixture();b.merchant.tick();b.phase('marketBuy');
 b.c.x=b.target.x;b.c.y=b.target.y;
 b.bot.movement.order=null;
 const original=Date.now;Date.now=()=>original()+181000;
 try{b.merchant.tick();assert.equal(b.resumes(),0,'expired ticket is not valid');}
 finally{Date.now=original;}
});

test('movement must finish before exchange is attempted and original ticket is required',()=>{
 const f=fixture();f.merchant.tick();f.phase('marketBuy');
 f.bot.movement.order=null;f.c.x=f.target.x;f.c.y=f.target.y;f.c.moving=true;
 f.merchant.tick();
 assert.equal(f.resumes(),0);
 assert.ok(f.merchant.status().productionContinuation);
 f.c.moving=false;f.merchant.tick();
 assert.equal(f.resumes(),1);
 const missing=fixture({validTicket:false});
 missing.merchant.tick();
 assert.equal(missing.merchant.status().productionContinuation,null,
  'do not invent exchange authority if initial rule could not be verified');
});

test('bank preflight must NEVER count as arrived Seashell quest journey',()=>{
 const f=fixture();
 const bank={map:'bank',x:0,y:-100,radius:90};
 f.bot.production.tick=()=>{
  f.bot.movement.order={owner:'economy',dest:bank};return true;
 };
 f.merchant.tick();
 assert.equal(f.merchant.status().productionContinuation,null,
  'bank inspection cannot be labeled as pending elixir exchange');
 assert.ok(f.events.some(e=>e.name==='merchant.exchangeRouteNotQuestNpc'&&
  e.data.atMap==='bank'&&e.data.expectedMap==='main'));
 assert.ok(!f.events.some(e=>e.name==='merchant.exchangeRouteHeld'));
 f.bot.movement.order=null;f.c.map='bank';f.c.in='bank';f.c.x=0;f.c.y=-100;
 f.phase('marketBuy');
 f.merchant.tick();
 assert.equal(f.resumes(),0,'no value action at bank');
});

test('exchange destination matching checks actual quest coordinates and map',()=>{
 const route={owner:'economy',dest:{map:'main',x:550,y:50,radius:375}};
 const quest={map:'main',x:550,y:50};
 assert.equal(exchangeNpcJourneyMatches(route,quest),true);
 assert.equal(exchangeNpcJourneyMatches({...route,dest:{...route.dest,x:565}},quest),true);
 assert.equal(exchangeNpcJourneyMatches({...route,dest:{...route.dest,x:600}},quest),false);
 assert.equal(exchangeNpcJourneyMatches({...route,dest:{...route.dest,map:'bank'}},quest),false);
 assert.equal(exchangeNpcJourneyMatches({...route,owner:'logistics'},quest),false);
 assert.equal(exchangeNpcJourneyMatches({...route,dest:null},quest),false);
});
