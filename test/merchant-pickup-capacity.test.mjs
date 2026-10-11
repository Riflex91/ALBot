import test from 'node:test';
import assert from 'node:assert/strict';
import {planPickupCapacity,pickupCleanupCandidates} from '../src/merchant/pickup-capacity.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';
import {createLogistics} from '../src/items/logistics.mjs';

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
 assert.deepEqual(actions,[]);
});
test('merchant can accept a farmer item at its configured soft four-slot reserve',()=>{
 const {bot,c}=merchantFixture(),messages=[];
 bot.session='M';bot.farmers=['F'];bot.p.c.map='main';bot.p.c.in='main';bot.p.c.x=0;bot.p.c.y=0;
 bot.p.G.items.mat={type:'material'};bot.p.realm=()=> 'USIV';
 bot.p.call=()=>null;bot.entity=()=>({name:'F',map:'main',in:'main',x:10,y:0});
 bot.cfg.merchant.maxDelivery=3000;bot.cfg.merchant.supply=true;
 bot.cfg.general={messageTtlMs:10000};bot.cfg.farming={freeSlots:4,potionCarryMax:3000};
 bot.checkpoint={durable:true};bot.transport={fresh:()=>({name:'F',running:true,rip:false,realm:'USIV',session:'F',map:'main',in:'main',x:10,y:0}),peers:new Map(),
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
 bot.p.call=()=>null;bot.cfg.merchant.maxDelivery=3000;bot.cfg.merchant.supply=true;
 bot.cfg.general={messageTtlMs:10000};bot.cfg.farming={freeSlots:4,hpBelow:0.4,mpBelow:0.4};
 bot.transport={fresh:()=>({name:'F',running:true,rip:false,realm:'USIV',session:'F',map:'main',in:'main',x:1000,y:0,items:[offer()],hp:100,max_hp:100,mp:100,max_mp:100}),
  peers:new Map([['F',{}]])};
 bot.exec={now:()=>Date.now(),busy:()=>false};
 bot.entity=()=>null;bot.rule=()=>null;bot.gold={reserved:false};
 bot.merchant={preparePickup:h=>{prepared.push(h.name);return false;},claimService:()=>true};
 bot.strategy={canVisit:()=>true};bot.movement={order:null,go:()=>assert.fail('must not leave with unprepared inventory'),stop(){}};
 const logistics=createLogistics(bot);
 logistics.travel();
 assert.deepEqual(prepared,['F']);
});
