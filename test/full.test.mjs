import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor,validateProfile,importProfile,envelope} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {P3P4_DESCRIPTOR} from '../src/config/p3p4.mjs';
import {createGoldLogistics} from '../src/items/gold.mjs';
import {selectAccountTeam} from '../src/party/account.mjs';
import {Executor} from '../src/core/executor.mjs';
import {createTestReport} from '../src/core/test-report.mjs';
import {createSkills} from '../src/combat/skills.mjs';

test('full profile migration preserves P3/P4 rules and removes updater entirely',()=>{
 const cfg=defaultsFor(P3P4_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(P3P4_DESCRIPTOR.schema.properties.characters.items),name:'A'}];cfg.merchant.goldReserve=123456;
 const next=importProfile(FULL_DESCRIPTOR,envelope(P3P4_DESCRIPTOR,cfg));assert.deepEqual(validateProfile(FULL_DESCRIPTOR,next),[]);assert.equal(next.general.testLogging,true);assert.equal(next.merchant.goldReserve,123456);assert.equal(next.general.autoUpdate,undefined);assert.equal(FULL_DESCRIPTOR.schema.properties.general.properties.autoUpdate,undefined);
});
test('adaptive team uses effective gear and complements fixed leader with healer at boss',()=>{
 const members=[{name:'Lead',class:'ranger',rotation:false,running:true,level:60},{name:'Weak',class:'ranger',rotation:true,level:60,stats:{attack:30,max_hp:500}},{name:'Strong',class:'ranger',rotation:true,level:60,stats:{attack:600,max_hp:5000}},{name:'Heal',class:'priest',rotation:true,level:40,stats:{attack:100,max_hp:2000}}];
 assert.deepEqual(selectAccountTeam(members.filter(x=>x.class!=='priest'),2,{leader:'Lead',current:['Lead'],synergy:true}),['Lead','Strong']);assert.deepEqual(selectAccountTeam(members,3,{leader:'Lead',current:['Lead'],synergy:true,boss:true}),['Lead','Heal','Strong']);
});
function goldFixture(){
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.party.merchant='M';cfg.merchant.collectGold=true;cfg.merchant.goldTransferMax=100;cfg.merchant.goldCollectBelow=50;cfg.merchant.goldReserve=100;
 cfg.characters=['A','M'].map(name=>({...defaultsFor(FULL_DESCRIPTOR.schema.properties.characters.items),name,role:name==='M'?'merchant':'farmer',goldReserve:100}));
 const bots={},queue=[],calls=[];let now=Date.now();
 for(const me of cfg.characters){const store=new Map(),c={name:me.name,map:'main',in:'main',x:0,y:0,gold:me.name==='A'?250:1000};const bot={cfg,me,session:me.name+'-session',running:true,journal:null,inventoryBlocked:false,checkpoint:{durable:true},bank:{pending:false},logistics:{reserved:false},p:{c,realm:()=> 'EUII',read:k=>store.get(k)??null,write:(k,value)=>{store.set(k,value);return true;},call(name,to,q){assert.equal(name,'send_gold');calls.push(q);c.gold-=q;bots[to].p.c.gold+=q;return Promise.resolve();}},entity:n=>bots[n]?.p.c,transport:{fresh:n=>({running:true,realm:'EUII',session:n+'-session',...bots[n]?.p.c}),send:(to,type,data,id)=>{queue.push([to,me.name,{type,data,id,session:me.name+'-session'}]);}},event(){},beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(state){if(state==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
 bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});bot.gold=createGoldLogistics(bot);bot.logistics={itemReserved:false,get reserved(){return !!bot.gold.reserved;}};bots[me.name]=bot;}
 const deliver=()=>{while(queue.length){const [to,from,m]=queue.shift();bots[to].gold.receive(from,m);}};
 return {bots,calls,deliver,queue,advance(){now+=20000;for(const b of Object.values(bots))b.exec.poll();}};
}
test('gold requires same-session acceptance and observed balances, preserves reserve and never duplicates',async()=>{
 const {bots,calls,deliver,queue}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);const offered=queue[0][2];assert.equal(calls.length,0);a.gold.receive('M',{type:'goldAccept',id:offered.id,session:'old',data:{quantity:100}});a.gold.poll();assert.equal(calls.length,0);deliver();a.gold.poll();await Promise.resolve();m.gold.poll();deliver();a.gold.poll();deliver();a.exec.poll();assert.deepEqual(calls,[150]);assert.equal(a.p.c.gold,100);assert.equal(m.p.c.gold,1150);assert.equal(a.journal,null);assert.equal(m.journal,null);m.gold.receive('A',offered);a.gold.poll(true);assert.equal(calls.length,1);
});
test('gold without observed effect retains its journal for late receipts and never resends',async()=>{
 const {bots,calls,deliver,advance}=goldFixture();bots.A.p.call=()=>{calls.push('sent');return Promise.resolve();};bots.A.gold.poll(true);deliver();bots.A.gold.poll();await Promise.resolve();advance();assert.equal(bots.A.inventoryBlocked,false);assert.ok(bots.A.journal);assert.equal(bots.A.gold.status()?.state,'sent');bots.A.gold.poll(true);assert.equal(calls.length,1);
});
test('browser directory log appends chronological events once with character and session timestamp',async()=>{
 let disk='',name;const handle={getFile:async()=>({size:new TextEncoder().encode(disk).length}),createWritable:async()=>({seek:async()=>{},write:async s=>{disk+=s;},close:async()=>{}})};
 const p={c:{name:'Ranger'},G:{},headless:false,realm:()=> 'EUII',log(){},parent:{showDirectoryPicker:async()=>({name:'Desktop',getFileHandle:async n=>{name=n;return handle;}})}};
 const log=createTestReport(p,'test');log.configure({continuous:true});log.setProvider(()=>({settings:{general:{}},status:{running:true}}));log.event('decision',{reason:'Nachschub vor Produktion'});await log.chooseDirectory();log.event('action.start',{key:'send'});await log.chooseDirectory();
 assert.match(name,/^albot-live-Ranger-part001\.jsonl$/);const rows=disk.trim().split('\n').map(JSON.parse);assert.equal(rows.filter(x=>x.type==='action.start').length,1);assert.equal(rows.filter(x=>x.type==='decision')[0].reason,'Nachschub vor Produktion');assert.equal(rows.filter(x=>x.type==='session').length,1);
});
test('controlled burst uses explicit mana allocation and full burst cannot promise a remaining reserve',()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema),calls=[],c={name:'Mage',ctype:'mage',level:80,map:'main',x:0,y:0,hp:100,max_hp:100,mp:1000,max_mp:1000,range:200,slots:{}},target={id:'g',type:'monster',mtype:'goo',hp:200,map:'main',x:1,y:0};
 const bot={cfg,p:{c,G:{maps:{main:{}},skills:{burst:{class:['mage'],hostile:true,mp:0,target:true,ratio:.5},cburst:{class:['mage'],hostile:true,mp:80,ratio:.5}},items:{}},parent:{},call:(id,...args)=>id==='is_on_cooldown'?false:calls.push(args)},teamNames:['Mage'],monsters:()=>[],entity:()=>target,allowed:()=>true,running:true,exec:{run:(key,resources,guard,call)=>{if(!guard())return false;call();return true;}}};const skills=createSkills(bot);
 assert.equal(skills.use('burst',target,.25),false);assert.equal(skills.use('cburst',target,.4),true);assert.deepEqual(calls[0][1],[['g',445]]) // 200 HP / (0.5 ratio × 0.9 lower damage bound), rounded up;
});

test('directory capability detects CODE or parent APIs and explains download fallback',async()=>{
 const messages=[],p={c:{name:'A'},G:{},realm:()=> 'EUII',headless:false,parent:{},root:{},log:s=>messages.push(s)};const report=createTestReport(p,'test');assert.deepEqual(report.capabilities(),{mode:'download',directory:false});assert.equal(await report.chooseDirectory(),false);assert.match(messages[0],/Browser-Downloads/);p.root.showDirectoryPicker=()=>{};assert.equal(report.capabilities().directory,true);
});

test('followers stop combat movement and never chase a leader on a personal Monsterhunt NPC visit',async()=>{
 const {createFarmer}=await import('../src/combat/farmer.mjs');const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.farming.loot=false;let leader={running:true,realm:'EUII',map:'main',in:'main',x:500,y:0,questVisit:true},stops=0,moves=0;
 const bot={cfg,me:{name:'A',role:'farmer'},leader:'L',farmers:['L','A'],journal:null,logistics:{reserved:false},p:{c:{name:'A',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,items:[]},G:{maps:{main:{}}},parent:{},realm:()=> 'EUII'},exec:{run:()=>assert.fail('Quest escort must not attack')},transport:{fresh:()=>leader},movement:{order:{owner:'combat'},stop(){stops++;this.order=null;},go(d,owner){moves++;this.order={owner};}},skills:{rotation(){}},free:()=>42,monsters:()=>[],strategy:{busy:false,travel:()=>false}};
 const farmer=createFarmer(bot);farmer.tick();assert.equal(stops,1);assert.equal(moves,0);assert.equal(bot.movement.order,null);assert.match(bot.reason,/Monsterhunt/);leader.x=10;bot.movement.order={owner:'combat'};farmer.tick();assert.equal(bot.movement.order,null);assert.match(bot.reason,/Monsterhunt/);leader.running=false;bot.movement.order={owner:'follow'};farmer.tick();assert.equal(bot.movement.order,null);assert.equal(stops,3);
});

test('gold handoff rebases dispatch balance after legitimate farm income without losing reserve',async()=>{const {bots,calls,deliver}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);a.p.c.gold+=7;deliver();a.p.c.gold+=3;a.gold.poll();assert.equal(a.journal.before,260);assert.deepEqual(calls,[150]);m.gold.poll();deliver();a.gold.poll();deliver();await Promise.resolve();a.exec.poll();assert.equal(a.journal,null);assert.equal(m.journal,null);assert.equal(a.p.c.gold,110);});

test('signed recipient receipt reconciles gold handoff despite later farming income',async()=>{const {bots,calls,deliver}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);deliver();a.gold.poll();a.p.c.gold+=8;m.gold.poll();deliver();a.gold.poll();deliver();await Promise.resolve();a.exec.poll();assert.deepEqual(calls,[150]);assert.equal(a.journal,null);assert.equal(m.journal,null);assert.equal(a.p.c.gold,108);});

test('gold receiver can accept during non-inventory movement and holds the rendezvous',async()=>{const {bots,calls,deliver}=goldFixture(),a=bots.A,m=bots.M;let stopped=0;m.movement={stop(){stopped++;m.exec.cancelResource('movement');}};m.exec.run('move',['movement'],()=>true,()=>new Promise(()=>{}));a.gold.poll(true);deliver();assert.equal(stopped,1);a.gold.poll();m.gold.poll();deliver();a.gold.poll();deliver();await Promise.resolve();a.exec.poll();assert.deepEqual(calls,[150]);assert.equal(m.journal,null);});


test('accepted gold cancelled before dispatch releases receiver without transfer or unknown inventory',()=>{const {bots,calls,deliver}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);deliver();assert.equal(a.gold.status().state,'accepted');assert.equal(m.journal.kind,'gold.receive');a.gold.close();deliver();assert.deepEqual(calls,[]);assert.equal(m.journal,null);assert.equal(m.inventoryBlocked,false);assert.equal(m.gold.reserved,false);});

test('gold cancellation cannot clear an observed transfer or a different session',()=>{const {bots,deliver}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);deliver();const j=m.gold.status();m.gold.receive('A',{type:'goldCancel',id:j.id,session:'old',data:{quantity:100,notDispatched:true}});assert.ok(m.journal);a.gold.poll();m.gold.poll();m.gold.receive('A',{type:'goldCancel',id:j.id,session:'A-session',data:{quantity:100,notDispatched:true}});assert.ok(m.journal);deliver();a.gold.poll();deliver();assert.equal(m.journal,null);});

import {createLogistics} from '../src/items/logistics.mjs';

function itemHandoffFixture(){
 const cfg={general:{messageTtlMs:30000},merchant:{enabled:true,pickup:true,supply:true,maxDelivery:10,minFreeSlots:0},farming:{freeSlots:0},
  items:[
   {enabled:true,action:'send',item:'hpot1',recipient:'B',character:'A',role:'all',minLevel:0,maxLevel:0,keep:0,teamReserve:0,batch:2,ttlMs:30000},
   {enabled:true,action:'keep',item:'hpot1',character:'B',role:'all',minLevel:0,maxLevel:0,keep:0,teamReserve:0,targetCount:2,maxCount:10,requestBelow:2}
  ]};
 const bots={},queue=[],sent=[];let clock=0;
 const makeBot=(name,session)=>{
  const me={name,role:'farmer'},c={name,map:'main',in:'main',x:0,y:0,items:Array(6).fill(null)};
  if(name==='A')c.items[0]={name:'hpot1',q:2};
  const bot={cfg,me,session,running:true,journal:null,inventoryBlocked:false,checkpoint:{durable:true},
   p:{c,G:{items:{hpot1:{}}},realm:()=> 'EUII',call(kind,...args){if(kind==='send_item'){sent.push(args);return Promise.resolve({success:true});}throw Error('Unexpected action: '+kind);}},
   entity:other=>bots[other]?.p.c,rule:()=>cfg.items.find(r=>r.character===name),
   free:()=>c.items.filter(i=>!i).length,event(){},report(){},
   beginValue(j){assert.equal(this.journal,null);this.journal=j;},
   endValue(result){if(result==='confirmed')this.journal=null;else this.inventoryBlocked=true;},
   transport:{fresh:other=>{const peer=bots[other];return peer?{...peer.p.c,realm:'EUII',running:peer.running,rip:false,session:peer.session,items:[{item:'hpot1',need:2}]}:null;},
    send:(to,type,data,id)=>{queue.push({to,from:name,message:{type,data,id,session:bot.session}});return Promise.resolve(true);}}};
  bot.exec=new Executor({now:()=>clock,active:()=>bot.running,limit:5,onError(){}});
  bot.logistics=createLogistics(bot);return bot;
 };
 const deliver=()=>{while(queue.length){const {to,from,message}=queue.shift();bots[to].logistics.receive(from,message);}};
 return {bots,queue,sent,makeBot,deliver,advance(ms){clock+=ms;}};
}

test('item handoff refuses dispatch after accepted receiver session is replaced',()=>{
 const {bots,queue,sent,makeBot,deliver}=itemHandoffFixture();
 bots.A=makeBot('A','A-1');bots.B=makeBot('B','B-1');
 bots.A.logistics.poll(true);deliver();
 assert.ok(bots.B.journal,'Receiver must journal its accepted offer');
 assert.equal(sent.length,0,'Acceptance alone must not dispatch a transfer');
 const pendingReceiverJournal=bots.B.journal;
 bots.B.logistics.close();bots.B.running=false;
 bots.B=makeBot('B','B-2');
 bots.B.journal=pendingReceiverJournal;bots.B.inventoryBlocked=true;
 // Recipient is still nearby and has a valid new heartbeat, but its old
 // acceptance belongs to a different runtime session.
 bots.A.logistics.poll(false);
 assert.equal(sent.length,0,'Never send inventory against an obsolete acceptance');
 assert.equal(bots.A.journal,null,'Unsent transfer must not create a value journal');
 assert.equal(bots.A.exec.pending.size,0,'Old session must not retain an executor action');
 bots.A.logistics.close();bots.B.logistics.close();

 // The session can also change after an action enters the priority frame,
 // but before Executor.flush() invokes send_item. Dispatch must recheck it.
 queue.length=0;
 bots.A=makeBot('A','A-2');bots.B=makeBot('B','B-3');
 bots.A.logistics.poll(true);deliver();
 bots.A.exec.beginFrame();bots.A.logistics.poll(false);
 assert.equal(bots.A.exec.frame.length,1,'Expected a scheduled but not dispatched item action');
 const secondJournal=bots.B.journal;
 bots.B.logistics.close();
 bots.B=makeBot('B','B-4');
 bots.B.journal=secondJournal;bots.B.inventoryBlocked=true;
 bots.A.exec.flush();
 assert.equal(sent.length,0,'Executor must drop the queued action for an old recipient session');
 assert.equal(bots.A.journal,null,'Rejected queued action must not create a checkpoint');
 assert.equal(bots.A.exec.pending.size,0);
 bots.A.logistics.close();bots.B.logistics.close();
});

test('accepted item offer cancelled before dispatch on STOP releases receiver value journal',()=>{
 const {bots,queue,sent,makeBot,deliver}=itemHandoffFixture();bots.A=makeBot('A','A-1');bots.B=makeBot('B','B-1');const a=bots.A,b=bots.B;
 a.logistics.poll(true);deliver();
 assert.equal(a.journal,null,'No sender action was dispatched');
 assert.equal(b.journal?.kind,'receive','Receiver acceptance already wrote the checkpoint');
 a.running=false;a.exec.invalidate();a.logistics.close();
 assert.equal(sent.length,0,'STOP must not dispatch items');
 deliver();
 assert.equal(b.journal,null,'Session-bound no-dispatch cancel must release the acceptance checkpoint');
 assert.equal(b.inventoryBlocked,false);
 assert.equal(b.logistics.itemReserved,false);
 assert.equal(queue.length,0);
 b.logistics.close();
});

test('cancel of an undelivered item offer prevents a stranded receiving journal',()=>{
 const {bots,queue,sent,makeBot,deliver}=itemHandoffFixture();bots.A=makeBot('A','A-1');bots.B=makeBot('B','B-1');const a=bots.A,b=bots.B;
 a.logistics.poll(true);
 // Deliver the offer, but lose/delay its accept reply to the sender.
 const offer=queue.shift();assert.equal(offer.message.type,'offer');
 b.logistics.receive(offer.from,offer.message);
 assert.equal(b.journal?.kind,'receive');
 assert.equal(queue.length,1);
 const accept=queue.shift();assert.equal(accept.message.type,'accept');
 a.p.c.items[0].q=1; // Source changed before dispatch; offer is no longer safe.
 a.logistics.poll(false);
 assert.equal(a.journal,null);
 assert.deepEqual(sent,[]);
 deliver();
 assert.equal(b.journal,null,'Stock-drift cancellation must release old receiver promise');
 // Late accept cannot resurrect a sender job or dispatch an item.
 a.logistics.receive('B',accept.message);a.logistics.poll(false);
 assert.deepEqual(sent,[]);b.logistics.close();a.logistics.close();
});

test('item no-dispatch cancellation rejects wrong session, wrong ID and unsafe claims',()=>{
 // All actors share this queue and transport for realistic handoff messages.
 const setup=itemHandoffFixture();
 setup.bots.A=setup.makeBot('A','A-1');setup.bots.B=setup.makeBot('B','B-1');
 const a=setup.bots.A,b=setup.bots.B;
 a.logistics.poll(true);setup.deliver();
 const id=b.journal.id;
 for(const message of [
  {type:'itemCancel',id:'other-id',session:a.session,data:{notDispatched:true}},
  {type:'itemCancel',id,session:'old-session',data:{notDispatched:true}},
  {type:'itemCancel',id,session:a.session,data:{notDispatched:false}}
 ]){b.logistics.receive('A',message);assert.equal(b.journal?.id,id,'Untrusted cancellation must not release a checkpoint');}
 a.running=false;a.exec.invalidate();a.logistics.close();setup.deliver();
 assert.equal(b.journal,null,'Only matching no-send cancellation may reconcile');
 assert.deepEqual(setup.sent,[]);
 b.logistics.close();
});

test('already dispatched item remains blocked after STOP and late no-send cancellation',()=>{
 const {bots,makeBot,sent,deliver}=itemHandoffFixture();
 bots.A=makeBot('A','A-1');bots.B=makeBot('B','B-1');
 const a=bots.A,b=bots.B;
 a.logistics.poll(true);deliver();a.logistics.poll(false);deliver();
 assert.equal(sent.length,1);
 assert.equal(a.journal?.kind,'send');assert.equal(b.journal?.kind,'receive');
 const id=b.journal.id;
 // Even if an incorrect cancellation is delivered after a sent notification,
 // no acknowledged completion or new transfer is allowed.
 b.logistics.receive('A',{type:'itemCancel',id,session:a.session,data:{notDispatched:true}});
 assert.equal(b.journal?.id,id,'Prior sent message makes cancellation ambiguous');
 a.running=false;a.exec.invalidate();a.logistics.close();deliver();
 assert.equal(a.inventoryBlocked,true,'Sender with uncertain server effect must stay blocked');
 assert.equal(b.journal?.id,id,'Receiver retains unresolved receipt after sender STOP');
 assert.equal(sent.length,1);
 b.logistics.close();
});

test('item receiving observation prevents cancellation even without a sent notification',()=>{
 const {bots,makeBot,queue,deliver}=itemHandoffFixture();
 bots.A=makeBot('A','A-1');bots.B=makeBot('B','B-1');
 const a=bots.A,b=bots.B;
 a.logistics.poll(true);deliver();const id=b.journal.id;
 // Simulate an externally observed arrival before receiving any sent notification.
 b.p.c.items[0]={name:'hpot1',q:2};
 b.logistics.receive('A',{type:'itemCancel',id,session:a.session,data:{notDispatched:true}});
 assert.equal(b.journal?.id,id);
 a.logistics.close();deliver();
 assert.equal(b.journal?.id,id);
 b.logistics.close();
});
