import test from 'node:test';
import assert from 'node:assert/strict';
import {teamRealmRendezvous,reunionHomeRealm} from '../src/party/travel.mjs';
import {selectedFarmerAvailable,foreignRunningFarmer} from '../src/party/account.mjs';
import {liveSpawnCompetition,chooseFarmAreaSwitch} from '../src/world/spawn-choice.mjs';
import {shouldHoldOrdinaryLocation} from '../src/world/team-plan.mjs';
import {questTravelStalled} from '../src/world/strategy.mjs';

test('isolated Priest returns to EU2 when congestion escape retry expires',()=>{
 const home={phase:'escaped',retryAt:100000};
 assert.equal(reunionHomeRealm('EUII',home,'USIV',99999),'');
 assert.equal(reunionHomeRealm('EUII',home,'USIV',100000),'EUII');
 const before=teamRealmRendezvous({farmers:['My_Priest'],localName:'My_Priest',
  localRealm:'USIV',peers:{},homeRealm:reunionHomeRealm('EUII',home,'USIV',99999)});
 assert.equal(before.reason,'invalid-roster');
 const after=teamRealmRendezvous({farmers:['My_Priest'],localName:'My_Priest',
  localRealm:'USIV',peers:{},homeRealm:reunionHomeRealm('EUII',home,'USIV',100000)});
 assert.equal(after.complete,true);
 assert.equal(after.split,true);
 assert.equal(after.target,'EUII');
 assert.equal(after.reason,'configured-home-return');
 assert.equal(after.source,'configured-home');
});

test('home rendezvous cannot be redirected by stale foreign-realm peers',()=>{
 const result=teamRealmRendezvous({farmers:['My_Priest','My_Ranger1'],
  localName:'My_Priest',localRealm:'USIV',homeRealm:'EUII',
  peers:{My_Ranger1:{running:true,realm:'USIV'}}});
 assert.equal(result.target,'EUII');
 const isolated=teamRealmRendezvous({farmers:['My_Priest'],localName:'My_Priest',
  localRealm:'USIV',homeRealm:''});
 assert.equal(isolated.complete,false);
});

test('live competitor fighting bees at destination is penalizable evidence',()=>{
 const spawn={map:'main',in:'main',target:'bee',x:546,y:1059};
 const observer={map:'main',x:520,y:753};
 const outsider={type:'character',name:'OtherFarmer',map:'main',x:540,y:1050};
 const entities={outsider,friend:{...outsider,name:'My_Ranger2'}};
 const monsters=[{mtype:'bee',target:'OtherFarmer',map:'main',x:560,y:1040}];
 assert.deepEqual(liveSpawnCompetition(spawn,entities,monsters,
  ['My_Ranger1','My_Ranger2'],observer),{players:1,fighters:1,observed:true});
 assert.deepEqual(liveSpawnCompetition(spawn,entities,monsters,
  ['My_Ranger1','My_Ranger2'],{...observer,x:-2000}),
  {players:0,fighters:0,observed:false});
 assert.deepEqual(liveSpawnCompetition(spawn,entities,monsters,
  ['My_Ranger1','My_Ranger2','OtherFarmer'],observer),
  {players:0,fighters:0,observed:true});
});

test('ordinary farming retains location across hunt fallback or turn-in labels',()=>{
 const old={key:'main:bee:14',kind:'hunt',target:'bee',started:1000};
 const candidate={key:'main:bee:15',target:'bee'};
 assert.equal(shouldHoldOrdinaryLocation(old,candidate,'farm',false),true);
 const kept=chooseFarmAreaSwitch({current:old,currentRank:{...old,score:100,
  travelSeconds:0},candidate:{...candidate,score:110,travelSeconds:8},
  now:90000,holdMs:60000,improvement:.2});
 assert.equal(kept.choice.key,old.key);
 assert.equal(shouldHoldOrdinaryLocation(old,{...candidate,target:'crab'},'farm'),false);
 assert.equal(shouldHoldOrdinaryLocation(old,candidate,'farm',true),true);
});

test('active monsterhunt journey is bounded by observable progress',()=>{
 const visit={phase:'travel'};
 const c={map:'main',x:-48,y:15};
 assert.equal(questTravelStalled(visit,c,{now:1000}),false);
 assert.equal(questTravelStalled(visit,c,{now:44999}),false);
 assert.equal(questTravelStalled(visit,c,{now:46001}),true);
 visit.progress={map:'main',x:-48,y:15,at:1000};
 assert.equal(questTravelStalled(visit,{...c,x:15},{now:46001}),false,
  'actual movement resets the deadline');
 assert.equal(questTravelStalled(visit,{...c,x:15},{now:100001,smart:true}),false);
 assert.equal(questTravelStalled(visit,{...c,x:15},{now:136002,smart:true}),true);
 assert.equal(questTravelStalled(visit,{...c,x:15},{now:200001,town:true}),false,
  'active Town channel must not be interrupted');
 assert.equal(questTravelStalled({phase:'observing'},c,{now:999999}),false,
  'server-authoritative quest confirmation is a separate phase');
});

test('briefly missing Ranger heartbeat does not eject existing healthy Farmer',()=>{
 const options={selected:true,lastSeen:100000,now:119999,realm:'EUII'};
 assert.equal(selectedFarmerAvailable(null,options),true);
 assert.equal(selectedFarmerAvailable(null,{...options,now:120001}),false);
 assert.equal(selectedFarmerAvailable(null,{...options,selected:false}),false);
 assert.equal(selectedFarmerAvailable({running:true,realm:'EUII'},options),true);
 for(const peer of [{running:false,realm:'EUII'},
  {running:true,realm:'USIV'}]){
  assert.equal(selectedFarmerAvailable(peer,options),false);
 }
 assert.equal(selectedFarmerAvailable({running:true,realm:'EUII',inventoryBlocked:true},options),true,
  'an inventory value lock must not eject a still-alive combat teammate');
 assert.equal(selectedFarmerAvailable({running:true,realm:'EUII',rip:true},options),true,
  'a recently observed selected Farmer stays rostered during ordinary respawn');
 assert.equal(selectedFarmerAvailable({running:true,realm:'EUII',rip:true},
  {...options,now:145001}),false,'respawn grace must expire');
});

test('diagnostic helpers never authorize new attack, server or value actions',()=>{
 const choice=liveSpawnCompetition({map:'main',target:'bee',x:0,y:0},{},[],[],
  {map:'main',x:0,y:0});
 for(const key of ['attack','change_server','send_gold','trade_buy','approve']){
  assert.equal(Object.hasOwn(choice,key),false);
 }
});

test('cross-realm Priest cannot be admitted as a live EU2 farm teammate',()=>{
 assert.equal(foreignRunningFarmer({name:'My_Priest',running:true,
  realm:'USIV'},'EUII'),true);
 assert.equal(foreignRunningFarmer({name:'My_Ranger2',running:true,
  realm:'EUII'},'EUII'),false);
 assert.equal(foreignRunningFarmer(null,'EUII'),false,
  'unknown peer is not an affirmative cross-realm claim');
});

test('healthy observed Bee farm stays put rather than travel to unknown Bee site',()=>{
 const current={key:'main:bee:14',kind:'farm',target:'bee',started:0};
 const old={...current,score:100,travelSeconds:0,
  evidenceSeconds:110,pressureRatio:.1};
 const next={key:'main:bee:15',target:'bee',score:900,travelSeconds:5,
  evidenceSeconds:0,occupancyObserved:false};
 const keep=chooseFarmAreaSwitch({current,currentRank:old,candidate:next,
  now:90000,holdMs:60000});
 assert.equal(keep.reason,'current-healthy-destination-unverified');
 assert.equal(keep.choice.key,current.key);
 const explored=chooseFarmAreaSwitch({current,currentRank:
   {...old,pressureRatio:.9},candidate:next,now:90000,holdMs:60000});
 assert.equal(explored.choice.key,next.key,
  'a documented starved farm remains free to explore');
});
