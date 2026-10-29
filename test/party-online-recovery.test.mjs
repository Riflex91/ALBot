import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccount,selectCatchUpSwap} from '../src/party/account.mjs';
import {discoverAccountRoster,ownSupplyCharacters} from '../src/items/potion-supply.mjs';
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
  now+=2999;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Ranger3'],'wait for verified complete three-farmer roster');
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

test('autodiscovery permits lifecycle rotation only with explicit farmer balancing',()=>{
 const chars=[{name:'A',type:'ranger',level:50,xp:123,max_xp:1000},
  {name:'B',type:'priest',level:42,xp:100,max_xp:1200},{name:'M',type:'merchant',level:70},
  {name:'Foreign',type:'alien',level:3},{name:'NoLevel',type:'warrior',level:NaN}];
 const p={c:{name:'M'},realm:()=> 'EUII',has:()=>true,call:id=>id==='get_characters'?chars:[]};
 const own=ownSupplyCharacters(p);
 assert.deepEqual(own.find(x=>x.name==='B'),{name:'B',class:'priest',level:42,xp:100,maxXp:1200});
 assert.equal(own.find(x=>x.name==='NoLevel').level,null);
 const template={role:'farmer',rotation:false,catchUp:false};
 const cfg=enabled=>({general:{autoRoster:true},party:{group:'team1',balanceFarmers:enabled},characters:[]});
 const off=discoverAccountRoster(cfg(false),p,template),on=discoverAccountRoster(cfg(true),p,template);
 assert.ok(off.characters.filter(x=>x.role==='farmer').every(x=>!x.rotation));
 assert.ok(on.characters.filter(x=>x.role==='farmer').every(x=>x.rotation));
 assert.equal(on.characters.find(x=>x.name==='M').rotation,false);
});

test('catch-up chooses the weakest offline level and replaces only a safe eligible stronger farmer',()=>{
 const members=[
  {name:'A',rotation:true,level:71,running:true,class:'ranger',xp:9,maxXp:10},
  {name:'B',rotation:true,level:68,running:true,class:'ranger'},
  {name:'C',rotation:true,level:67,running:true,class:'priest'},
  {name:'D',rotation:true,level:40,running:false,class:'ranger'},
  {name:'E',rotation:true,level:48,running:false,class:'mage'}];
 assert.deepEqual(selectCatchUpSwap(members,['A','B','C'],{levelGap:2}),
  {out:'A',in:'D',fromLevel:71,toLevel:40,gap:31});
 assert.equal(selectCatchUpSwap(members.map(m=>m.name==='D'?{...m,level:NaN}:m).map(m=>m.name==='E'?{...m,level:NaN}:m),['A','B','C']),null);
 assert.equal(selectCatchUpSwap(members,['A','B','C'],{levelGap:40}),null);
 assert.equal(selectCatchUpSwap(members.map(m=>m.name==='A'?{...m,rotation:false}:m),
  ['A','B','C'],{levelGap:2})?.out,'B');
 assert.equal(selectCatchUpSwap(members,['A','B','C'],{levelGap:2,protectedNames:['A','B','C']}),null);
 assert.equal(selectCatchUpSwap(members.map(m=>m.name==='D'?{...m,level:67}:m).filter(m=>m.name!=='E'),
  ['A','B','C'],{levelGap:5}),null);
});

test('coordinator safely swaps a stronger active farmer for an offline underleveled peer after hold',()=>{
 const oldNow=Date.now;let now=10000000;Date.now=()=>now;
 try{
  const {bot,peers,calls,events}=accountFixture(['My_Ranger1','My_Ranger2','My_Ranger3']);
  bot.cfg.party={...bot.cfg.party,leader:'',balanceFarmers:true,balanceLevelGap:2,
   balanceHoldMs:1800000};
  const levels={'My_Ranger1':70,'My_Ranger2':68,'My_Ranger3':66,'My_Rogue':35};
  const active={My_Merchant:true,My_Ranger1:true,My_Ranger2:true,My_Ranger3:true};
  bot.me.role='merchant';
  for(const [name,peer] of peers)peer.level=levels[name];
  bot.running=true;bot.p.G={monsters:{}};
  bot.transport.ownCharacters=()=>Object.entries(levels).map(([name,level])=>({
   name,class:name==='My_Rogue'?'rogue':'ranger',level}));
  bot.p.write=()=>true;
  bot.p.has=name=>['start_character','stop_character','get_active_characters'].includes(name);
  bot.p.call=(name,who)=>{
   calls.push([name,who]);
   if(name==='get_active_characters')return {...active};
   if(name==='stop_character'){delete active[who];peers.get(who).running=false;return true;}
   if(name==='start_character'){
    active[who]=true;peers.set(who,{name:who,level:levels[who],class:'rogue',running:true,
     realm:'EUII',hp:100,max_hp:100,stats:{attack:70,frequency:1,armor:5}});return true;
   }
   throw Error(name);
  };
  bot.exec.run=(key,resources,guard,fn)=>guard()?(fn(),true):false;
  const account=createAccount(bot);
  now+=60000;account.tick();
  assert.equal(calls.length,0,'no rotation before minimum training hold');
  now+=1740001;account.tick();
  assert.deepEqual(calls[0],['get_active_characters',undefined]);
  assert.deepEqual(calls[1],['stop_character','My_Ranger1']);
  assert.equal(account.status().transition.out,'My_Ranger1');
  account.tick();assert.deepEqual(calls.at(-1),['start_character','My_Rogue']);
  account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger2','My_Ranger3','My_Rogue']);
  assert.equal(account.status().transition,null);
  assert.ok(events.some(e=>e.type==='account.rotation'&&e.data.into==='My_Rogue'));
  now+=60000;account.tick();
  assert.equal(calls.filter(c=>c[0]==='stop_character').length,1,'no immediate ping-pong');
 }finally{Date.now=oldNow;}
});

test('no account lifecycle calls without trustworthy offline levels or available APIs',()=>{
 const oldNow=Date.now;let now=10000000;Date.now=()=>now;
 try{
  const {bot,calls,peers}=accountFixture(['My_Ranger1','My_Ranger2','My_Ranger3']);
  bot.cfg.party.leader='';bot.cfg.party.balanceFarmers=true;
  bot.cfg.party.balanceHoldMs=300000;
  bot.p.G={monsters:{}};bot.running=true;bot.me.role='merchant';
  for(const p of peers.values())p.level=70;
  bot.transport.ownCharacters=()=>[{name:'My_Rogue',class:'rogue',level:null}];
  bot.p.has=()=>false;
  const account=createAccount(bot);now+=600000;account.tick();
  assert.deepEqual(calls,[]);
  assert.equal(account.status().choice.catchUp,null);
 }finally{Date.now=oldNow;}
});

test('partial observed farmer roster keeps the existing conservative 15-second stabilization',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot}=accountFixture(['My_Ranger1','My_Rogue']);
  const account=createAccount(bot);
  now+=3001;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Ranger2','My_Ranger3']);
  now+=12000;account.tick();
  assert.deepEqual(bot.farmers,['My_Ranger1','My_Rogue']);
 }finally{Date.now=old;}
});
