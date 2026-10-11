import test from 'node:test';
import assert from 'node:assert/strict';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';
import {createBank} from '../src/merchant/bank.mjs';

function econFixture(){
 const c={name:'M',ctype:'merchant',level:60,map:'main',in:'main',items:Array(42).fill(null),slots:{}};
 const G={version:1,items:{ring:{type:'ring',compound:true,grades:[10,20]},cscroll0:{g:1},
  mat:{type:'material',g:10}},classes:{merchant:{mainhand:{},offhand:{}}},
  compounds:[[null,1,1]],craft:{}};
 const cfg={characters:[{name:'M',enabled:true,gearRole:'auto'}],
  general:{planningTickMs:1000,testLogging:true},
  party:{merchant:'M'},merchant:{bank:true},production:{
   autoDisposition:true,enabled:true,autonomy:true,compound:true,upgrade:true,
   autoGearMaxLevel:1,autoProfitMaxLevel:1,minChance:.5,minImprovement:0,
   helperMaxPrice:1000,lossBudget:10000,autoSellMaxValue:100,goldPerHour:0,gearTargets:[]}};
 const bot={cfg,me:{name:'M',role:'merchant'},p:{c,G,entities:{},realm:()=> 'USIV',call:(fn,i)=>fn==='item_grade'?0:{gold:0}},
  teamNames:['M'],transport:{peers:new Map(),fresh:()=>null},
  economy:{safe:i=>!!i&&!i.l&&!i.b,explicit:()=>null,value:i=>i.level===1?100:10},
  production:{reservedQuantity:()=>0},gear:{snapshot:()=>({class:'merchant',level:60,slots:{}}),profile:()=>null},
  count:()=>0};
 return {bot,c,G,cfg};
}
test('R03 negative-value compound single is not forced into bank storage',()=>{
 const {bot,c}=econFixture();c.items[0]={name:'ring',level:0};
 bot.economy.value=i=>i.level===1?5:10;
 const intelligence=createEconomicIntelligence(bot);
 const rule=intelligence.disposition(c.items[0]);
 assert.equal(rule?.action,'sell');
});
test('R03 economic pair is accumulated only when a bounded third input pays off',()=>{
 const {bot,c}=econFixture();c.items[0]={name:'ring',level:0};c.items[1]={name:'ring',level:0};
 const intelligence=createEconomicIntelligence(bot);
 const rule=intelligence.disposition(c.items[0]);
 assert.equal(rule?.action,'bank');
 assert.equal(intelligence.mutationEconomics(c.items[0],{heldOverride:3}).action,'compound');
});
test('R03 nine verified bank items generate a profit plan without allowing phantom local mutation',()=>{
 const {bot}=econFixture();bot.bank={catalogStock:()=>Array.from({length:9},(_,slot)=>(
  {pack:'items0',slot,item:{name:'ring',level:0},owner:'M',evidence:{observedAt:Date.now()}}))};
 const intelligence=createEconomicIntelligence(bot);
 const goals=intelligence.profitGoals();
 assert.ok(goals.some(g=>g.item==='ring'&&g.level===1),JSON.stringify(goals));
 assert.equal(bot.p.c.items.filter(Boolean).length,0);
});
test('R05 fresh heartbeat never upgrades a stale cached gear profile to safe-to-sell',()=>{
 const {bot,c,G,cfg}=econFixture();c.items[0]={name:'ring',level:0};
 cfg.characters=[{name:'R',enabled:true,gearRole:'auto'}];
 bot.gear.profile=()=>({class:'ranger',level:60,slots:{ring1:null,ring2:null},
  complete:true,session:'old',realm:'USIV',at:1});
 bot.transport.fresh=()=>({session:'new',running:true,rip:false,realm:'USIV',received:Date.now()});
 const intelligence=createEconomicIntelligence(bot);
 assert.equal(intelligence.gearUse(c.items[0]).state,'unknown');
 assert.match(intelligence.gearUse(c.items[0]).reason,/gear-evidence-unverified/);
});
test('R06 observed chance is bound to scroll, offering and source definitions',()=>{
 const {bot,G}=econFixture();
 G.items.scroll0={g:1};G.items.offering={g:10};G.upgrades=[[null,.1]];
 G.items.sword={upgrade:true,grades:[10,20]};
 bot.p.call=()=>0;
 const intelligence=createEconomicIntelligence(bot);
 intelligence.recordChance('sword',0,'upgrade',.99,{scroll:'scroll0',offering:'offering'});
 assert.equal(intelligence.chance('sword',0,'upgrade'),.1);
 intelligence.recordChance('sword',0,'upgrade',.95,{scroll:'scroll0',offering:''});
 assert.equal(intelligence.chance('sword',0,'upgrade'),.95);
 G.version=2;
 assert.equal(intelligence.chance('sword',0,'upgrade'),.1);
});
test('R07 decision report bounded with stock source and rule rationale',()=>{
 const {bot,c,G}=econFixture();c.items[0]={name:'mat',level:0};
 bot.production.reservedQuantity=()=>0;
 const intelligence=createEconomicIntelligence(bot);
 assert.equal(intelligence.disposition(c.items[0])?.action,'sell');
 const latest=intelligence.status().decisions.at(-1);
 assert.equal(latest.item,'mat');assert.equal(latest.source,'autonomous');
 assert.equal(latest.local,1);assert.equal(latest.nextStep,'sell');
 assert.ok(intelligence.status().decisions.length<=24);
});
test('R04 bank catalog TTL does not refresh by repeat read outside verified bank map',()=>{
 const storage=new Map(),now=Date.now;let time=180000;
 Date.now=()=>time;
 try{
  const c={name:'M',map:'bank',in:'bank',items:Array(42).fill(null),
   bank:{items0:[{name:'ring',level:0}]}};
  const G={bank_packs:{items0:['bank',100]},items:{ring:{type:'ring',g:10}}};
  const p={c,G,realm:()=> 'USIV',read:key=>storage.get(key),
   write:(key,value)=>{storage.set(key,structuredClone(value));return true;}};
  const bot={p,cfg:{party:{merchant:'M'},merchant:{bank:true}},me:{name:'M'},
   economy:{safe:i=>!!i,explicit:()=>null},decisionEpoch:1,inventoryBlocked:false,journal:null};
  const bank=createBank(bot);bank.packs();
  assert.equal(bank.catalogStock().length,1);
  const observed=bank.catalogStatus().observedAt;
  time+=180001;bot.decisionEpoch++;c.map='main';bank.packs();
  assert.equal(bank.catalogStock().length,0);
  assert.equal(bank.catalogStatus().observedAt,observed,'do not refresh TTL from a retained bank object');
  const persisted=storage.get('albot:bank-catalog:v1:M');
  assert.equal(persisted.observedAt,observed);
 }finally{Date.now=now;}
});
