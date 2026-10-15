import test from 'node:test';
import assert from 'node:assert/strict';
import {createPorts} from '../src/runtime/ports.mjs';
import {createAccount} from '../src/party/account.mjs';
import {createGoldLogistics} from '../src/items/gold.mjs';
import {createProduction} from '../src/production/production.mjs';
import {createLogistics} from '../src/items/logistics.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {createBank} from '../src/merchant/bank.mjs';
import {createStoragePlanner} from '../src/merchant/storage-plan.mjs';

function fixture(name='M'){
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema),store=new Map(),messages=[],calls=[];
 cfg.party.merchant='M';cfg.party.leader='';cfg.party.selection='adaptive';cfg.party.maxFarmers=2;
 cfg.characters=['M','A','B','C'].map(name=>({name,role:name==='M'?'merchant':'farmer',enabled:true,rotation:true,class:name==='M'?'merchant':'ranger',group:'g',goldReserve:10000}));
 cfg.merchant.collectGold=true;cfg.production.goals=[];
 const peers=new Map(['M','A','B'].map(name=>[name,{name,session:name+'1',running:true,rip:false,realm:'EUII',level:name==='A'?70:60,hp:100,max_hp:100,map:'main',in:'main',x:0,y:0,free:20,items:[],goldBalance:10000,stats:{attack:100}}]));
 const bot={cfg,me:cfg.characters.find(c=>c.name===name),session:name+'1',running:true,farmers:['A','B'],leader:'B',journal:null,inventoryBlocked:false,
  checkpoint:{durable:true},logistics:{reserved:false},bank:{pending:false},services:{active:false},
  p:{headless:false,c:{name,gold:1556752,rip:false,map:'main',in:'main',x:0,y:0,items:Array(42).fill(null),slots:{}},G:{items:{},maps:{},craft:{}},realm:()=> 'EUII',
   read:k=>store.get(k)??null,write:(k,v)=>{store.set(k,structuredClone(v));return true;},
   has:()=>true,call:(...args)=>{calls.push(args);return {};},canSwitchCharacter:()=>true,switchCharacter:async n=>{calls.push(['switch',n]);return true;}},
  transport:{peers,fresh:n=>peers.get(n),ownCharacters:()=>[{name:'C',class:'ranger',level:20}],send:async(to,type,data,id)=>{messages.push({to,type,data,id});return true;}},
  movement:{stop(){calls.push(['stop-move']);}},monsters:()=>[],free:()=>42,entity:n=>peers.get(n),event(){},report(){},
  beginValue(j){this.journal=j;},endValue(){this.journal=null;},
  exec:{pending:new Map(),busy:()=>false,now:()=>Date.now(),run:(key,res,guard,fn,opts)=>{if(!guard())return false;Promise.resolve(fn()).then(()=>opts?.onSettle?.('returned'),()=>opts?.onSettle?.('rejected'));return true;}}};
 return {bot,peers,store,messages,calls};
}
const swapData=()=>({out:'A',in:'C',original:['A','B'],originalLeader:'B',names:['B','C'],leader:'B',seq:1,realm:'EUII',until:Date.now()+120000});
const swapMessage=(data=swapData())=>({type:'accountSwap',id:'swap1',session:'M1',data});
test('preventive unallocated triple goes through real preview, budget journal and compound dispatcher',async()=>{
 const {bot}=fixture();Object.assign(bot.cfg.merchant,{budgetMode:'account-loss',preventiveStorage:true,storageFreeSlots:8,storageTargetSlots:12});Object.assign(bot.cfg.production,{minChance:.7,enabled:true,compound:true,autonomy:true,purposeAllocation:true,goals:[]});
 bot.p.G.items={ring:{compound:{},type:'ring',g:10,grades:[3,5]},cscroll0:{type:'cscroll',g:1,s:9999}};
 bot.p.c.items=Array.from({length:42},()=>({name:'locked',l:true}));for(let n=0;n<3;n++)bot.p.c.items[n]={name:'ring',level:0};bot.p.c.items[3]={name:'cscroll0',q:44};
 for(let n=38;n<42;n++)bot.p.c.items[n]=null;bot.free=()=>bot.p.c.items.filter(i=>!i).length;
 let previews=0,mutations=0;bot.p.call=(name,...args)=>{
  if(name==='item_grade')return 0;if(name==='item_value')return 10;if(name==='find_npc')return {map:'main',in:'main',x:0,y:0};
  if(name==='compound'){if(args.at(-1)===true){previews++;return {chance:.99,cost:0};}mutations++;return true;}throw Error(name);
 };
 bot.intelligence={chance:()=>.99,recordChance(){},rules:()=>[],profitGoals:()=>[],disposition:()=>null};bot.bank={pending:false,capacityEvidence:()=>({rows:[{free:0}]}),catalogStock:()=>[],consolidateInventory:()=>false};
 bot.economy=createEconomy(bot);bot.production=createProduction(bot);bot.storage=createStoragePlanner(bot);
 assert.equal(bot.storage.tick(),true);await new Promise(r=>setImmediate(r));assert.equal(bot.storage.tick(),true);
 assert.equal(previews,1);assert.equal(mutations,1);assert.equal(bot.economy.ledger.productionExposure,40);
});
test('gold surplus no longer initiates a standalone merchant journey',()=>{
 const {bot,peers,calls}=fixture();peers.get('A').goldSurplus=100000;peers.get('A').x=1000;
 let preparations=0;
 bot.merchant={prepareGoldPickup:()=>{preparations++;return true;}};
 bot.movement={order:null,go:(d,owner)=>{calls.push(owner);bot.movement.order={owner};},stop(){}};
 const gold=createGoldLogistics(bot);assert.equal(gold.travel(),false);
 assert.deepEqual(calls,[]);assert.equal(preparations,0);
});

test('Town channel refuses a late gold offer without cancelling or journaling it',()=>{
 const {bot,messages,calls}=fixture();bot.movement.townActive=true;
 const gold=createGoldLogistics(bot);gold.receive('A',{type:'goldOffer',id:'g1',session:'A1',data:{quantity:800000}});
 assert.equal(gold.status(),null);assert.equal(bot.journal,null);assert.equal(messages.length,0);assert.equal(calls.length,0);
 bot.movement.townActive=false;gold.receive('A',{type:'goldOffer',id:'g1',session:'A1',data:{quantity:800000}});
 assert.equal(gold.status().quantity,800000);assert.equal(messages[0].type,'goldAccept');
});
test('Gold offer uses full surplus, preserves reserve and rejects unsafe receiver totals',()=>{
 const {bot,messages}=fixture('A');bot.p.c.gold=650000;bot.cfg.merchant.goldTransferMax=100000;
 const gold=createGoldLogistics(bot);gold.poll(true);assert.equal(messages[0].data.quantity,640000);
 const {bot:merchant}=fixture();merchant.p.c.gold=Number.MAX_SAFE_INTEGER;
 const receiver=createGoldLogistics(merchant);receiver.receive('A',{type:'goldOffer',id:'overflow',session:'A1',data:{quantity:1}});
 assert.equal(receiver.status(),null);
});
test('Late item offers also preserve the Town channel',()=>{
 const {bot,messages,calls}=fixture();bot.p.G.items.mat={type:'material'};bot.rule=()=>null;
 bot.movement.townActive=true;bot.logistics=createLogistics(bot);
 bot.logistics.receive('A',{type:'offer',id:'item1',session:'A1',data:{item:{name:'mat',level:0},quantity:1}});
 assert.equal(bot.journal,null);assert.equal(messages.length,0);assert.equal(calls.length,0);
});
test('Farmer forwards reserved production ingredients, while retaining its completed gear and explicit keeps',()=>{
 const {bot}=fixture('A');bot.cfg.production.purposeAllocation=true;bot.cfg.production.autonomy=true;
 bot.p.G.items={ring:{type:'ring',compound:true},blade:{upgrade:true,type:'weapon'},mat:{type:'material',s:9999}};
 bot.p.G.craft={blade:{items:[[3,'mat']]}};
 bot.cfg.production.goals=[{enabled:true,name:'Ring for B',item:'ring',level:1,quantity:1,recipient:'B'},
  {enabled:true,name:'Own blade',item:'blade',level:0,quantity:1,recipient:'A'}];
 bot.p.c.items[0]={name:'ring',level:0};bot.p.c.items[1]={name:'mat',q:5};bot.p.c.items[2]={name:'blade',level:0};
 bot.economy={explicit:()=>null};bot.production=createProduction(bot);
 assert.equal(bot.production.reservedQuantity({name:'ring',level:0}),3);
 assert.equal(bot.production.reservedQuantity({name:'ring',level:0},'M'),0);
 assert.equal(bot.production.reservedQuantity({name:'blade',level:0},'M'),1);
 bot.rule=()=>null;bot.economy={explicit:()=>null};bot.logistics=createLogistics(bot);
 assert.equal(bot.logistics.pickupSlots(),2);
 assert.equal(bot.logistics.summary().find(r=>r.item==='ring').surplus,1);
 bot.cfg.items=[{enabled:true,action:'keep',item:'ring',role:'farmer',character:'',minLevel:0,maxLevel:99,priority:10}];
 assert.equal(bot.logistics.pickupSlots(),1,'explicit keep still prevents forwarding');
});
test('Material farming honors hold time then swaps by level, without falling into offline class synergy',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,calls,messages}=fixture();bot.cfg.party.balanceFarmers=true;bot.cfg.party.balanceHoldMs=1800000;
  bot.teamPlan={materialActive:()=>true};const account=createAccount(bot);now+=60001;account.tick();
  assert.equal(account.status().transition,null);assert.equal(messages.length,0);assert.equal(calls.length,0);
  now+=1740000;account.tick();assert.equal(messages[0].type,'accountSwap');
  assert.equal(messages[0].to,'A');assert.equal(messages[0].data.in,'C');assert.equal(calls.length,0,'no coordinator iframe lifecycle calls');
 }finally{Date.now=original;}
});
test('Outgoing farmer stores handover and performs the switch in its own window',async()=>{
 const {bot,store,messages,calls}=fixture('A');const account=createAccount(bot);
 account.receiveMessage('M',swapMessage());await new Promise(r=>setImmediate(r));
 assert.equal(store.get('albot:account:C:incoming').in,'C');assert.equal(messages[0].type,'accountAck');
 assert.ok(calls.some(c=>c[0]==='switch'&&c[1]==='C'));assert.equal(account.active(),false);
});
test('Quest activity postpones catch-up without a class rotation',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,peers,messages}=fixture();bot.cfg.party.balanceFarmers=true;
  peers.get('B').activity={kind:'quest'};const account=createAccount(bot);now+=1800001;account.tick();
  assert.equal(account.status().transition,null);assert.equal(messages.length,0);
 }finally{Date.now=original;}
});
test('Catch-up retains the actual party owner to let it invite the incoming farmer',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,peers,messages}=fixture();bot.cfg.party.balanceFarmers=true;
  peers.get('A').party='A';const account=createAccount(bot);now+=1800001;account.tick();
  assert.equal(messages[0].to,'B');assert.deepEqual(messages[0].data.names,['A','C']);
  assert.equal(messages[0].data.leader,'A');
 }finally{Date.now=original;}
});
test('Coordinator persists the outgoing acknowledgement and commits only after incoming heartbeat',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,store,peers,messages,calls}=fixture();bot.cfg.party.balanceFarmers=true;bot.cfg.party.balanceHoldMs=1000;
  const account=createAccount(bot);now+=1800001;account.tick();const m=messages[0];
  account.receiveMessage('A',{type:'accountAck',id:m.id,session:'wrong',data:{in:'C'}});assert.equal(account.status().transition.acked,false);
  account.receiveMessage('A',{type:'accountAck',id:m.id,session:'A1',data:{in:'C'}});
  assert.equal(store.get('albot:account:M').acked,true);account.tick();assert.deepEqual(bot.farmers,['A','B']);
  peers.delete('A');peers.set('C',{...peers.get('B'),name:'C',session:'C1',incomingRotation:{id:m.id}});
  const resumed=createAccount(bot);resumed.tick();assert.deepEqual(bot.farmers,['B','C']);assert.equal(resumed.status().transition,null);
  assert.equal(calls.length,0,'Merchant never starts or stops a farmer iframe');
 }finally{Date.now=original;}
});
test('Swap request also works after the planned team heartbeat arrives first',async()=>{
 const {bot,calls}=fixture('A');const account=createAccount(bot);account.receive('M',{names:['B','C'],leader:'B',seq:1});
 account.receiveMessage('M',swapMessage());await new Promise(r=>setImmediate(r));
 assert.ok(calls.some(c=>c[0]==='switch'));
});
test('Unauthorized, busy, expired and unsupported browser swaps do not log out the farmer',()=>{
 for(const condition of ['sender','journal','gold','expired','api','realm']){
  const {bot,calls,messages}=fixture('A');const account=createAccount(bot),m=swapMessage();
  if(condition==='journal')bot.journal={kind:'send'};if(condition==='gold')bot.gold={reserved:true};
  if(condition==='expired')m.data.until=Date.now()-1;if(condition==='api')bot.p.canSwitchCharacter=()=>false;
  if(condition==='realm')m.data.realm='USI';account.receiveMessage(condition==='sender'?'B':'M',m);
  assert.ok(messages.every(m=>m.type==='accountReject'),condition);assert.equal(calls.length,0,condition);
 }
});
test('Failed acknowledgement keeps the original window and clears its lifecycle hold',async()=>{
 const {bot,calls}=fixture('A');bot.transport.send=async()=>false;const account=createAccount(bot);
 account.receiveMessage('M',swapMessage());await new Promise(r=>setImmediate(r));
 assert.equal(account.active(),true);assert.equal(calls.some(c=>c[0]==='switch'),false);
});
test('Incoming farmer restores selected team before party/follow scheduling',()=>{
 const {bot,store}=fixture('C');store.set('albot:account:C:incoming',{...swapData(),coordinator:'M'});
 const account=createAccount(bot);assert.deepEqual(bot.farmers,['B','C']);assert.equal(bot.leader,'B');assert.equal(account.active(),false);
 assert.equal(account.heartbeat().seq,1);account.receive('M',{names:['B','C'],leader:'B',seq:1});assert.equal(account.active(),true);assert.equal(store.get('albot:account:C:incoming'),null);
});
function browserPort(){
 const calls=[],parent={code_slot:'shared-bot',owned_character:name=>({name,online:false}),
  code_persistence_logic:async()=>({success:true}),socket:{disconnect:()=>calls.push('disconnect')},
  location:{href:'https://adventure.land/character/A/in/EU/II/?no_html=true',assign:url=>calls.push(url)}};
 return {port:createPorts({character:{name:'A'},parent}),parent,calls};
}
test('Browser port saves CODE, logs out and replaces the same game window and realm',async()=>{
 const {port,calls}=browserPort();assert.equal(port.canSwitchCharacter('C'),true);await port.switchCharacter('C');
 assert.equal(calls[0],'disconnect');const url=new URL(calls[1]);assert.equal(url.pathname,'/character/C/in/EU/II/');
 assert.equal(url.searchParams.get('code'),'shared-bot');assert.equal(url.searchParams.get('no_html'),'true');
});
test('Browser port never disconnects on failed CODE persistence or an already online target',async()=>{
 for(const why of ['save','online']){const {port,parent,calls}=browserPort();
  if(why==='save')parent.code_persistence_logic=async()=>({success:false});else parent.owned_character=name=>({name,online:true});
  await assert.rejects(port.switchCharacter('C'));assert.equal(calls.length,0);
 }
});
test('Browser port rechecks lifecycle authorization after delayed CODE persistence',async()=>{
 const {port,parent,calls}=browserPort();let resolve,allowed=true;
 parent.code_persistence_logic=()=>new Promise(r=>{resolve=r;});
 const pending=port.switchCharacter('C',()=>allowed);allowed=false;resolve({success:true});
 await assert.rejects(pending);assert.equal(calls.length,0);
});
test('Economy reports the binding risk limit instead of silently returning no job',()=>{
 const {bot}=fixture();bot.p.c.gold=1000;bot.account=createAccount(bot);bot.economy=createEconomy(bot);
 const rule={_autoProduction:true,goldBudget:100000,lossBudget:250000};
 assert.equal(bot.economy.budget(0,14520,rule),false);
 assert.match(bot.economy.budgetExplanation(0,14520,rule),/Account-Risikobudget.*Sitzungslimit/);
 assert.equal(bot.economy.perform('upgrade',{loss:14520,rule,call:()=>assert.fail('blocked mutation must not dispatch')}),false);
 assert.match(bot.reason,/Account-Risikobudget/);
});
test('Expired bank catalog requests a new observation; only presence at bank renews it',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot}=fixture();bot.p.c.map='bank';bot.p.c.bank={items0:[{name:'ring',level:0}]};
  bot.economy={safe:i=>!!i&&!i.l,note(){}};const bank=createBank(bot);
  assert.equal(bank.observed,true);assert.equal(bank.catalogStock().length,1);
  bot.p.c.map='main';now+=120001;assert.equal(bank.observed,false);assert.equal(bank.catalogStock().length,0);
  bot.p.c.map='bank';assert.equal(bank.observed,true);assert.equal(bank.catalogStock().length,1);
  now+=120001;assert.equal(bank.observed,true,'current authoritative bank presence renews unchanged stock');
 }finally{Date.now=original;}
});
test('Routine spending no longer consumes irreversible production risk, while hour and rule caps hold',()=>{
 const {bot,store}=fixture();store.set('albot:economy:M:budget',{hour:Date.now(),spent:46920,loss:60,goals:{}});
 let checked;bot.account={spendAllowed:(c,l)=>{checked=[c,l];return c+l<=250000;}};const e=createEconomy(bot),r={_autoProduction:true,goldBudget:100000,lossBudget:250000};
 assert.equal(e.budget(0,14520,r),true);assert.deepEqual(checked,[0,14580]);
 assert.equal(e.budget(0,0,{...r,_autoDisposition:true}),true);
 bot.cfg.merchant.maxSpendPerHour=46920;assert.equal(e.budget(1,0,r),false);assert.equal(e.budget(0,0,r),true);
 assert.equal(e.budget(0,14520,{...r,lossBudget:100}),false);
});
test('Mutation exposure persists across reload; routine purchase is charged only to spending',()=>{
 const {bot,store}=fixture();bot.account={spendAllowed:(c,l)=>c+l<=100};bot.economy=createEconomy(bot);
 assert.equal(bot.economy.perform('buy',{cost:1000,call:()=>true}),true);
 assert.equal(bot.economy.ledger.spent,1000);assert.equal(bot.economy.ledger.productionExposure,0);
 bot.journal=null;
 const r={_autoProduction:true,goldBudget:1000,lossBudget:1000};
 assert.equal(bot.economy.perform('upgrade',{cost:10,loss:70,rule:r,details:{item:'ring',riskVariant:'ring0'},call:()=>true}),true);
 assert.equal(bot.economy.ledger.productionExposure,80);bot.journal=null;
 const restored=createEconomy(bot);assert.equal(restored.budget(1,20,r),false);assert.equal(restored.budget(0,20,r),true);
 assert.equal(store.get('albot:economy:M:budget').productionExposure,80);
});
test('Invalid persisted production exposure cannot grant another irreversible action',()=>{
 const {bot,store}=fixture();store.set('albot:economy:M:budget',{hour:Date.now(),spent:0,loss:0,productionExposure:-1,goals:{}});
 bot.account={spendAllowed:(c,l)=>Number.isFinite(l)&&c+l<100};const e=createEconomy(bot);
 assert.equal(e.budget(0,1,{_autoProduction:true,goldBudget:100,lossBudget:100}),false);
});
test('Designated Merchant receives one production allocation from verified bank gold; expiry and transfers revoke it',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot}=fixture();bot.cfg.production.lossBudget=250000;bot.p.c.gold=200000;bot.p.c.map='bank';bot.p.c.bank={gold:10000000,items0:[]};
  bot.economy={safe:i=>!!i};bot.bank=createBank(bot);bot.account=createAccount(bot);
  assert.equal(bot.account.risk({production:true}).sessionRiskLimit,250000);
  assert.equal(bot.account.spendAllowed(0,14520,{production:true}),true);
  bot.p.c.map='main';bot.p.c.bank=null;assert.equal(bot.account.risk({production:true}).bankEvidence.gold,10000000);
  bot.gold={reserved:true};assert.equal(bot.account.risk({production:true}).sessionRiskLimit,0);bot.gold=null;
  now+=120001;assert.equal(bot.account.risk({production:true}).bankEvidence,null);assert.equal(bot.account.risk({production:true}).sessionRiskLimit,2000);
 }finally{Date.now=original;}
});
test('Farmer cannot draw from the designated Merchant production allocation',()=>{
 const {bot}=fixture('A');const account=createAccount(bot);assert.equal(account.spendAllowed(1,0,{production:true}),false);
});
test('Global boss appearance does not replace the leveling roster with offline class choices',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,messages}=fixture();bot.cfg.party.balanceFarmers=true;bot.bosses={objective:()=>({id:'boss',recommended:['priest']}),status:()=>({active:null})};
  const account=createAccount(bot);now+=60001;account.tick();assert.equal(messages.length,0);assert.deepEqual(account.status().choice.names,['A','B']);
  now+=1740000;account.tick();assert.equal(messages[0].data.in,'C');assert.ok(account.status().choice.catchUp);
 }finally{Date.now=original;}
});
test('Coordinator preserves old published team until session-bound incoming evidence exists',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,peers,messages}=fixture();bot.cfg.party.balanceFarmers=true;const account=createAccount(bot);now+=1800001;account.tick();const m=messages[0];
  assert.deepEqual(account.heartbeat().names,['A','B']);
  account.receiveMessage('A',{type:'accountAck',id:m.id,session:'A1',data:{in:'C'}});
  peers.delete('A');peers.set('C',{...peers.get('B'),name:'C',incomingRotation:{id:'wrong'}});account.tick();assert.deepEqual(bot.farmers,['A','B']);
  peers.get('C').incomingRotation.id=m.id;account.tick();assert.deepEqual(bot.farmers,['B','C']);
 }finally{Date.now=original;}
});
test('Changing outgoing CODE session cancels old request instead of waiting for an impossible old acknowledgement',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,peers,messages}=fixture();bot.cfg.party.balanceFarmers=true;const account=createAccount(bot);now+=1800001;account.tick();
  peers.get('A').session='A-reloaded';account.tick();assert.equal(account.status().transition,null);assert.deepEqual(bot.farmers,['A','B']);
 }finally{Date.now=original;}
});
test('Receiver returns an explicit reason for an obsolete outgoing session',()=>{
 const {bot,messages}=fixture('A');const account=createAccount(bot),m=swapMessage();m.data.protocolVersion=2;m.data.outSession='old';
 account.receiveMessage('M',m);assert.equal(messages[0].type,'accountReject');assert.equal(messages[0].data.reason,'outgoing-session-changed');
});
test('Incoming farmer ignores pre-commit old team; Merchant separately proves party and group arrival',()=>{
 const {bot,store,peers}=fixture();const events=[];bot.event=(t,d)=>events.push(t);
 store.set('albot:account:M:receipt',{id:'swap1',in:'C',out:'A',realm:'EUII',joined:false,arrived:false});
 peers.get('B').party='B';peers.set('C',{...peers.get('B'),name:'C',x:1000,party:null});const account=createAccount(bot);
 account.tick();assert.equal(account.status().lastRotation.joined,false);
 peers.get('C').party='B';account.tick();assert.equal(account.status().lastRotation.joined,true);assert.equal(account.status().lastRotation.arrived,false);
 peers.get('C').x=50;account.tick();assert.equal(account.status().lastRotation.arrived,true);assert.ok(events.includes('account.party-joined'));assert.ok(events.includes('account.group-arrived'));
 const {bot:incoming,store:incomingStore}=fixture('C');incomingStore.set('albot:account:C:incoming',{...swapData(),coordinator:'M',id:'swap1'});
 const receiver=createAccount(incoming);receiver.receive('M',{names:['A','B'],leader:'B',seq:10});assert.deepEqual(incoming.farmers,['B','C']);
});
test('Current compound goal can consume its own triple while later goals keep gross sale reserves',async()=>{
 const {bot}=fixture();bot.cfg.production={...bot.cfg.production,minChance:.7,enabled:true,autonomy:true,purposeAllocation:true,compound:true,autoHelpers:false,goals:[
  {enabled:true,name:'First ring',item:'ring',level:1,quantity:1,recipient:'A',budget:10000,priority:100},
  {enabled:true,name:'Next ring',item:'ring',level:1,quantity:1,recipient:'B',budget:10000,priority:50}]};
 bot.cfg.merchant.bank=false;bot.teamPlan={candidates:()=>[]};bot.p.G.items={ring:{compound:{},g:10,grades:[0,10]},cscroll0:{type:'cscroll',g:1,s:9999}};
 bot.p.c.items[0]={name:'ring',level:0};bot.p.c.items[1]={name:'ring',level:0};bot.p.c.items[2]={name:'ring',level:0};bot.p.c.items[3]={name:'cscroll0',q:10};
 let previews=0,mutations=0;bot.p.call=(name,...args)=>{
  if(name==='item_grade')return 0;if(name==='item_value')return 10;if(name==='find_npc')return {map:'main',in:'main',x:0,y:0};
  if(name==='compound'){if(args.at(-1)===true){previews++;return {chance:.99,cost:0};}mutations++;return true;}throw Error(name);
 };
 bot.intelligence={chance:()=>.99,recordChance(){},profitGoals:()=>[],rules:()=>[],disposition:()=>null};bot.bank={pending:false,observed:true,stock:()=>0,catalogStock:()=>[]};bot.account={spendAllowed:()=>true};bot.economy=createEconomy(bot);bot.production=createProduction(bot);bot.production.planGoals();
 assert.equal(bot.production.reservedQuantity({name:'ring',level:0}),6);
 const r=bot.economy.rules({name:'ring',level:0},'production');assert.ok(r,JSON.stringify(bot.production.status()));assert.equal(r.action,'compound');
 assert.equal(bot.production.mutate(0,r),true);await new Promise(r=>setImmediate(r));
 assert.equal(bot.production.mutate(0,r),true);assert.equal(previews,1);assert.equal(mutations,1);
 bot.journal=null;bot.account.spendAllowed=()=>false;assert.equal(bot.production.mutate(0,r),false);
 const original=Date.now;Date.now=()=>original()+6000;
 try{assert.equal(bot.production.mutate(0,r),false);assert.equal(previews,1,'blocked budget suppresses repeated expired previews');
  bot.account.spendAllowed=()=>true;assert.equal(bot.production.mutate(0,r),true);assert.equal(previews,2,'verified funding can release cooldown early');
 }finally{Date.now=original;}
});
test('Browser switch can verify owned characters through the public character list',async()=>{
 const {port,parent,calls}=browserPort();delete parent.owned_character;parent.get_characters=()=>[{name:'C',online:false}];
 assert.equal(port.characterSwitchCapability('C').supported,true);await port.switchCharacter('C');assert.equal(calls[0],'disconnect');
 assert.equal(port.characterSwitchCapability('Unknown').reason,'target-not-owned');
});
test('Catch-up chooses a capable outgoing browser instead of a known unsupported one',()=>{
 const original=Date.now;let now=10000000;Date.now=()=>now;
 try{const {bot,peers,messages}=fixture();bot.cfg.party.balanceFarmers=true;peers.get('A').browserSwitch={supported:false,reason:'code-slot-missing'};
  const account=createAccount(bot);now+=1800001;account.tick();assert.equal(messages[0].to,'B');
 }finally{Date.now=original;}
});
