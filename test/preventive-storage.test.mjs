import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastExchange,createStoragePlanner} from '../src/merchant/storage-plan.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {createBank} from '../src/merchant/bank.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
function fixture(free=8){
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema),calls=[];cfg.party.merchant='M';cfg.production.enabled=true;cfg.production.compound=true;cfg.production.minChance=.7;
 const c={map:'main',items:[...Array.from({length:42-free},()=>({name:'unknown'})),...Array(free).fill(null)],slots:{}},G={items:{gift:{e:1,s:9999},ring:{type:'ring',compound:true},junk:{type:'helmet',upgrade:true,g:100}},drops:{gift:[[9,'gold',5000],[1,'ring',1]]},craft:{},monsters:{}};
 const stock=[];let bankFree=10,reserved=0,explicit=null,use='no-gear-use';
 const bot={cfg,me:{name:'M',role:'merchant'},p:{c,G,realm:()=> 'EUII'},free:()=>c.items.filter(i=>!i).length,
  bank:{catalogStock:()=>stock,capacityEvidence:()=>({rows:[{pack:'items0',free:bankFree}]}),consolidateInventory:()=>false,retrieve:(i,r,q)=>{calls.push(['retrieve',i.name,q]);return true;},reclaim:()=>false},
  economy:{explicit:()=>explicit,rules:()=>null,value:()=>60,npcFor:i=>i==='junk'?{map:'main'}:null,count:i=>c.items.filter(x=>x?.name===i.name&&(x.level??0)===(i.level??0)).length,
   npcSell:(slot,r)=>{calls.push(['sell',slot,r]);return true;}},production:{reservedQuantity:()=>reserved,mutate:(slot,r)=>{calls.push(['compound',slot,r]);return true;}},
  intelligence:{gearUse:()=>({state:use}),chance:()=>.99},exec:{busy:()=>false},movement:{order:null},event(){}};
 const planner=createStoragePlanner(bot);bot.storage=planner;
 return {bot,c,G,stock,calls,planner,setBank:n=>bankFree=n,setReserve:n=>reserved=n,setExplicit:r=>explicit=r,setUse:s=>use=s};
}
test('anniversary-sized stack consumption does not free its slot and worst item reward needs another slot',()=>{
 const {c,G}=fixture(3);c.items[0]={name:'gift',q:526};const f=forecastExchange(G,c.items,0,1);
 assert.equal(f.freeAfterConsumption,3);assert.equal(f.worstOutputSlots,1);assert.equal(f.worstFree,2);
});
test('exchange below preventive margin is refused; enough margin admits it without using average gold chance',()=>{
 const a=fixture(8);a.c.items[0]={name:'gift',q:500};assert.equal(a.planner.exchangeAllowed(0,1),false);
 const b=fixture(9);b.c.items[0]={name:'gift',q:500};assert.equal(b.planner.exchangeAllowed(0,1),true);
});
test('Seashell exchange can keep eight safe slots while storage hysteresis remains active',()=>{
 const f=fixture(8);
 f.c.items[0]={name:'gift',q:345};
 assert.equal(f.planner.exchangeAllowed(0,1),false,'8 -> 7 must remain blocked');
 assert.equal(f.planner.active,true);
 // A separately confirmed storage operation has released one unrelated slot.
 f.c.items[1]=null;
 assert.equal(f.bot.free(),9);
 assert.equal(f.planner.active,true,'recovery state remains active until target 12');
 assert.equal(f.planner.exchangeAllowed(0,1),true,
  '9 -> 8 is safe; a higher cleanup target must not veto the transaction');
 assert.equal(f.c.items[0].q,345,'authorization only, no fabricated exchange');
 // After a worst-case output consumes the ninth slot the next exchange
 // must recheck current physical capacity, not reuse the previous admission.
 f.c.items[1]={name:'ring'};
 assert.equal(f.planner.exchangeAllowed(0,1),false,'8 -> 7 still blocked');
});
test('workspace recovery preserves bank-pressure and unknown-output refusals',()=>{
 const f=fixture(8);f.c.items[0]={name:'gift',q:345};
 assert.equal(f.planner.exchangeAllowed(0,1),false);
 f.c.items[1]=null;assert.equal(f.bot.free(),9);
 f.setBank(0);
 assert.equal(f.planner.exchangeAllowed(0,1),false,
  'full bank cannot be bypassed by recovery hysteresis');
 f.setBank(10);
 f.G.drops.gift=[[1,'open','unverified']];
 assert.equal(f.planner.exchangeAllowed(0,1),false,
  'unknown reward output must remain fail-closed');
 f.G.drops.gift=[[1,'ring',3]];
 assert.equal(f.planner.exchangeAllowed(0,1),false,
  'three separate worst-case reward slots need extra headroom');
});
test('full bank defers exchanges even when carried inventory is roomy',()=>{
 const {c,planner,setBank}=fixture(20);setBank(0);c.items[0]={name:'gift',q:500};assert.equal(planner.exchangeAllowed(0,1),false);
});
test('expired bank observation does not silently turn a known full bank into an empty bank',()=>{
 const f=fixture(20);f.setBank(0);f.c.items[0]={name:'gift',q:100};assert.equal(f.planner.exchangeAllowed(0,1),false);
 f.bot.bank.capacityEvidence=()=>null;assert.equal(f.planner.exchangeAllowed(0,1),false);
 f.bot.bank.capacityEvidence=()=>({rows:[{free:10}]});assert.equal(f.planner.active,false);
 f.c.items.fill(null);assert.equal(f.planner.active,false);
});
test('guaranteed whole-stack gold-only exchange can release a slot under pressure',()=>{
 const {c,G,planner}=fixture(3);c.items[0]={name:'gift',q:1};G.drops.gift=[[1,'gold',1000]];
 assert.equal(planner.exchangeAllowed(0,1),true);c.items[0].q=2;assert.equal(planner.exchangeAllowed(0,1),false);
});

test('official Anniversary Gift pool may pay currency shells and gold without inventing inventory slots',()=>{
 const f=fixture(13);
 f.c.items[0]={name:'anniversarygift',q:1088};
 f.G.items.anniversarygift={type:'gem',s:9999,e:1,exclusive:true};
 f.G.items.cxjar={type:'jar'};
 f.G.items.candleward={type:'weapon'};
 f.G.drops.anniversarygift=[
  [608910,'gold',5000],[200000,'gold',20000],
  [190000,'open','anniversary_legacy'],
  [990,'open','anniversary_equipment'],
  [99,'cxjar',1,'makeawish'],[1,'cxjar',1,'ikissyou']
 ];
 f.G.drops.anniversary_legacy=[
  [20,'shells',200],[20,'empty'],
  [100,'gold',5000],[1,'cxjar',1,'legacy-emote']
 ];
 f.G.drops.anniversary_equipment=[[15,'candleward']];
 const forecast=forecastExchange(f.G,f.c.items,0,1);
 assert.equal(forecast.known,true,'official wallet/empty rewards do not consume item slots');
 assert.equal(forecast.worstOutputSlots,1);
 assert.equal(forecast.worstFree,12);
 assert.equal(f.planner.exchangeAllowed(0,1),true,
  '1088 gifts can be exchanged one by one with physical headroom');
 assert.equal(f.c.items[0].q,1088,'forecast cannot consume a single gift');
});
test('gift outcome variants remain fail closed if a nested result is unknown',()=>{
 const f=fixture(13);f.c.items[0]={name:'anniversarygift',q:1088};
 f.G.items.anniversarygift={e:1,s:9999};
 f.G.drops.anniversarygift=[[1,'gold',5000],[1,'shells',100],[1,'open','prizes']];
 f.G.drops.prizes=[[1,'unseen-limited-item']];
 assert.equal(forecastExchange(f.G,f.c.items,0,1).reason,'unknown-output');
 assert.equal(f.planner.exchangeAllowed(0,1),false);
 f.G.drops.prizes=[[1,'empty']];
 assert.equal(forecastExchange(f.G,f.c.items,0,1).known,true);
 f.G.drops.prizes=[[1,'open','missing']];
 assert.equal(f.planner.exchangeAllowed(0,1),false);
});

test('unknown, cyclic and multi-unit reward definitions never become zero-risk exchanges',()=>{
 const {c,G}=fixture();c.items[0]={name:'gift',q:10};G.drops.gift=[[1,'open','missing']];assert.equal(forecastExchange(G,c.items,0,1).known,false);
 G.drops.missing=[[1,'open','missing']];assert.equal(forecastExchange(G,c.items,0,1).known,false);
 G.drops.gift=[[1,'ring',3]];assert.equal(forecastExchange(G,c.items,0,1).worstOutputSlots,3);
});
test('prevention starts with eight empty slots and prioritizes a local triple before a sale',()=>{
 const {c,calls,planner}=fixture(8);c.items[0]={name:'ring',level:0};c.items[1]={name:'ring',level:0};c.items[2]={name:'ring',level:0};c.items[3]={name:'junk',level:0};
 assert.equal(planner.tick(),true);assert.equal(calls[0][0],'compound');assert.equal(calls[0][2].targetLevel,1);assert.equal(planner.status().last.netAccountSlots,2);
});
test('bank-only triple stages exactly three inputs with physical workspace and does not pretend it is local',()=>{
 const {stock,calls,planner}=fixture(8);for(let slot=0;slot<8;slot++)stock.push({item:{name:'ring',level:0},slot,pack:'items0'});
 assert.equal(planner.tick(),true);assert.deepEqual(calls[0],['retrieve','ring',3]);
});
test('bank staging needs a known sufficient chance before taking capacity from inventory',()=>{
 const f=fixture(8);for(let slot=0;slot<3;slot++)f.stock.push({item:{name:'ring',level:0},slot,pack:'items0'});
 f.bot.intelligence.chance=()=>null;assert.equal(f.planner.tick(),false);
 f.bot.intelligence.chance=()=>.4;assert.equal(f.planner.tick(),false);assert.equal(f.calls.length,0);
});
test('compound does not cross variants, protected copies, active reservations or explicit keep rules',()=>{
 for(const mode of ['variant','locked','reserved','keep']){const f=fixture(8);for(let n=0;n<3;n++)f.c.items[n]={name:'ring',level:0};
  if(mode==='variant')f.c.items[1].stat_type='dex';if(mode==='locked')f.c.items[1].l=true;if(mode==='reserved')f.setReserve(3);if(mode==='keep')f.setExplicit({action:'keep'});
  assert.equal(f.planner.tick(),false,mode);assert.equal(f.calls.length,0,mode);}
});
test('capacity compounding preserves one complete recipe batch and explicit local keep quantity',()=>{
 const f=fixture(8);for(let n=0;n<3;n++)f.c.items[n]={name:'ring',level:0};f.G.craft={out:{items:[[1,'ring']]}};
 assert.equal(f.planner.tick(),false);f.c.items[3]={name:'ring',level:0};assert.equal(f.planner.tick(),true);
 const g=fixture(8);for(let n=0;n<3;n++)g.c.items[n]={name:'ring',level:0};g.bot.economy.rules=()=>({action:'compound',targetLevel:1,keep:1});
 assert.equal(g.planner.tick(),false);
});
test('easy NPC replacement and complete negative utility authorize low-level junk, not functional supplies',()=>{
 const f=fixture();f.c.items[0]={name:'junk',level:0};assert.equal(f.planner.lowQualityRule(f.c.items[0])?.action,'sell');
 f.setUse('unknown');assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);f.setUse('gear-useful');assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);
 f.setUse('no-gear-use');f.setReserve(1);assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);
 f.setReserve(0);f.G.skills={feed:{consume:'junk'}};assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);
});
test('recipe backing is counted across bank and inventory without consuming the last batch',()=>{
 const f=fixture();f.c.items[0]={name:'junk',level:0};f.G.craft={out:{items:[[1,'junk']]}};
 assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);f.stock.push({pack:'items0',slot:0,item:{name:'junk',level:0}});
 assert.ok(f.planner.lowQualityRule(f.c.items[0]));f.stock[0].item.l=true;assert.equal(f.planner.lowQualityRule(f.c.items[0]),null);
});
test('incoming transfers preserve the preventive reserve while still allowing stack merges',()=>{
 const f=fixture(8);assert.equal(f.planner.receiveNewSlots(),0);f.c.items[0]=null;assert.equal(f.planner.receiveNewSlots(),1);
 f.c.items.fill(null);assert.equal(f.planner.receiveNewSlots(),34);
});
test('a failed mutation is deferred so another cleanup can run and repeat travel is avoided',()=>{
 const f=fixture(8);for(let n=0;n<3;n++)f.c.items[n]={name:'ring',level:0};f.c.items[3]={name:'junk',level:0};let previews=0;
 f.bot.production.mutate=()=>{previews++;return false;};assert.equal(f.planner.tick(),true);assert.equal(previews,1);assert.equal(f.calls[0][0],'sell');
 f.planner.tick();assert.equal(previews,1);
});
test('preventive bank reclaim can authorize proven NPC-replaceable base gear before the bank is full',()=>{
 const f=fixture(12),records=[],memory=new Map();f.c.map='bank';f.c.in='bank';f.c.x=0;f.c.y=-100;
 f.c.bank={gold:1000,items0:[...Array.from({length:39},()=>({name:'junk',level:0})),null,null,null]};
 f.G.bank_packs={items0:['bank',0,0]};f.bot.cfg.merchant.bankReclaim=true;f.bot.decisionEpoch=1;
 Object.assign(f.bot.p,{read:k=>memory.get(k),write:(k,v)=>{memory.set(k,structuredClone(v));return true;},call:()=>true});
 Object.assign(f.bot.economy,{safe:i=>!!i&&!i.l,remaining:()=>true,note(){},travel:()=>true,perform:(kind,x)=>{if(!x.guard())return false;records.push({kind,item:x.details.item});return true;}});
 f.bot.bank=createBank(f.bot);f.bot.storage=createStoragePlanner(f.bot);
 assert.equal(f.bot.bank.reclaim(4),false,'distinct observations required');f.bot.decisionEpoch++;
 assert.equal(f.bot.bank.reclaim(4),true);assert.deepEqual(records,[{kind:'bank.reclaim',item:'junk'}]);
});
test('a new reservation invalidates a queued capacity sale at its final economy guard',()=>{
 const f=fixture();f.c.items[0]={name:'junk',level:0};const r=f.planner.lowQualityRule(f.c.items[0]);assert.ok(r);
 f.bot.running=true;f.bot.checkpoint={durable:true};f.bot.logistics={reserved:false};f.c.gold=1000;f.bot.cfg.merchant.budgetMode='account-loss';
 Object.assign(f.bot.p,{read:()=>null,write:()=>true});let dispatchGuard;
 f.bot.exec.run=(kind,res,guard)=>{dispatchGuard=guard;return true;};
 const e=createEconomy(f.bot);assert.equal(e.perform('sell',{slots:[0],rule:r,call:()=>assert.fail('not dispatched')}),true);
 assert.equal(dispatchGuard(),true);f.setReserve(1);assert.equal(dispatchGuard(),false);
});
