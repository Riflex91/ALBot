import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor,validateProfile,exportBundle,checkPackage} from '../editor/lib/contract.mjs';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {INTEGRATION_DESCRIPTOR} from '../src/config/live-c.mjs';
import {createFairTasks} from '../src/core/fair-tasks.mjs';
import {chooseAura} from '../src/party/aura.mjs';
import {createStrategy} from '../src/world/strategy.mjs';
import {selectAccountTeam,createAccount} from '../src/party/account.mjs';
import {createTeamTravel} from '../src/party/travel.mjs';

test('real Live C runtime plus 1276 catalog rules passes package integrity, syntax and 900 KiB size gate',async()=>{
 const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'))),catalog=JSON.parse(await readFile(new URL('../editor/item-catalog.json',import.meta.url),'utf8')),cfg=defaultsFor(pkg.descriptor.schema);
 cfg.characters=[{...defaultsFor(pkg.descriptor.schema.properties.characters.items),name:'Farmer'}];cfg.party.leader='Farmer';cfg.items=catalog.items.flatMap(({id})=>['farmer','merchant'].map(role=>({...defaultsFor(pkg.descriptor.schema.properties.items.items),name:id+' '+role,item:id,role})));
 assert.deepEqual(validateProfile(pkg.descriptor,cfg),[]);const bundle=exportBundle(pkg.descriptor,cfg,pkg.runtime);new Script(bundle.code);assert.ok(bundle.bytes<=921600,bundle.bytes+' UTF-8 bytes');assert.equal(bundle.bytes,Buffer.byteLength(bundle.code));
});

test('merchant task hold stabilizes travel, aging admits waiting work, absent jobs are forgotten',()=>{
 let now=0;const q=createFairTasks({now:()=>now,holdMs:30000,starvationMs:120000}),high={id:'high',priority:10},low={id:'low',priority:0};q.rank([high,low]);q.selected('low');now=1000;assert.equal(q.rank([high,low])[0].id,'low');now=31000;assert.equal(q.rank([high,low])[0].id,'high');q.selected('high');now=121000;assert.equal(q.rank([high,low])[0].id,'low');q.rank([high]);assert.equal(q.status().waiting,1);q.clear();assert.equal(q.status().waiting,0);
});

test('paladin policy changes priority for damage pressure and resource shortage',()=>{
 assert.equal(chooseAura({hpRatio:.4,damageType:'physical'}),'bulwark');assert.equal(chooseAura({hpRatio:.4,damageType:'magical'}),'sanctuary');assert.equal(chooseAura({mpRatio:.2}),'warding');assert.equal(chooseAura({pressure:true}),'warding');assert.equal(chooseAura({}),'zeal');
});

function botFixture(){
 const cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema),calls=[],messages=[],data=new Map(),peers={};cfg.farming.targets=['goo'];cfg.party.leader='A';cfg.party.merchant='M';cfg.characters=['A','B','C'].map(name=>({...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name,class:'ranger'}));cfg.characters.push({...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'M',role:'merchant',class:'merchant'});
 const c={name:'A',ctype:'ranger',level:60,map:'main',in:'main',x:0,y:0,hp:1000,max_hp:1000,mp:1500,max_mp:1500,q:{},items:[],slots:{}};
 const bot={cfg,me:{...cfg.characters[0]},running:true,session:'A-session',leader:'A',farmers:['A','B','C'],teamNames:['A','B','C','M'],target:null,inventoryBlocked:false,journal:null,p:{c,root:{S:{}},parent:{},G:{maps:{main:{},danger:{}},monsters:{goo:{attack:1},boss:{attack:80}},events:{},skills:{magiport:{mp:900}}},read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;},realm:()=> 'EUII',has:()=>true,call:(name,...args)=>{calls.push([name,...args]);return {}; }},exec:{pending:new Map(),run:(name,locks,guard,call)=>{if(!guard())return false;call();return true;}},logistics:{reserved:false},transport:{fresh:n=>peers[n],send:(name,type,payload,id)=>{messages.push({name,type,payload,id});return Promise.resolve(true);}},movement:{stop(){},go(){return true;}},monsters:()=>[],allies:()=>[c],event(){},report(){},pause(){bot.running=false;}};
 return {bot,c,cfg,calls,messages,data,peers};
}

test('world planner rejects unlisted, excluded and over-risk encounters, returns to configured farm',()=>{
 const {bot,cfg}=botFixture();cfg.world.bosses=true;cfg.world.allowedBosses=['boss'];bot.p.root.S.boss={live:true,map:'danger',x:10,y:20};cfg.world.excludedMaps=['danger'];const strategy=createStrategy(bot);strategy.plan();assert.equal(strategy.status().activity,null);assert.equal(strategy.requestTask('farm:unknown'),false);assert.equal(strategy.requestTask('boss:unlisted'),false);cfg.world.excludedMaps=[];strategy.close();strategy.plan();assert.equal(strategy.status().activity.id,'boss');bot.p.G.monsters.boss.attack=500;strategy.close();strategy.plan();assert.equal(strategy.status().activity,null);assert.deepEqual(strategy.targets(),['goo']);
});

test('magiport cast needs matching request acknowledgement and receiver needs prior consent',()=>{
 const {bot,c,cfg,calls,messages,peers}=botFixture();cfg.world.magiport=true;c.ctype='mage';bot.me.class='mage';peers.B={name:'B',running:true,map:'main',in:'main',x:1000,y:0,realm:'EUII'};const travel=createTeamTravel(bot);travel.tick();const request=messages.find(m=>m.type==='portRequest');assert.ok(request);travel.receive('B',{type:'portAck',id:'wrong',data:{}});assert.equal(calls.length,0);travel.receive('B',{type:'portAck',id:request.id,data:{}});assert.equal(calls[0][0],'use_skill');assert.equal(calls[0][1],'magiport');assert.equal(travel.accept('B'),false);travel.receive('B',{type:'portAck',id:request.id,data:{}});assert.equal(calls.length,1);travel.close();
});

test('server hop requires allowlist, all configured team peers and no unsettled action',()=>{
 const {bot,cfg,peers,calls}=botFixture();cfg.world.serverHop=true;cfg.world.allowedRealms=['EUII','EUI'];const travel=createTeamTravel(bot);assert.equal(travel.requestHop('USI'),false);assert.equal(travel.requestHop('EUI'),false);for(const name of ['B','C','M'])peers[name]={running:true,realm:'EUII'};bot.journal={kind:'send'};assert.equal(travel.requestHop('EUI'),false);bot.journal=null;assert.equal(travel.requestHop('EUI'),true);assert.equal(travel.blocked,true);travel.receive('B',{type:'hopCommit',id:'foreign',data:{realm:'EUI'}});assert.equal(calls.length,0);travel.close();assert.equal(travel.blocked,false);
});

test('adaptive roster keeps fixed leader and unknown offline classes out of rotation',()=>{
 const names=selectAccountTeam([{name:'A',rotation:false,level:60,class:'ranger',running:true},{name:'B',rotation:true,level:20,class:'priest',catchUp:true},{name:'Unknown',rotation:true,level:0,class:'auto',catchUp:true}],2,{leader:'A',current:['A'],boss:true});assert.deepEqual(names,['A','B']);
});

test('account reload reconciles a persisted rotation by stopping replacement before restoring original',()=>{
 const {bot,cfg,data,peers,calls}=botFixture();bot.me={...cfg.characters.find(c=>c.name==='M')};bot.p.c.name='M';cfg.party.selection='adaptive';data.set('albot:account:M',{out:'B',in:'C',original:['A','B'],originalLeader:'A',names:['A','C'],leader:'A',until:Date.now()+10000});let active={C:'code'};bot.p.call=(name,...args)=>{calls.push([name,...args]);if(name==='get_active_characters')return active;};const account=createAccount(bot);account.tick();assert.equal(calls.at(-1)[0],'stop_character');assert.equal(calls.at(-1)[1],'C');active={};account.tick();assert.equal(calls.at(-1)[0],'start_character');assert.equal(calls.at(-1)[1],'B');peers.B={running:true,realm:'EUII'};account.tick();assert.deepEqual(bot.farmers,['A','B']);assert.equal(data.get('albot:account:M'),null);assert.equal(account.status().transition,null);
});

test('monsterhunt uses interact, retains travel ownership, and confirms quest state without inventory journal',()=>{
 const {bot,c,cfg,calls}=botFixture();cfg.world.quests=true;let at=false;bot.economy={destination:()=>({map:'main',in:'main',x:126,y:-413}),at:()=>at};bot.movement.go=(d,owner)=>{bot.movement.order={owner,dest:d};return false;};bot.p.call=(name,...args)=>{calls.push([name,...args]);assert.equal(name,'interact');c.s={monsterhunt:{id:'goo',c:10}};return Promise.resolve({started:true});};const strategy=createStrategy(bot);
 assert.equal(strategy.quest(),true);assert.equal(strategy.busy,true);assert.equal(bot.movement.order.owner,'quest');strategy.plan();assert.equal(strategy.requestTask('farm:goo'),false);at=true;bot.movement.order=null;assert.equal(strategy.quest(),true);assert.deepEqual(calls,[['interact','monsterhunt']]);assert.equal(bot.journal,null);strategy.quest();assert.equal(strategy.busy,false);assert.equal(strategy.quest(),false);
 const follower=botFixture();follower.cfg.world.quests=true;follower.bot.me.name='B';follower.bot.economy={destination:()=>assert.fail('Follower must not start a competing quest trip')};assert.equal(createStrategy(follower.bot).quest(),false);
});
