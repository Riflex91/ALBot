import test from 'node:test';
import assert from 'node:assert/strict';
import {planPickupCapacity,pickupCleanupCandidates} from '../src/merchant/pickup-capacity.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';
import {createLogistics} from '../src/items/logistics.mjs';
import {createGoldLogistics} from '../src/items/gold.mjs';

const offer=(name='mat',q=1)=>({item:name,variant:{name,level:0,stat_type:'',p:'',title:''},to:'My_Merchant',surplus:q});
test('pickup preparation respects reserve and distinct advertised variants, not offer retry count',()=>{
 const opts={merchant:'My_Merchant',free:4,reserve:4,known:()=>true};
 const one=planPickupCapacity([offer(),offer()],opts);
 assert.deepEqual([one.offers,one.target,one.missing,one.ready],[1,5,1,false]);
 const three=planPickupCapacity([offer('mat'),offer('gem'),offer('cloth')],opts);
 assert.deepEqual([three.offers,three.target,three.missing],[3,7,3]);
 const full=planPickupCapacity([offer('mat')],{...opts,free:0});
 assert.equal(full.missing,5,'zero free slots must not erase pickup demand');
 assert.equal(planPickupCapacity([offer('mat')],{...opts,free:5}).ready,true);
 assert.equal(planPickupCapacity([offer('unknown')],{...opts,known:()=>false}).offers,0);
});
test('preflight considers only whole-stack bank/sell actions and never protected/keep entries',()=>{
 const items=[{name:'bank',q:3},{name:'sell',q:1},{name:'partial',q:5},{name:'locked',q:1,l:true},{name:'keep',q:1}];
 const rules=i=>({action:i.name==='bank'?'bank':i.name==='sell'?'sell':i.name==='partial'?'bank':'keep'});
 const options=pickupCleanupCandidates(items,rules,slot=>slot===2?2:10,i=>!i.l);
 assert.deepEqual(options.bank.map(i=>i.slot),[0]);
 assert.deepEqual(options.sell.map(i=>i.slot),[1]);
});
function merchantFixture(){
 const items=[{name:'mat',level:0,q:1},...Array.from({length:37},()=>({name:'locked',l:true})),...Array(4).fill(null)];
 const c={name:'My_Merchant',map:'main',items,rip:false,slots:{}},events=[],actions=[],cfg={
  merchant:{enabled:true,pickup:true,minFreeSlots:4,taskHoldMs:30000,starvationMs:120000,bankWorkspace:2},party:{merchant:'My_Merchant'}};
 const bot={running:true,me:{name:'My_Merchant',role:'merchant'},p:{c,G:{items:{mat:{type:'material'}}}},cfg,
  event:(type,data)=>events.push({type,data}),free:()=>c.items.filter(i=>!i).length,
  reason:'',journal:null,inventoryBlocked:false,movement:{order:null},exec:{busy:()=>false},
  logistics:{reserved:false},gold:{reserved:false},bank:{pending:false,consolidateInventory:()=>false,
   store:(slot,r)=>{actions.push(['bank.store',slot,r.action]);c.items[slot]=null;return true;}},
  economy:{safe:i=>!!i&&!i.l,rules:i=>i.name==='mat'?{action:'bank'}:{action:'keep'},
   spare:(slot,r)=>r.action==='bank'?1:0}};
 return {bot,c,actions,events};
}
test('merchant prepares one new free slot before traveling to collect known loot',()=>{
 const {bot,actions}=merchantFixture(),merchant=createMerchant(bot),peer={name:'F',items:[offer()]};
 assert.equal(bot.free(),4);
 assert.equal(merchant.preparePickup(peer),false,'bank cleanup is first; pickup cannot depart in same tick');
 assert.deepEqual(actions,[['bank.store',0,'bank']]);
 assert.equal(bot.free(),5);
 assert.equal(merchant.preparePickup(peer),true,'confirmed free slot admits pickup');
 assert.equal(merchant.status().pickup.target,5);
});
test('no safe cleanup means no arbitrary sale and no false pickup admission',()=>{
 const {bot,c,actions}=merchantFixture();c.items[0].l=true;
 const merchant=createMerchant(bot);
 assert.equal(merchant.preparePickup({name:'F',items:[offer()]}),false);
 assert.equal(merchant.status().pickup.missing,1);
 assert.equal(merchant.status().pickup.state,'blocked');
 assert.deepEqual(actions,[]);
});
test('merchant can accept a farmer item at its configured soft four-slot reserve',()=>{
 const {bot,c}=merchantFixture(),messages=[];
 bot.session='M';bot.farmers=['F'];bot.p.c.map='main';bot.p.c.in='main';bot.p.c.x=0;bot.p.c.y=0;
 bot.p.G.items.mat={type:'material'};bot.p.realm=()=> 'USIV';
 bot.p.call=()=>null;bot.entity=()=>({name:'F',map:'main',in:'main',x:10,y:0});
 bot.cfg.merchant.maxDelivery=3000;bot.cfg.merchant.supply=true;
 bot.cfg.general={messageTtlMs:10000};bot.cfg.farming={freeSlots:4,potionCarryMax:3000};
 bot.checkpoint={durable:true};bot.transport={ownCharacters:()=>[{name:'F',class:'ranger'}],fresh:()=>({name:'F',class:'ranger',running:true,rip:false,realm:'USIV',session:'F',map:'main',in:'main',x:10,y:0}),peers:new Map(),
  send:(to,type,data,id)=>messages.push({to,type,data,id})};
 bot.exec={now:()=>Date.now(),busy:()=>false};
 bot.rule=()=>null;bot.beginValue=j=>{bot.journal=j;};
 bot.endValue=()=>{bot.journal=null;};
 bot.gold={reserved:false};bot.services={active:false,waiting:false};
 bot.movement={order:null,stop(){}};
 const logistics=createLogistics(bot);
 logistics.receive('F',{type:'offer',session:'F',id:'pickup-1',data:{item:{name:'mat',level:0,stat_type:'',p:'',title:''},quantity:1}});
 assert.equal(logistics.stats().acceptsSent,1);
 assert.equal(bot.journal.kind,'receive');
 assert.equal(messages[0].type,'accept');
});
test('logistics starts pickup preparation despite full inventory, without departing',()=>{
 const {bot,c}=merchantFixture();c.items=Array.from({length:42},()=>({name:'locked',l:true}));
 const prepared=[];
 bot.session='M';bot.farmers=['F'];bot.p.c.map='main';bot.p.c.in='main';bot.p.c.x=0;bot.p.c.y=0;
 bot.p.realm=()=> 'USIV';bot.p.G.items.mat={type:'material'};
 bot.p.call=()=>null;bot.cfg.items=[];bot.economy.explicit=()=>null;bot.cfg.merchant.maxDelivery=3000;bot.cfg.merchant.supply=true;
 bot.cfg.general={messageTtlMs:10000};bot.cfg.farming={freeSlots:4,hpBelow:0.4,mpBelow:0.4};
 bot.transport={ownCharacters:()=>[{name:'F',class:'ranger'}],fresh:()=>({name:'F',class:'ranger',running:true,rip:false,realm:'USIV',session:'F',map:'main',in:'main',x:1000,y:0,items:[offer()],hp:100,max_hp:100,mp:100,max_mp:100}),
  peers:new Map([['F',{}]])};
 bot.exec={now:()=>Date.now(),busy:()=>false};
 bot.entity=()=>null;bot.rule=()=>null;bot.gold={reserved:false};
 bot.merchant={preparePickup:h=>{prepared.push(h.name);return false;},claimService:()=>true};
 bot.strategy={canVisit:()=>true};bot.movement={order:null,go:()=>assert.fail('must not leave with unprepared inventory'),stop(){}};
 const logistics=createLogistics(bot);
 logistics.travel();
 assert.deepEqual(prepared,['F']);
});

test('valid incoming gold offer can cancel only an unsent item offer and receive gold',()=>{
 const {bot}=merchantFixture(),responses=[],calls=[];
 bot.p.c.map='main';bot.p.c.in='main';bot.p.c.x=0;bot.p.c.y=0;bot.p.c.gold=500;
 bot.p.realm=()=> 'USIV';bot.p.read=()=>null;bot.p.write=()=>true;
 bot.cfg.merchant.collectGold=true;bot.cfg.merchant.goldTransferMax=100000;
 bot.cfg.merchant.goldReserve=0;bot.cfg.general={messageTtlMs:10000};
 bot.cfg.characters=[{name:'F',enabled:true,role:'farmer'}];
 bot.entity=()=>({name:'F',map:'main',in:'main',x:10,y:0});
 bot.transport={fresh:()=>({name:'F',session:'f',running:true,rip:false,realm:'USIV',map:'main',in:'main',x:10,y:0}),
  send:(to,type,data,id)=>responses.push({to,type,id,data})};
 bot.checkpoint={durable:true};bot.exec={busy:()=>false};
 bot.services={active:false};bot.movement={order:null,stop:()=>calls.push('stop')};
 bot.logistics={reserved:true,itemReserved:true,yieldUnsent(reason){
   calls.push('yieldUnsent');this.reserved=false;this.itemReserved=false;return true;
 }};
 bot.beginValue=j=>{bot.journal=j;};
 const gold=createGoldLogistics(bot);
 gold.receive('F',{type:'goldOffer',id:'gold1',session:'f',data:{quantity:100}});
 assert.deepEqual(calls,['yieldUnsent','stop']);
 assert.equal(gold.status().state,'receiving');
 assert.equal(bot.journal.kind,'gold.receive');
 assert.equal(responses[0].type,'goldAccept');
});

test('departure phases finish bank, materials and economically authorized work before buying 3000-per-farmer potions',()=>{
 const {bot,c,actions}=merchantFixture(),purchases=[],stock={hpot0:200,mpot0:200};bot.cfg.merchant.supply=true;
 bot.p.realm=()=> 'EUII';bot.p.c.gold=1000000;
 bot.p.G.items.hpot0={type:'pot',g:10};bot.p.G.items.mpot0={type:'pot',g:10};
 bot.farmers=['F'];
 bot.cfg.merchant.maxSpendPerHour=2000000;bot.cfg.merchant.goldReserve=0;
 bot.transport={ownCharacters:()=>[{name:'F',class:'ranger'}],fresh:()=>({name:'F',class:'ranger',running:true,rip:false,realm:'EUII',
   potions:{hpot0:1200,mpot0:3000}})};
 bot.economy.explicit=()=>null;bot.economy.remaining=()=>true;
 bot.economy.count=item=>stock[item.name]??0;
 bot.economy.ledger={spent:0};
 bot.economy.npcBuy=(item,r,q)=>{purchases.push([item.name,q]);return true;};
 bot.bank.ready=()=>true;bot.bank.consolidate=()=>false;
 bot.bank.consolidateAcross=()=>false;
 bot.production={reservedQuantity:()=>0,mutate:()=>false};
 bot.movement={order:null};
 const merchant=createMerchant(bot),peer={name:'F',items:[offer()]};
 assert.equal(merchant.prepareDeparture(peer),false); // reconciliation
 assert.equal(merchant.status().departure.phase,'materials');
 assert.equal(merchant.prepareDeparture(peer),false); // material banked
 assert.deepEqual(actions,[['bank.store',0,'bank']]);
 assert.equal(merchant.prepareDeparture(peer),false); // materials complete
 assert.equal(merchant.status().departure.phase,'mutation');
 assert.equal(merchant.prepareDeparture(peer),false); // mutation gate
 assert.equal(merchant.prepareDeparture(peer),false); // sale gate
 assert.equal(merchant.status().departure.phase,'gear');
 assert.equal(merchant.prepareDeparture(peer),false); // bank eligible gear
 assert.equal(merchant.status().departure.phase,'potions');
 assert.deepEqual(purchases,[],'must not buy/supply before local inventory work');
 assert.equal(merchant.prepareDeparture(peer),false); // first potion purchase
 assert.deepEqual(purchases,[['hpot0',1800]]);
 stock.hpot0+=1800; // simulated confirmed purchase
 assert.equal(merchant.prepareDeparture(peer),false); // potions complete
 assert.equal(merchant.status().departure.phase,'capacity');
 assert.equal(merchant.prepareDeparture(peer),true);
 assert.equal(merchant.status().departure.phase,'ready');
});

test('farmer accepts MP potions even when HP stack already holds 3000',()=>{
 const {bot,c}=merchantFixture(),sent=[];
 bot.running=true;bot.me={name:'F',role:'farmer'};
 c.name='F';c.map='main';c.in='main';c.x=0;c.y=0;
 c.items=[{name:'hpot0',level:0,q:3000},...Array(41).fill(null)];
 bot.p.G.items={
  hpot0:{type:'pot',gives:[['hp',200]]},
  mpot0:{type:'pot',gives:[['mp',300]]}};
 bot.p.realm=()=> 'EUII';bot.cfg.party.merchant='My_Merchant';
 bot.cfg.farming={freeSlots:4,potionCarryMax:3000};
 bot.cfg.general={messageTtlMs:10000};bot.cfg.items=[];
 bot.cfg.merchant.enabled=true;bot.cfg.merchant.pickup=true;
 bot.cfg.merchant.maxDelivery=3000;
 bot.checkpoint={durable:true};bot.gold={reserved:false};
 bot.exec={now:()=>Date.now(),busy:()=>false};
 bot.services={active:false,waiting:false};
 bot.session='farmer';bot.rule=()=>null;bot.economy.safe=()=>true;
 bot.entity=()=>({name:'My_Merchant',map:'main',in:'main',x:10,y:0});
 bot.transport={fresh:()=>({name:'My_Merchant',running:true,rip:false,
    session:'merchant',realm:'EUII',map:'main',in:'main',x:10,y:0}),
   send:(to,type,data,id)=>sent.push({to,type,data,id})};
 bot.beginValue=j=>{bot.journal=j;};
 const logistics=createLogistics(bot);
 logistics.receive('My_Merchant',{type:'offer',session:'merchant',id:'mp-accept',
   data:{item:{name:'mpot0',level:0,stat_type:'',p:'',title:''},quantity:500}});
 assert.equal(sent[0].type,'accept');
 assert.equal(sent[0].data.quantity,300,
   'already held HP potions must not reduce the MP potion cap');
});

test('offline selected farmers do not block supply and a late disappearance vetoes NPC spending',()=>{
 const {bot}=merchantFixture();let peer={name:'F',running:true,realm:'EUII',potions:{hpot0:3000,mpot0:200}},guard;
 bot.cfg.merchant.supply=true;bot.cfg.merchant.maxSpendPerHour=100000;bot.cfg.merchant.goldReserve=0;
 bot.farmers=['F','Offline'];bot.p.realm=()=> 'EUII';bot.p.c.gold=100000;
 bot.p.G.items.mpot0={type:'pot',g:10};bot.p.G.items.hpot0={type:'pot',g:10};
 bot.transport={fresh:n=>n==='F'?peer:null};bot.movement={order:null};
 bot.economy.explicit=()=>null;bot.economy.count=()=>200;bot.economy.ledger={spent:0};
 bot.economy.npcBuy=(item,r,q,g)=>{assert.equal(item.name,'mpot0');assert.equal(q,100);guard=g;return true;};
 bot.bank.ready=()=>true;bot.bank.consolidate=()=>false;bot.bank.consolidateAcross=()=>false;
 bot.p.c.items=Array(42).fill(null);
 const merchant=createMerchant(bot);for(let n=0;n<12&&!guard;n++)merchant.prepareDeparture({name:'F',items:[offer()]});
 assert.equal(typeof guard,'function');assert.equal(guard(),true);
 peer=null;assert.equal(guard(),false);
});
test('merchant discovers an unconfigured own online farmer and offers only its MP deficit',()=>{
 const {bot,c}=merchantFixture(),sent=[];
 bot.running=true;c.map='main';c.in='main';c.x=0;c.y=0;
 c.items=[{name:'mpot0',level:0,q:1500},...Array(41).fill(null)];
 bot.p.G.items={mpot0:{type:'pot',gives:[['mp',300]]}};
 bot.p.realm=()=> 'EUII';bot.cfg.items=[];
 bot.cfg.farming={freeSlots:4,potionCarryMax:3000};
 bot.cfg.general={messageTtlMs:10000};
 bot.cfg.merchant.enabled=true;bot.cfg.merchant.pickup=true;
 bot.cfg.merchant.supply=true;bot.cfg.merchant.maxDelivery=3000;
 bot.session='merchant';bot.rule=()=>null;bot.farmers=[];bot.cfg.merchant.discoverOwnFarmers=true;
 bot.checkpoint={durable:true};bot.gold={reserved:false};
 bot.exec={now:()=>Date.now(),busy:()=>false};
 bot.services={active:false,waiting:false};
 bot.economy.safe=()=>true;bot.economy.explicit=()=>null;
 bot.entity=()=>({name:'F',map:'main',in:'main',x:10,y:0});
 bot.transport={ownCharacters:()=>[{name:'F',class:'ranger'}],fresh:()=>({name:'F',class:'ranger',running:true,rip:false,
   session:'farmer',realm:'EUII',map:'main',in:'main',x:10,y:0,
   free:10,potions:{hpot0:3000,mpot0:200},items:[]}),
   send:(to,type,data,id)=>sent.push({to,type,data,id})};
 const logistics=createLogistics(bot);
 logistics.poll();
 assert.equal(sent[0]?.type,'offer');
 assert.equal(sent[0]?.data?.item?.name,'mpot0');
 assert.equal(sent[0]?.data?.quantity,100);
});
