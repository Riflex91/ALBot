import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamPlan,verifiedAreaHistory,areaRateBaseline,areaObservationSeconds,areaPressure,farmAreaHistoryKey} from '../src/world/team-plan.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {spawnLocations} from '../src/world/knowledge.mjs';

test('dangerous farm-area failure quarantines a spawn instead of instantly reselecting it',()=>{
 const events=[],G={monsters:{goo:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},maps:{main:{monsters:[{type:'goo',boundaries:[['main',0,0,100,100]]}]}}};
 const bot={p:{c:{name:'Leader',map:'main',in:'main',x:0,y:0,attack:50,frequency:1,max_hp:500,hp:500,level:20,items:[],xp:0,gold:0},G,root:{S:{}},parent:{S:{}},read:()=>null,realm:()=> 'EUII',entities:{}},
   cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:1,planHoldMs:300000,deathWindowMs:600000},world:{excludedMaps:[],cacheTtlMs:60000},party:{enabled:true}},
   me:{name:'Leader',role:'farmer',farmTargets:[]},leader:'Leader',farmers:['Leader'],transport:{fresh:()=>null},
   strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},monsters:()=>[],event:(...x)=>events.push(x),
   decisionEpoch:1,movement:{order:null,stop(){}},gear:{snapshot:()=>({})},content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);plan.tick();const first=plan.heartbeat();
 assert.ok(first?.key,'first viable area selected');
 plan.failed('Gefährliche Aggro');assert.ok(events.some(([type,d])=>type==='plan.quarantined'&&d.key===first.key));
 bot.decisionEpoch=2;plan.tick();
 assert.equal(plan.heartbeat(),null,'dangerous area must not be immediately reused');
});

test('overpowered roaming hostile without self-aggro does not trigger flee',()=>{
 const calls=[],monster={id:'greenjr-1',mtype:'greenjr',type:'monster',map:'main',in:'main',x:60,y:0,real_x:60,real_y:0,hp:10000,max_hp:10000,range:40,aggro:1};
 const c={name:'Farmer',map:'main',in:'main',x:0,y:0,range:100,speed:50,hp:900,max_hp:1000,mp:100,max_mp:100,items:[],slots:{},gold:0,ctype:'ranger',rip:false};
 const bot={p:{c,G:{monsters:{greenjr:{aggro:1,range:40,boss:true}},maps:{main:{}}},parent:{is_pvp:false},call:(name)=>name==='can_move_to'?true:false},
   cfg:{farming:{enabled:false,deathWindowMs:600000,restBelow:.4,resumeAbove:.9,freeSlots:3,maxAggro:2,kiting:true,hpBelow:.7,mpBelow:.5},party:{enabled:false}},
   me:{name:'Farmer',role:'farmer'},reason:'',monsters:()=>[monster],strategy:{safeTarget:()=>false,failActivity:(...a)=>calls.push(['fail',...a])},
   movement:{order:null,stop:()=>calls.push(['stop']),local:(...a)=>calls.push(['local',...a])},
   navigation:{orbit:()=>false},skills:{rotation:()=>calls.push(['rotate'])},
   logistics:{handoffActive:false,reserved:false},bank:{pending:false},gold:{reserved:false},exec:{pending:new Map()},target:null,free:()=>20,
   account:{active:()=>true},event:()=>{},transport:{fresh:()=>null}};
 createFarmer(bot).tick();
 assert.equal(calls.some(x=>x[0]==='fail'),false);
 assert.equal(calls.some(x=>x[0]==='local'),false);
 assert.doesNotMatch(bot.reason??'',/Gefahrenrückzug/);
});

test('audit G01 follower assists existing safe fight instead of opening another pull',()=>{
 const commands=[],mob={id:'bee-1',mtype:'bee',type:'monster',hp:100,max_hp:100,target:'Leader',map:'main',in:'main',x:50,y:0};
 const c={name:'Follower',ctype:'ranger',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,range:200,rip:false,items:[],slots:{}};
 const leader={name:'Leader',running:true,rip:false,realm:'EUII',map:'main',in:'main',x:150,y:0,target:mob.id};
 const bot={p:{c,G:{items:{},monsters:{bee:{}},maps:{main:{}}},parent:{is_pvp:false},call:(name)=>{if(name==='can_attack')return true;if(name==='is_on_cooldown')return false;if(name==='attack')commands.push('attack');if(name==='change_target')commands.push('target');return false;},realm:()=> 'EUII'},
 cfg:{farming:{enabled:true,loot:false,autoTravel:false,restBelow:.3,resumeAbove:.8,hpBelow:.5,mpBelow:.2,freeSlots:1,rangeBuffer:10,deathWindowMs:600000},party:{enabled:true,followDistance:100,waitForTeam:false,focusFire:false}},
 me:{name:'Follower',role:'farmer'},leader:'Leader',farmers:['Leader','Follower'],teamNames:['Leader','Follower'],
 monsters:()=>[mob],allowed:()=>true,entity:()=>mob,
 transport:{fresh:()=>leader},strategy:{safeTarget:()=>true,busy:false,travel:()=>false},
 logistics:{handoffActive:false,reserved:false},bank:{pending:false},gold:{reserved:false},free:()=>20,
 account:{active:()=>true},movement:{order:null,go:()=>commands.push('follow'),stop:()=>commands.push('stop')},
 skills:{rotation:t=>commands.push(t?'offense':'support-only')},exec:{run:(key,res,guard,invoke)=>guard()?!!(invoke(),true):false},reason:''};
 createFarmer(bot).tick();
 assert.ok(commands.includes('offense'));assert.ok(commands.includes('attack'));
 assert.equal(commands.includes('follow'),false);
});

test('audit G02 leader starts one bounded regroup after 45 seconds of stalled formation',()=>{
 const clock=Date.now;let time=1000000;Date.now=()=>time;
 try{
  let stops=0,starts=0,events=0;
  const c={name:'Leader',ctype:'ranger',map:'main',in:'main',x:0,y:0,range:200,hp:100,max_hp:100,mp:100,max_mp:100,rip:false,items:[]};
  const peer={name:'Follower',running:true,rip:false,realm:'EUII',map:'main',in:'main',x:500,y:0};
  const moves=[];
  const bot={p:{c,parent:{is_pvp:false},G:{items:{},maps:{main:{}},monsters:{}},realm:()=> 'EUII',call:(name)=>name==='can_move_to'},
   cfg:{general:{},farming:{enabled:true,loot:false,autoTravel:false,freeSlots:1,hpBelow:.5,mpBelow:.2,restBelow:.4,resumeAbove:.8,deathWindowMs:600000},party:{enabled:true,followDistance:100,waitForTeam:true}},
   me:{name:'Leader',role:'farmer'},leader:'Leader',teamNames:['Leader','Follower'],farmers:['Leader','Follower'],
   transport:{fresh:n=>n==='Follower'?peer:null},account:{active:()=>true},logistics:{handoffActive:false,reserved:false},
   bank:{pending:false},gold:{reserved:false},free:()=>30,monsters:()=>[],allowed:()=>true,skills:{rotation(){}},strategy:{travel:()=>false,canVisit:()=>true},
   movement:{order:null,go(dest,owner){moves.push({dest,owner});this.order={owner};},stop(){stops++;this.order=null;}},event:()=>events++};
  const farmer=createFarmer(bot);farmer.tick();assert.equal(moves.length,0);
  time+=46000;farmer.tick();assert.deepEqual(moves.map(m=>m.owner),['cohesion']);
  assert.equal(moves[0].dest.x,250);assert.equal(events,1);
  farmer.tick();assert.equal(moves.length,1,'ongoing recovery is not restarted');
  peer.x=60;time+=1000;farmer.tick();assert.equal(bot.movement.order,null,'recovered formation releases the leader');
  assert.ok(stops>=1);
 }finally{Date.now=clock;}
});

test('spawn history rejects malformed persistence before learned farm scoring',()=>{
 const now=1000000;
 const valid={at:now-10,seconds:60,xp:120,gold:30,empty:15,foreign:3,deaths:0,lostKills:0};
 assert.deepEqual(verifiedAreaHistory(valid,now),valid);
 for(const change of [
  {seconds:0},{seconds:NaN},{xp:-1},{xp:Infinity},{gold:NaN},
  {empty:61},{empty:-1},{foreign:-2},{deaths:-1},
  {lostKills:1.5},{at:now+1},{at:Infinity}
 ])assert.equal(verifiedAreaHistory({...valid,...change},now),null);
 assert.equal(verifiedAreaHistory([],now),null);
 assert.equal(verifiedAreaHistory(null,now),null);
});

test('corrupt persisted area counters are replaced before next observation',()=>{
 const source={at:1000,seconds:NaN,xp:Infinity,gold:-1,empty:100,foreign:0,deaths:0,lostKills:0};
 assert.equal(verifiedAreaHistory(source,2000),null);
 const valid={at:2000,seconds:1,xp:0,gold:0,empty:0,foreign:0,deaths:0,lostKills:0,samples:1};
 assert.deepEqual(verifiedAreaHistory(valid,2000),valid);
});

test('spawn measurement baseline excludes XP and gold earned during area transition',()=>{
 assert.deepEqual(areaRateBaseline('main:goo','main:bee',150,60,100,20),{xp:150,gold:60});
 assert.deepEqual(areaRateBaseline('main:goo','main:goo',150,60,100,20),{xp:100,gold:20});
 assert.deepEqual(areaRateBaseline(null,'main:goo',150,60,100,20),{xp:150,gold:60});
});

test('new spawn, hour or gear bucket does not charge transit time to spawn pressure',()=>{
 assert.equal(areaObservationSeconds(null,'area-a',5000),0);
 assert.equal(areaObservationSeconds('area-a','area-b',3000),0);
 assert.equal(areaObservationSeconds('area-a','area-a',3000),3);
 assert.equal(areaObservationSeconds('area-a','area-a',9000),5);
 assert.equal(areaObservationSeconds('area-a','area-a',NaN),0);
});

test('historical spawn crowd pressure decays and expires without inventing safety approval',()=>{
 const row={at:1000,seconds:100,empty:80,foreign:300};
 assert.deepEqual(areaPressure(row,1000,1000),{empty:.8,foreign:3});
 assert.deepEqual(areaPressure(row,1500,1000),{empty:.4,foreign:1.5});
 assert.deepEqual(areaPressure(row,2000,1000),{empty:0,foreign:0});
 assert.deepEqual(areaPressure(row,500,1000),{empty:0,foreign:0});
 assert.deepEqual(areaPressure(null,1500,1000),{empty:0,foreign:0});
});

test('farm area identity is stable across heartbeat churn but changes with actual team gear',()=>{
 const gear={class:'ranger',level:60,complete:true,session:'first',at:100,
  slots:{mainhand:{name:'bow',level:4}},stats:{attack:300,frequency:1.3}};
 const first=farmAreaHistoryKey('EUII',12,'main:goo:0',[gear]);
 assert.equal(farmAreaHistoryKey('EUII',12,'main:goo:0',[{...gear,at:999,session:'later',hp:1}]),first);
 assert.notEqual(farmAreaHistoryKey('EUII',12,'main:goo:0',[{...gear,stats:{attack:310,frequency:1.3}}]),first);
 assert.notEqual(farmAreaHistoryKey('EUII',13,'main:goo:0',[gear]),first);
 assert.notEqual(farmAreaHistoryKey('EUII',12,'main:bee:0',[gear]),first);
});

test('team plan ranking uses previously observed semantic-gear spawn samples',()=>{
 const now=Date.now(),gear={class:'ranger',level:20,complete:true,session:'recent',
  slots:{mainhand:{name:'bow',level:2}},stats:{attack:50,frequency:1}};
 const G={monsters:{goo:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},
  maps:{main:{monsters:[{type:'goo',count:1,boundaries:[['main',0,0,100,100]]}]}}};
 const spawn=spawnLocations(G,['goo'])[0];
 const key=farmAreaHistoryKey('EUII',new Date(now).getUTCHours(),spawn.key,[gear]);
 const history={[key]:{at:now-1000,seconds:120,xp:0,gold:0,empty:110,foreign:0,deaths:0,lostKills:0}};
 const bot={p:{c:{name:'Leader',map:'main',in:'main',x:0,y:0,attack:50,frequency:1,
   max_hp:500,hp:500,level:20,items:[],xp:0,gold:0},G,root:{S:{}},parent:{S:{}},
   read:()=>history,realm:()=> 'EUII',entities:{}},
  cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:1,
   knowledgeFreshMs:600000,planHoldMs:300000},world:{excludedMaps:[],cacheTtlMs:60000},
   party:{enabled:true}},
  me:{name:'Leader',role:'farmer',farmTargets:[]},leader:'Leader',farmers:['Leader'],
  transport:{fresh:()=>null},strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},
  monsters:()=>[],event:()=>{},decisionEpoch:1,
  movement:{order:null,stop(){}},gear:{snapshot:()=>({...gear,at:now,session:'changed'})},
  content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);plan.tick();
 const first=plan.status().ranking[0];
 assert.equal(first?.pressure,'spawn-starved','known empty spawn should remain visible in ranking');
 assert.ok(first.xpPerHour<30000,'recorded poor throughput must lower theoretical 36000 XP/h');
});
