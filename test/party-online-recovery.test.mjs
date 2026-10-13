import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccount} from '../src/party/account.mjs';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {spawnLocations} from '../src/world/knowledge.mjs';

function accountFixture(availableNames){
 const participants=['My_Ranger1','My_Ranger2','My_Ranger3','My_Rogue'];
 const peers=new Map(availableNames.map(name=>[name,{name,running:true,rip:false,realm:'EUII',hp:100,max_hp:100,class:name==='My_Rogue'?'rogue':'ranger',stats:{attack:70,frequency:1,armor:5}}]));
 const cfg={
  party:{merchant:'My_Merchant',leader:'My_Ranger1',maxFarmers:3,selection:'adaptive',rotationCooldownMs:60000,gearSynergy:true},
  production:{lossBudget:150000},general:{messageTtlMs:10000},
  characters:participants.map(name=>({name,role:'farmer',enabled:true,rotation:true,class:name==='My_Rogue'?'rogue':'ranger'}))
 };
 const events=[],calls=[];
 const bot={cfg,me:{name:'My_Merchant'},running:true,farmers:participants.slice(0,3),leader:'My_Ranger1',
  p:{read:()=>null,write:()=>true,realm:()=> 'EUII',c:{},call:method=>{calls.push(method);return false;}},
  transport:{fresh:name=>peers.get(name)??null},exec:{pending:new Map()},monsters:()=>[],logistics:{reserved:false},
  event:(type,data)=>events.push({type,data}),report(){}};
 return {bot,events,calls,peers};
}

test('adaptive team replaces offline third ranger with already-running rogue without game account switch',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot,events,calls}=accountFixture(['My_Ranger1','My_Ranger2','My_Rogue']);
  const account=createAccount(bot);
  now+=14999;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Ranger3'],'wait for short stability interval');
  now+=2;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Rogue']);
  assert.equal(bot.leader,'My_Ranger1');
  assert.deepEqual(account.heartbeat().names,bot.farmers);
  assert.equal(account.heartbeat().seq,1);
  assert.ok(events.some(e=>e.type==='account.team'&&e.data.names.includes('My_Rogue')));
  assert.deepEqual(calls,[],'no start_character or stop_character');
 }finally{Date.now=old;}
});

test('adaptive team elects online fallback when configured combat leader disappears',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot}=accountFixture(['My_Ranger2','My_Rogue']);
  const account=createAccount(bot);
  now+=15001;account.tick();
  assert.equal(bot.leader,'My_Ranger2');
  assert.deepEqual(bot.farmers,['My_Ranger2','My_Rogue']);
 }finally{Date.now=old;}
});
test('automatic roster can select the local farmer while the merchant is offline',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot,calls}=accountFixture([]);bot.cfg.general.autoRoster=true;bot.cfg.party.leader='';bot.me={name:'My_Rogue'};bot.p.c={name:'My_Rogue',hp:100,max_hp:100,ctype:'rogue',attack:70,frequency:1};
  const account=createAccount(bot);now+=15001;account.tick();
  assert.deepEqual(bot.farmers,['My_Rogue']);assert.equal(bot.leader,'My_Rogue');assert.deepEqual(calls,[]);
 }finally{Date.now=old;}
});

test('follower receives updated team roster from coordinator heartbeat',()=>{
 const {bot}=accountFixture(['My_Ranger1','My_Ranger2','My_Rogue']);
 bot.me={name:'My_Ranger2'};
 bot.movement={stop(){}};
 bot.transport.fresh=name=>name==='My_Merchant'?{team:{names:['My_Ranger1','My_Ranger2','My_Rogue'],leader:'My_Ranger1',seq:1}}:null;
 const account=createAccount(bot);
 account.tick();
 assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Rogue']);
 assert.equal(account.active(),true);
});

test('follower does not start independent farm smart_move against the leader follow route',()=>{
 const now=Date.now();
 const G={monsters:{goo:{hp:50,attack:10,frequency:1}},maps:{main:{monsters:[{type:'goo',count:3,boundaries:[['main',0,0,100,100]]}]}}};
 const source=spawnLocations(G,['goo'],[],false)[0],moves=[];
 const plan={...source,id:'live-plan',realm:'EUII',leader:'My_Ranger1',kind:'farm',expires:now+30000,started:now,objective:null};
 const bot={p:{read:()=>null,G,root:{S:{}},parent:{S:{}},c:{name:'My_Ranger2',map:'main',in:'main',x:0,y:0},realm:()=> 'EUII'},
  cfg:{general:{testLogging:true,messageTtlMs:10000},party:{enabled:true},world:{excludedMaps:[],cacheTtlMs:60000},farming:{pvp:false}},
  me:{name:'My_Ranger2',role:'farmer'},leader:'My_Ranger1',farmers:['My_Ranger1','My_Ranger2'],
  transport:{fresh:()=>({running:true,rip:false,farmPlan:plan})},
  strategy:{busy:false,permittedMap:()=>true,safeTarget:()=>true},
  movement:{go:(...a)=>moves.push(a),stop(){},order:null},
  content:{approve:()=>true},monsters:()=>[],event(){},target:null};
 const planner=createTeamPlan(bot);
 planner.tick();
 assert.equal(planner.target(),'goo','known valid plan was adopted');
 assert.equal(planner.travel(),false,'followers should only follow actual leader location');
 assert.deepEqual(moves,[]);
});

test('coordinator restores a returning active ranger to an underfilled adaptive group',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot,peers}=accountFixture(['My_Ranger2','My_Rogue']);
  bot.farmers=['My_Ranger2','My_Rogue'];bot.leader='My_Ranger2';
  const account=createAccount(bot);
  now+=15001;account.tick();assert.deepEqual(bot.farmers,['My_Ranger2','My_Rogue']);
  peers.set('My_Ranger1',{name:'My_Ranger1',running:true,rip:false,realm:'EUII',hp:100,max_hp:100,class:'ranger',stats:{attack:70,frequency:1,armor:5}});
  now+=15001;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Rogue']);assert.equal(bot.leader,'My_Ranger1');
 }finally{Date.now=old;}
});
