import test from 'node:test';
import assert from 'node:assert/strict';
import {squadCombatEngaged,assessLiveSquadMarch,stalledSquadRoutePeer,
 shouldHoldOrdinaryLocation,chooseCommittedFarmArea}
 from '../src/world/team-plan.mjs';
import {sharedFarmMarchDestination} from '../src/combat/farmer.mjs';
import {squadReadyForQuestVisit} from '../src/world/strategy.mjs';

const now=60000,realm='EUII';
const plan={id:'plan:20',key:'halloween:osnake:1',target:'osnake',
 kind:'farm',map:'halloween',in:'halloween',x:8,y:630,
 realm,started:1000,arrivedAt:null};
const leader={name:'My_Ranger1',map:'main',in:'main',x:10,y:10,
 hp:4000,max_hp:4000,realm,running:true,rip:false,received:now-300};
const peer={name:'My_Priest',map:'main',in:'main',x:50,y:20,
 hp:3000,max_hp:3000,realm,running:true,rip:false,received:now-300,
 march:{plan:plan.id,realm,moving:true},threats:0,questVisit:false};

test('a fighting or visiting squad mate prevents leader running away on an ostensibly valid route',()=>{
 assert.equal(assessLiveSquadMarch(leader,[peer],{realm,plan,now}).ready,true);
 assert.deepEqual(
  (({reason,peer})=>({reason,peer}))(assessLiveSquadMarch(leader,[{...peer,threats:1,travelBlock:{plan:plan.id,at:now}}],{realm,plan,now})),
  {reason:'teammate-transit-blocked',peer:'My_Priest'});
 assert.equal(assessLiveSquadMarch(leader,[{...peer,questVisit:true}],{realm,plan,now}).reason,
  'teammate-on-quest-visit');
 assert.equal(squadCombatEngaged([{id:1,hp:50,target:'My_Priest'}],
  ['My_Ranger1','My_Priest']),true);
 assert.equal(squadCombatEngaged([],['My_Ranger1','My_Priest'],
  [{...peer,threats:1}]),true);
 assert.equal(squadCombatEngaged([{hp:30,target:'Other'}],
  ['My_Ranger1','My_Priest'],[peer]),false);
});

test('queued smart_move is not proof of real progress after 30 seconds of standing still',()=>{
 const positions=new Map(),peers=[peer];
 assert.equal(stalledSquadRoutePeer(peers,plan,positions,now),null);
 assert.equal(stalledSquadRoutePeer(peers,plan,positions,now+29999),null);
 assert.equal(stalledSquadRoutePeer(peers,plan,positions,now+30000),'My_Priest');
 assert.equal(stalledSquadRoutePeer([{...peer,x:75}],plan,positions,now+30001),null);
 assert.equal(stalledSquadRoutePeer([{...peer,x:75}],plan,positions,now+60002),'My_Priest');
 assert.equal(stalledSquadRoutePeer([{...peer,threats:1}],plan,positions,now+60003),null,
  'live combat must not be diagnosed as navigation failure');
 assert.equal(stalledSquadRoutePeer([{...peer, map:'halloween',in:'halloween',x:9,y:630}],
  plan,positions,now+60004),null);
});

test('leader quest trip takes precedence over the old shared spawn endpoint',()=>{
 assert.equal(sharedFarmMarchDestination(leader,{...peer,questVisit:true,
  farmPlan:plan},realm),null);
 assert.equal(sharedFarmMarchDestination(leader,{...peer,squadQuestVisit:true,
  farmPlan:plan},realm),null,
  'escort to Daisy must preempt the stale shared farm route');
 assert.ok(sharedFarmMarchDestination(leader,{...peer,questVisit:false,
  farmPlan:plan},realm));
});

test('hunter can visit Daisy while ordinary farm route is active only with healthy assembled allies',()=>{
 const ranger={...leader,received:now};
 const priest={...peer,map:'main',in:'main',x:110,y:5};
 const roster=[ranger.name,priest.name];
 const lookup=name=>name===priest.name?priest:null;
 assert.equal(squadReadyForQuestVisit(ranger,roster,lookup,{realm}),true);
 assert.equal(squadReadyForQuestVisit(ranger,roster,
  name=>({...priest,x:500}),{realm}),false);
 assert.equal(squadReadyForQuestVisit(ranger,roster,
  name=>({...priest,threats:1}),{realm}),false);
 assert.equal(squadReadyForQuestVisit(ranger,roster,
  name=>({...priest,map:'halloween',in:'halloween'}),{realm}),false);
 assert.equal(squadReadyForQuestVisit(ranger,roster,
  name=>({...priest,hp:500}),{realm}),false);
});

test('ordinary farm and verified achievement objectives obey the same travel hold',()=>{
 assert.equal(shouldHoldOrdinaryLocation(plan,{...plan,target:'bee'},'farm'),true);
 assert.equal(shouldHoldOrdinaryLocation(plan,{...plan,target:'bee'},'achievement'),true);
 assert.equal(shouldHoldOrdinaryLocation(plan,{...plan,target:'bee'},'hunt'),false);
 const currentRank={...plan,score:450,travelSeconds:50};
 const candidate={...plan,key:'main:bee:1',target:'bee',score:1000,travelSeconds:15};
 const result=chooseCommittedFarmArea({
  current:plan,currentRank,candidate,character:{map:'main',in:'main',x:30,y:20},
  now:1000000,holdMs:300000,improvement:.45});
 assert.equal(result.choice.key,plan.key,'commitment remains active during the actual cross-map trip');
});
