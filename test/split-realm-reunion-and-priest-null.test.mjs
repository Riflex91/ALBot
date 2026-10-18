import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatAssessment} from '../src/combat/threat-capability.mjs';
import {teamRealmRendezvous,nonPvpRealm,createTeamTravel} from '../src/party/travel.mjs';
import {Executor} from '../src/core/executor.mjs';
import {deliveryConfirmed} from '../src/party/transport.mjs';

const farmer=['My_Ranger1','My_Ranger2','My_Priest'];
const peer=(name,realm)=>({name,running:true,realm,rip:false,hp:3000,max_hp:4000,threats:0,
 map:'main',in:'main',x:0,y:0});
function roster(localName,localRealm,remotes){
 return teamRealmRendezvous({farmers:farmer,localName,localRealm,
  peers:Object.fromEntries(remotes.map(x=>[x.name,x]))});
}

test('Ranger1 and Ranger2 on USI plus Priest on USIV elect USI from all three farmers',()=>{
 const a=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USIV')]);
 const b=roster('My_Priest','USIV',[
  peer('My_Ranger1','USI'),peer('My_Ranger2','USI')]);
 assert.equal(a.target,'USI');
 assert.equal(b.target,'USI');
 assert.equal(a.split,true);
 assert.equal(b.split,true);
 assert.deepEqual(a.counts,{USI:2,USIV:1});
});

test('Merchant on USIV also follows the 2 of 3 Farmer consensus to USI',()=>{
 const x=roster('My_Merchant','USIV',[
  peer('My_Ranger1','USI'),peer('My_Ranger2','USI'),peer('My_Priest','USIV')]);
 assert.equal(x.complete,true);
 assert.equal(x.split,true);
 assert.equal(x.target,'USI');
 const reunited=roster('My_Merchant','USI',farmer.map(n=>peer(n,'USI')));
 assert.equal(reunited.complete,true);
 assert.equal(reunited.split,false);
});

test('No return hop if already united, incomplete or no trusted fresh selected farmer',()=>{
 const unified=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USI')]);
 assert.equal(unified.complete,true);
 assert.equal(unified.split,false);
 const missing=roster('My_Ranger1','USI',[peer('My_Ranger2','USI')]);
 assert.equal(missing.complete,false);
 assert.equal(missing.target,null);
 const dead=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),{...peer('My_Priest','USIV'),running:false}]);
 assert.equal(dead.complete,false);
 const pvp=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USPVP')]);
 assert.equal(pvp.complete,false);
 assert.equal(nonPvpRealm('USIV'),true);
});

test('Configured home or fixed leader overrides majority only when explicitly specified',()=>{
 const peers={
  My_Ranger1:peer('My_Ranger1','USI'),
  My_Ranger2:peer('My_Ranger2','USI'),
  My_Priest:peer('My_Priest','USIV')};
 const home=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,homeRealm:'USIV'});
 assert.equal(home.target,'USIV');
 const leader=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,fixedLeader:'My_Priest'});
 assert.equal(leader.target,'USIV');
 const invalid=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,homeRealm:'USPVP'});
 assert.equal(invalid.target,'USI');
});

test('New Priest threat emergency does not read rip of null unobserved team peer',()=>{
 const c={name:'My_Priest',ctype:'priest',hp:2500,max_hp:3000,rip:false,
  map:'main',in:'main',x:0,y:0};
 let ranger=null;
 const bot={farmers:farmer,me:{name:'My_Priest'},running:true,
  p:{c,realm:()=> 'USIV',G:{monsters:{greenjr:{aggro:1}}}},
  transport:{fresh:n=>n==='My_Ranger1'?ranger:null},
  monsters:()=>[],event(){}};
 const evaluator=createCombatAssessment(bot);
 assert.doesNotThrow(()=>evaluator.emergency());
 assert.deepEqual(evaluator.emergency(),{
  active:false,monsters:[],critical:[],anchor:null});
 ranger={...peer('My_Ranger1','USI'),hp:200,max_hp:4000,threats:1,received:Date.now()};
 assert.equal(evaluator.emergency().active,false,'cross-server injured farmer does not trigger a fake local emergency');
 ranger={...ranger,realm:'USIV'};
 assert.equal(evaluator.emergency().active,true);
 assert.equal(evaluator.emergency().critical[0].name,'My_Ranger1');
 ranger={...ranger,received:Date.now()-8000};
 assert.equal(evaluator.emergency().active,false,'stale health data may not control Priest movement');
 evaluator.close();
});


function serverFixture({name='My_Priest',realm='USIV',engaged=false,allPresent=true,
  registry=true,homeRealm='',homeOnline=true,autoHop=false}={}){
 const store=new Map(),events=[],calls=[],peers={
  My_Ranger1:peer('My_Ranger1','USI'),
  My_Ranger2:peer('My_Ranger2','USI'),
  My_Priest:peer('My_Priest','USIV')};
 const official=registry?[{region:'US',name:'I',players:22,online:true,pvp:false},
  {region:'US',name:'IV',players:17,online:true,pvp:false},
  {region:'EU',name:'II',players:15,online:homeOnline,pvp:false}]:[];
 const p={c:{name,rip:false,q:{},map:'main',hp:1500,max_hp:2000},
  root:{},parent:{X:{servers:official},socket:{connected:true}},
  realm:()=>realm,
  read:key=>store.get(key)??null,
  write:(key,value)=>{store.set(key,structuredClone(value));return true;},
  call:(method,...args)=>{calls.push([method,...args]);return Promise.resolve(true);}};
 const cfg={world:{serverHop:true,allowedRealms:['USI','USIV','EUII'],
  homeRealm,hopCooldownMs:300000,autoHop,magiport:false},
  party:{enabled:true,leader:'',merchant:'My_Merchant'},
  general:{testLogging:true,messageTtlMs:12000},farming:{}};
 const bot={p,cfg,me:{name},session:name+'-session',farmers:farmer,
  running:true,inventoryBlocked:false,journal:null,bank:{pending:false},
  logistics:{reserved:false},lifecycleChanging:false,
  movement:{stop:()=>{}},transport:{fresh:n=>
   (!allPresent&&n==='My_Ranger2'?null:peers[n]??null)},
  monsters:()=>engaged?[{id:'m1',target:'My_Priest',hp:100,type:'monster'}]:[],
  event:(type,data)=>events.push({type,data})};
 bot.exec=new Executor({now:()=>Date.now(),active:()=>bot.running,limit:8,
  retryDelay:()=>3000,onEvent:()=>{},onError:()=>{}});
 return {bot,peers,events,calls,store};
}

test('actual team-travel controller issues one guarded change_server US I for stranded Priest',()=>{
 const a=serverFixture();
 const travel=createTeamTravel(a.bot);
 travel.tick();
 assert.equal(travel.blocked,true);
 assert.equal(travel.status().reunion.target,'USI');
 assert.deepEqual(a.calls.filter(x=>x[0]==='change_server'),[['change_server','US','I']]);
 assert.equal(a.events.some(x=>x.type==='server.reunion.commit'),true);
 travel.tick();
 assert.equal(a.calls.filter(x=>x[0]==='change_server').length,1);
 travel.close();
});

test('server reunion stays still when all farmer evidence missing or destination is unverified',()=>{
 const missing=serverFixture({allPresent:false});
 const a=createTeamTravel(missing.bot);a.tick();
 assert.equal(a.status().reunion.complete,false);
 assert.equal(missing.calls.filter(x=>x[0]==='change_server').length,0);
 a.close();
 const unknown=serverFixture({registry:false});
 const b=createTeamTravel(unknown.bot);b.tick();
 assert.equal(b.status().reunion.target,'USI');
 assert.equal(unknown.calls.filter(x=>x[0]==='change_server').length,0);
 b.close();
});

test('server reunion defers to immediate defense during actual attack, never abandons healer',()=>{
 const fixture=serverFixture({engaged:true});
 const travel=createTeamTravel(fixture.bot);
 travel.tick();
 assert.equal(travel.blocked,false,'combat scheduler must remain usable');
 assert.equal(fixture.calls.filter(x=>x[0]==='change_server').length,0);
 travel.close();
});

test('official CM reports no success when receiver is on another game server',()=>{
 assert.equal(deliveryConfirmed({locals:[],receivers:[]},'My_Priest'),false);
 assert.equal(deliveryConfirmed({locals:[],receivers:['My_Priest']},'My_Priest'),true);
 assert.equal(deliveryConfirmed({failed:true,receivers:['My_Priest']},'My_Priest'),false);
 assert.equal(deliveryConfirmed(true,'My_Priest'),true,'local IPC may only return boolean');
});

test('explicit EUII home is a deterministic rendezvous even with no remote CM or discovered roster',()=>{
 for(const name of ['My_Ranger1','My_Ranger2','My_Priest','My_Merchant']){
  const x=teamRealmRendezvous({farmers:[],localName:name,
   localRealm:name==='My_Ranger1'?'USI':'USIV',peers:{},homeRealm:'EUII'});
  assert.equal(x.complete,true);
  assert.equal(x.target,'EUII');
  assert.equal(x.split,true);
  assert.equal(x.source,'configured-home');
 }
 const atHome=teamRealmRendezvous({farmers:[],localName:'My_Priest',
  localRealm:'EUII',peers:{},homeRealm:'EUII'});
 assert.equal(atHome.split,false);
});

test('Priest and Merchant independently converge on EUII with absent cross-realm heartbeats',()=>{
 for(const name of ['My_Priest','My_Merchant']){
  const x=serverFixture({name,realm:'USIV',allPresent:false,homeRealm:'EUII'});
  const t=createTeamTravel(x.bot);
  t.tick();
  assert.equal(t.status().reunion.target,'EUII');
  assert.deepEqual(x.calls.filter(call=>call[0]==='change_server'),
   [['change_server','EU','II']]);
  t.tick();
  assert.equal(x.calls.filter(call=>call[0]==='change_server').length,1);
  t.close();
 }
});

test('explicit home never sends an unsafe hop without server NORMAL registry, limit or combat clearance',()=>{
 for(const opts of [
  {registry:false},{homeOnline:false},{engaged:true}
 ]){
  const f=serverFixture({...opts,homeRealm:'EUII',allPresent:false});
  const t=createTeamTravel(f.bot);t.tick();
  assert.equal(f.calls.some(c=>c[0]==='change_server'),false);
  t.close();
 }
 const cooling=serverFixture({homeRealm:'EUII',allPresent:false});
 cooling.store.set('albot:hop:My_Priest',Date.now()-1000);
 const tc=createTeamTravel(cooling.bot);tc.tick();
 assert.equal(cooling.calls.some(c=>c[0]==='change_server'),false);
 tc.close();
 const capped=serverFixture({homeRealm:'EUII',allPresent:false});
 const now=Date.now();
 capped.store.set('albot:hop-history:My_Priest',[now-2400000,now-1500000,now-600000]);
 const tl=createTeamTravel(capped.bot);tl.tick();
 assert.equal(capped.calls.some(c=>c[0]==='change_server'),false);
 tl.close();
});

test('restart preserves hop cooldown and failed-to-arrive sessions do not oscillate',()=>{
 const a=serverFixture({homeRealm:'EUII',allPresent:false});
 const original=createTeamTravel(a.bot);original.tick();
 assert.equal(a.calls.filter(x=>x[0]==='change_server').length,1);
 original.close();
 a.bot.lifecycleChanging=false;
 const afterRestart=createTeamTravel(a.bot);afterRestart.tick();
 assert.equal(a.calls.filter(x=>x[0]==='change_server').length,1);
 afterRestart.close();
});

test('high spawn pressure and autoHop cannot split a character already on explicit EUII home',()=>{
 const f=serverFixture({realm:'EUII',homeRealm:'EUII',autoHop:true,allPresent:false});
 f.bot.leader='My_Priest';
 f.bot.teamPlan={status:()=>({pressure:.95})};
 f.store.set('albot:home-return:My_Priest',
  {realm:'EUII',phase:'checking',enteredAt:Date.now()-180000,retryAt:0,prior:null});
 const t=createTeamTravel(f.bot);
 t.tick();t.tick();
 assert.equal(f.calls.filter(c=>c[0]==='change_server').length,0);
 assert.equal(t.status().reunion.target,'EUII');
 assert.equal(f.events.some(e=>e.type==='server.homeEscapeDeferred'),true);
 t.close();
});
