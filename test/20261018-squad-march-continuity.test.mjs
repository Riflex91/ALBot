import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedMarchStatus,fitHeartbeat,compactFarmPlan} from '../src/party/transport.mjs';
import {assessLiveSquadMarch,sameFarmDestination,activeFarmRouteMatches} from '../src/world/team-plan.mjs';
import {sharedFarmMarchDestination} from '../src/combat/farmer.mjs';

const realm='EUII';
const destination={id:'plan:7',key:'halloween:minimush:1',target:'minimush',
 map:'halloween',in:'halloween',x:8,y:630.5,realm,kind:'farm'};
const leader={name:'My_Ranger1',map:'main',in:'main',x:105,y:-358,
 running:true,realm,rip:false};
const peer=(name,map='main')=>({name,map,in:map,x:150,y:0,
 running:true,realm,rip:false,received:49500,hp:2700,max_hp:3000});

test('compact heartbeat describes the ACTUAL farm/follow destination when full plan is absent',()=>{
 const march=sharedMarchStatus(destination,
  {owner:'follow',dest:{map:'halloween',in:'halloween',x:8,y:630.5}},realm);
 assert.deepEqual(march,{
  plan:'plan:7',realm,map:'halloween',in:'halloween',
  x:8,y:630.5,target:'minimush',moving:true
 });
 const trimmed=fitHeartbeat({name:'My_Priest',items:[],materials:[],march,
  performance:'x'.repeat(2500),stock:'x'.repeat(2500),
  farmPlan:{...destination,bounds:'x'.repeat(2500)}},450);
 assert.deepEqual(trimmed.march,march);
 assert.equal(trimmed.farmPlan,undefined,
  'optional full plan can be dropped without losing the compact route');
});

test('leader transmits compact but fully validatable spawn plan',()=>{
 const full={...destination,definition:'safe-v1',bounds:['halloween',0,0,20,40],
  started:100,expires:60000,objective:null,score:999,
  ranking:'x'.repeat(3000)};
 const plan=compactFarmPlan(full);
 for(const key of ['id','key','target','map','in','x','y','realm',
  'leader','kind','objective','started','expires','definition','bounds']){
  if(key==='leader')continue;
  assert.deepEqual(plan[key],full[key],key);
 }
 assert.equal(plan.score,undefined);
 assert.equal(plan.ranking,undefined);
 assert.ok(JSON.stringify(plan).length<600);
});

test('unrelated chase and cancelled native movement are NOT advertised as shared route',()=>{
 const chasing=sharedMarchStatus(destination,{
  owner:'follow',dest:{map:'main',in:'main',x:105,y:-358}
 },realm);
 assert.equal(chasing.moving,false);
 assert.equal(sharedMarchStatus(destination,null,realm).moving,false);
 assert.equal(sharedMarchStatus(destination,{
  owner:'quest',dest:{map:'halloween',in:'halloween',x:8,y:630.5}
 },realm).moving,false);
 assert.equal(sharedMarchStatus(destination,{
  owner:'follow',dest:{map:'halloween',in:'halloween',x:8,y:630.5}
 },'USIV'),null);
});

test('leader moves through portal with ranger marching and healer already arrived',()=>{
 const healer={...peer('My_Priest','halloween'),x:8,y:630.5,march:null};
 const ranger={...peer('My_Ranger2','mtunnel'),
  march:sharedMarchStatus(destination,{
   owner:'follow',dest:{map:'halloween',in:'halloween',x:8,y:630.5}
  },realm)};
 const status=assessLiveSquadMarch(leader,[healer,ranger],
  {realm,plan:destination,now:50000});
 assert.equal(status.ready,true);
 assert.equal(status.reason,'team-traversing-shared-route');
});

test('leader pauses for REAL separation, danger, stale heartbeat, or cross-realm',()=>{
 const following={...peer('My_Priest','mtunnel'),
  march:sharedMarchStatus(destination,{
   owner:'follow',dest:{map:'halloween',in:'halloween',x:8,y:630.5}
  },realm)};
 const check=x=>assessLiveSquadMarch(leader,[x],{
  realm,plan:destination,now:50000});
 assert.equal(check({...following,march:{...following.march,moving:false}}).reason,
  'teammate-not-on-shared-route');
 assert.equal(check({...following,march:{...following.march,plan:'old:plan'}}).ready,false);
 assert.equal(check({...following,rip:true}).reason,'teammate-unverified');
 assert.equal(check({...following,realm:'USIV'}).reason,'teammate-unverified');
 assert.equal(check({...following,hp:100}).reason,'teammate-needs-heal');
 assert.equal(check({...following,received:45000}).reason,'teammate-unverified');
});

test('Priest follows a compact leader route even without farmPlan',()=>{
 const priest={name:'My_Priest',map:'main',in:'main',x:0,y:0};
 const compact={...leader,march:sharedMarchStatus(destination,{
  owner:'farm',dest:{map:'halloween',in:'halloween',x:8,y:630.5}
 },realm)};
 assert.equal(compact.farmPlan,undefined);
 const route=sharedFarmMarchDestination(priest,compact,realm);
 assert.deepEqual({map:route.map,x:route.x,y:route.y,radius:route.radius,
   target:route.target},
  {map:'halloween',x:8,y:630.5,radius:65,target:'minimush'});
 assert.equal(sharedFarmMarchDestination(priest,{...compact,realm:'USIV'},realm),null);
 assert.equal(sharedFarmMarchDestination(priest,{...compact,march:null},realm),null);
});

test('late full-plan adoption retains an already aligned compact escort route',()=>{
 const aligned={owner:'follow',dest:{map:'halloween',in:'halloween',x:8,y:630.5}};
 assert.equal(activeFarmRouteMatches(aligned,destination),true);
 assert.equal(activeFarmRouteMatches({owner:'farm',dest:aligned.dest},destination),true);
 assert.equal(activeFarmRouteMatches({owner:'quest',dest:aligned.dest},destination),false);
 assert.equal(activeFarmRouteMatches({owner:'follow',dest:{...aligned.dest,x:800}},destination),false);
 assert.equal(activeFarmRouteMatches(null,destination),false);
});

test('same physical spawn does not restart native route on hunt/farm label change',()=>{
 const active={...destination,kind:'hunt',objective:'quest-A'};
 const updated={...destination,id:'plan:8',kind:'farm',objective:null};
 assert.equal(sameFarmDestination(active,updated),true);
 assert.equal(sameFarmDestination(active,{...updated,x:16,y:636}),true);
 assert.equal(sameFarmDestination(active,{...updated,x:400}),false);
 assert.equal(sameFarmDestination(active,{...updated,target:'bee'}),false);
 assert.equal(sameFarmDestination(active,{...updated,map:'main',in:'main'}),false);
});
