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
 for(const me of cfg.characters){const c={name:me.name,map:'main',in:'main',x:0,y:0,gold:me.name==='A'?250:1000};const bot={cfg,me,session:me.name+'-session',running:true,journal:null,inventoryBlocked:false,checkpoint:{durable:true},bank:{pending:false},logistics:{reserved:false},p:{c,realm:()=> 'EUII',call(name,to,q){assert.equal(name,'send_gold');calls.push(q);c.gold-=q;bots[to].p.c.gold+=q;return Promise.resolve();}},entity:n=>bots[n]?.p.c,transport:{fresh:n=>({running:true,realm:'EUII',session:n+'-session',...bots[n]?.p.c}),send:(to,type,data,id)=>{queue.push([to,me.name,{type,data,id,session:me.name+'-session'}]);}},event(){},beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(state){if(state==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
 bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:4,onError(){}});bot.gold=createGoldLogistics(bot);bot.logistics={itemReserved:false,get reserved(){return !!bot.gold.reserved;}};bots[me.name]=bot;}
 const deliver=()=>{while(queue.length){const [to,from,m]=queue.shift();bots[to].gold.receive(from,m);}};
 return {bots,calls,deliver,queue,advance(){now+=20000;for(const b of Object.values(bots))b.exec.poll();}};
}
test('gold requires same-session acceptance and observed balances, preserves reserve and never duplicates',async()=>{
 const {bots,calls,deliver,queue}=goldFixture(),a=bots.A,m=bots.M;a.gold.poll(true);const offered=queue[0][2];assert.equal(calls.length,0);a.gold.receive('M',{type:'goldAccept',id:offered.id,session:'old',data:{quantity:100}});a.gold.poll();assert.equal(calls.length,0);deliver();a.gold.poll();await Promise.resolve();m.gold.poll();deliver();a.gold.poll();deliver();a.exec.poll();assert.deepEqual(calls,[100]);assert.equal(a.p.c.gold,150);assert.equal(m.p.c.gold,1100);assert.equal(a.journal,null);assert.equal(m.journal,null);m.gold.receive('A',offered);a.gold.poll(true);assert.equal(calls.length,1);
});
test('gold without observed effect remains unresolved instead of resending',async()=>{
 const {bots,calls,deliver,advance}=goldFixture();bots.A.p.call=()=>{calls.push('sent');return Promise.resolve();};bots.A.gold.poll(true);deliver();bots.A.gold.poll();await Promise.resolve();advance();assert.equal(bots.A.inventoryBlocked,true);assert.ok(bots.A.journal);bots.A.gold.poll(true);assert.equal(calls.length,1);
});
test('browser directory log appends chronological events once with character and session timestamp',async()=>{
 let disk='',name;const handle={getFile:async()=>({size:new TextEncoder().encode(disk).length}),createWritable:async()=>({seek:async()=>{},write:async s=>{disk+=s;},close:async()=>{}})};
 const p={c:{name:'Ranger'},G:{},headless:false,realm:()=> 'EUII',log(){},parent:{showDirectoryPicker:async()=>({name:'Desktop',getFileHandle:async n=>{name=n;return handle;}})}};
 const log=createTestReport(p,'test');log.configure({continuous:true});log.setProvider(()=>({settings:{general:{}},status:{running:true}}));log.event('decision',{reason:'Nachschub vor Produktion'});await log.chooseDirectory();log.event('action.start',{key:'send'});await log.chooseDirectory();
 assert.match(name,/^test-Ranger-\d{4}-.*Z-part001\.jsonl$/);const rows=disk.trim().split('\n').map(JSON.parse);assert.equal(rows.filter(x=>x.type==='action.start').length,1);assert.equal(rows.filter(x=>x.type==='decision')[0].reason,'Nachschub vor Produktion');assert.equal(rows.filter(x=>x.type==='session').length,1);
});
test('controlled burst uses explicit mana allocation and full burst cannot promise a remaining reserve',()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema),calls=[],c={name:'Mage',ctype:'mage',level:80,map:'main',x:0,y:0,hp:100,max_hp:100,mp:1000,max_mp:1000,range:200,slots:{}},target={id:'g',type:'monster',mtype:'goo',hp:200,map:'main',x:1,y:0};
 const bot={cfg,p:{c,G:{maps:{main:{}},skills:{burst:{class:['mage'],hostile:true,mp:0,target:true,ratio:.5},cburst:{class:['mage'],hostile:true,mp:80,ratio:.5}},items:{}},parent:{},call:(id,...args)=>id==='is_on_cooldown'?false:calls.push(args)},teamNames:['Mage'],monsters:()=>[],entity:()=>target,allowed:()=>true,running:true,exec:{run:(key,resources,guard,call)=>{if(!guard())return false;call();return true;}}};const skills=createSkills(bot);
 assert.equal(skills.use('burst',target,.25),false);assert.equal(skills.use('cburst',target,.4),true);assert.deepEqual(calls[0][1],[['g',400]]);
});

test('directory capability detects CODE or parent APIs and explains download fallback',async()=>{
 const messages=[],p={c:{name:'A'},G:{},realm:()=> 'EUII',headless:false,parent:{},root:{},log:s=>messages.push(s)};const report=createTestReport(p,'test');assert.deepEqual(report.capabilities(),{mode:'download',directory:false});assert.equal(await report.chooseDirectory(),false);assert.match(messages[0],/Browser-Downloads/);p.root.showDirectoryPicker=()=>{};assert.equal(report.capabilities().directory,true);
});

test('followers give leader quest travel priority over stale combat movement and stop when leader pauses',async()=>{
 const {createFarmer}=await import('../src/combat/farmer.mjs');const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.farming.loot=false;let leader={running:true,realm:'EUII',map:'main',in:'main',x:500,y:0,questVisit:true},stops=0,moves=0;
 const bot={cfg,me:{name:'A',role:'farmer'},leader:'L',farmers:['L','A'],journal:null,logistics:{reserved:false},p:{c:{name:'A',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,items:[]},G:{maps:{main:{}}},parent:{},realm:()=> 'EUII'},exec:{run:()=>assert.fail('Quest escort must not attack')},transport:{fresh:()=>leader},movement:{order:{owner:'combat'},stop(){stops++;this.order=null;},go(d,owner){moves++;this.order={owner};}},skills:{rotation(){}},free:()=>42,monsters:()=>[],strategy:{busy:false,travel:()=>false}};
 const farmer=createFarmer(bot);farmer.tick();assert.equal(stops,1);assert.equal(moves,1);assert.equal(bot.movement.order.owner,'follow');leader.x=10;bot.movement.order={owner:'combat'};farmer.tick();assert.equal(bot.movement.order,null);assert.match(bot.reason,/Monsterhunt/);leader.running=false;bot.movement.order={owner:'follow'};farmer.tick();assert.equal(bot.movement.order,null);assert.equal(stops,3);
});
