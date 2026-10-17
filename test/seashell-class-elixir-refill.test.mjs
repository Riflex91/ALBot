import test from 'node:test';
import assert from 'node:assert/strict';
import {seashellCycleDecision,eligibleSeashellClassNeeds,createSeashellCycle,
 SEASHELL_REFILL_TARGET} from '../src/production/seashell-cycle.mjs';
import {chooseStockedElixir} from '../src/items/elixirs.mjs';
import {neutralPullDistance,followerReassemblyDistance} from '../src/combat/team-readiness.mjs';

const G={
 items:{
  seashell:{e:10,quest:'seashells',s:9999,type:'material',g:1},
  elixirdex0:{type:'elixir',dex:32,duration:20,g:100},
  elixirint0:{type:'elixir',int:35,duration:20,g:100},
  elixirvit0:{type:'elixir',vit:25,duration:20,g:100}
 },
 monsters:{crab:{hp:50,attack:8,frequency:1,respawn:4,xp:20}},
 drops:{monsters:{crab:[[1,'seashell',1]]}},
 quests:{seashells:{map:'main',x:550,y:50}},
 maps:{main:{}}
};
function fixture(items=[],{bankItems=[],classRequests=true}={}){
 const written=[],exchanges=[],retrievals=[],events=[];
 const c={name:'My_Merchant',items,map:'main',in:'main',rip:false};
 const status={name:'My_Ranger2',running:true,rip:false,realm:'USV',
  class:'ranger',elixir:classRequests?{item:'elixirdex0',quantity:1}:null};
 const bot={p:{G,c,realm:()=> 'USV',root:{S:{}},parent:{S:{}},
  read:()=>null,write:(key,data)=>{written.push({key,data});return true;}},
  cfg:{merchant:{enabled:true,bank:true},production:{enabled:true,autonomy:true,
    exchange:true,lossBudget:250000,farmConfidence:'mean'},
   farming:{elixirs:true,autoTargets:true},general:{messageTtlMs:10000}},
  me:{name:'My_Merchant',role:'merchant'},running:true,
  farmers:['My_Ranger2'],transport:{fresh:()=>status},
  bank:{observed:true,pending:false,catalogStock:()=>bankItems.map(item=>({item})),
   retrieve:(...args)=>{retrievals.push(args);return true;}},
  economy:{safe:()=>true,explicit:()=>null},
  teamPlan:{candidates:()=>['crab']},
  strategy:{safeTarget:()=>true},
  observations:{rate:()=>({value:20,source:'configured-estimate'})},
  event:(...args)=>events.push(args),free:()=>42-items.filter(Boolean).length,
  journal:null,inventoryBlocked:false,exec:{busy:()=>false},
  movement:{order:null},
  production:{exchange:(...args)=>{exchanges.push(args);return true;}}};
 return {bot,c,items,bankItems,status,written,exchanges,retrievals,events,
  cycle:createSeashellCycle(bot)};
}
test('class suitability is strict; VIT and INT do not substitute for ranger DEX',()=>{
 const farmer={name:'My_Ranger2',running:true,rip:false,
  class:'ranger',elixir:{item:'elixirdex0',quantity:1}};
 assert.equal(chooseStockedElixir(G,'ranger',[{name:'elixirvit0'}]),null);
 assert.equal(chooseStockedElixir(G,'ranger',[{name:'elixirint0'}]),null);
 assert.equal(eligibleSeashellClassNeeds(G,[farmer],
  [{name:'elixirvit0'},{name:'elixirint0'}]).length,1);
 assert.deepEqual(eligibleSeashellClassNeeds(G,[farmer],[{name:'elixirdex0'}]),[]);
});
test('existing shells exchange even when an unfulfilled class demand is present',()=>{
 const f=fixture([{name:'seashell',q:187}],{bankItems:[]});
 assert.equal(f.cycle.decision().mode,'exchange');
 assert.equal(f.cycle.tick(),true);
 assert.equal(f.exchanges.length,1);
 assert.equal(f.exchanges[0][0],0);
 assert.equal(f.exchanges[0][1].item,'seashell');
 assert.equal(f.exchanges[0][1].recipe,'');
 assert.equal(f.exchanges[0][1].keep,0);
});
test('bank shells are retrieved rather than wrongly declaring farm shortage',()=>{
 const f=fixture([],{bankItems:[{name:'seashell',q:75}]});
 assert.equal(f.cycle.decision().mode,'exchange');
 assert.equal(f.cycle.tick(),true);
 assert.equal(f.retrievals.length,1);
 assert.equal(f.retrievals[0][0].name,'seashell');
 assert.equal(f.cycle.request(),null);
});
test('after exhausted exchange stock, farm to 400 physical Merchant shells',()=>{
 const f=fixture([{name:'elixirvit0',q:3}]);
 const order=f.cycle.request();
 assert.equal(SEASHELL_REFILL_TARGET,400);
 assert.equal(order?.item,'seashell');
 assert.equal(order?.monster,'crab');
 assert.equal(order?.quantity,400);
 assert.equal(order?.priority,300);
 assert.equal(f.cycle.decision().mode,'collect');
 f.items.push({name:'seashell',q:399});
 assert.equal(f.cycle.decision().mode,'collect');
 assert.equal(f.cycle.tick(),false,'don’t exchange the incomplete collection');
 f.items.at(-1).q=400;
 assert.equal(f.cycle.decision().mode,'exchange');
 assert.equal(f.cycle.tick(),true,'exchange all after gathering completes');
 assert.equal(f.written.filter(x=>x.data.collecting===false).length,1);
});
test('bank status must be known; no phantom shell shortage from absent observations',()=>{
 const f=fixture([]);f.bot.bank.observed=false;
 const status=f.cycle.decision();
 assert.equal(status.mode,'unknown');
 assert.equal(f.cycle.request(),null);
});
test('a physically stocked DEX elixir suppresses Seashell-gathering pressure',()=>{
 const f=fixture([{name:'elixirdex0',q:1}],{bankItems:[]});
 assert.equal(f.cycle.decision().mode,'idle');
 assert.equal(f.cycle.request(),null);
});
test('neutral-pull clearance always exceeds follower reassembly boundary',()=>{
 for(const value of [50,100,140,180,250]){
  const cfg={party:{waitForTeam:true,followDistance:value}};
  assert.ok(followerReassemblyDistance(cfg)<neutralPullDistance(cfg));
 }
 const actual={party:{waitForTeam:true,followDistance:180}};
 assert.equal(neutralPullDistance(actual),140);
 assert.equal(followerReassemblyDistance(actual),120);
 assert.equal(followerReassemblyDistance({party:{waitForTeam:false,followDistance:180}}),180);
});
test('shortfall alone never opens unsafe or malformed gathering plans',()=>{
 assert.equal(seashellCycleDecision({missingClassElixirs:1,bankKnown:false,
   exchangeBatch:10}).mode,'unknown');
 assert.equal(seashellCycleDecision({missingClassElixirs:1,exchangeBatch:0}).mode,'unknown');
 assert.equal(seashellCycleDecision({missingClassElixirs:0,exchangeBatch:10}).mode,'idle');
 assert.equal(seashellCycleDecision({missingClassElixirs:1,inventory:9,
   exchangeBatch:10}).mode,'collect');
});
