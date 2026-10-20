import test from 'node:test';
import assert from 'node:assert/strict';
import {caveTeamCoordination,inCaveInstance,createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const at=1770000000000,run='a'.repeat(24),other='b'.repeat(24);
const map=`zone_${run}_1`;
const char=(name,x,y,ctype='ranger')=>({
 name,map,in:map,cave:{run},x,y,ctype,hp:100,max_hp:100,
 mp:100,max_mp:100,range:140,rip:false
});
const actor=()=>char('P',0,0,'ranger');
const peer=(name,x,y,cls='ranger')=>({
 ...char(name,x,y,cls),class:cls,
 realm:'EUI',received:at,running:true
});
function fixture(overrides={}){
 const character=actor();
 const peers={R:peer('R',70,0),H:peer('H',40,20,'priest')};
 const live={run,serverTime:at,map,floor:1,paused:false,
  roster:['P','R','H'].map(name=>({name,left:false,disconnected:false}))};
 return {cave:{realm:'EUI',live},
  lifecycle:{state:'live-observed',journal:{
   name:'P',realm:'EUI',phase:'observed-run',observed:{run}}},
  name:'P',character,realm:'EUI',
  teamNames:['P','R','H'],peers,monsters:[],now:at,...overrides};
}
test('N12 trio present with fresh instance and Priest is observable, but not combat-authorized',()=>{
 const r=caveTeamCoordination(fixture());
 assert.equal(r.ready,true);
 assert.equal(r.reason,'assembled-no-engaged-threat');
 assert.equal(r.priest,'H');
 assert.equal(r.run,run);
 assert.equal(r.focus,null);
 assert.equal(r.executable,false);
 assert.equal(r.canPull,false);
 assert.equal(r.canAttack,false);
 assert.equal(r.canMove,false);
 assert.deepEqual(r.members,['P','R','H']);
});

test('N12 choose a common focus exclusively among actually engaged own Cave threats',()=>{
 const monsters=[
  {id:'neutral',mtype:'moth',target:null,hp:12,map,in:map,x:25,y:25},
  {id:'outsider',mtype:'moth',target:'Z',hp:12,map,in:map,x:25,y:25},
  {id:'far',mtype:'moth',target:'P',hp:12,
   map:`zone_${other}_1`,in:`zone_${other}_1`,x:25,y:25},
  {id:'ranger-aggro',mtype:'moth',target:'R',hp:18,map,in:map,x:30,y:30},
  {id:'priest-aggro',mtype:'moth',target:'H',hp:33,map,in:map,x:30,y:30}
 ];
 const r=caveTeamCoordination(fixture({monsters}));
 assert.equal(r.ready,true);
 assert.deepEqual(r.focus,{id:'priest-aggro',mtype:'moth',
  victim:'H',alreadyEngaged:true});
 assert.equal(r.canAttack,false,'diagnostics never authorize an attack');
 const neutral=caveTeamCoordination(fixture({monsters:monsters.slice(0,3)}));
 assert.equal(neutral.focus,null);
});

test('N12 reject different Cave run, map, floor and realm',()=>{
 const f=fixture();
 const scenarios=[
  {cave:null},
  {cave:{...f.cave,realm:'USII'}},
  {cave:{...f.cave,live:{...f.cave.live,run:other}}},
  {cave:{...f.cave,live:{...f.cave.live,map:'main'}}},
  {character:{...f.character,map:'main',in:'main',cave:{run}}},
  {character:{...f.character,cave:{run:other}}},
  {lifecycle:{state:'exit-outcome-unknown',journal:f.lifecycle.journal}},
  {lifecycle:{state:'live-observed',journal:{...f.lifecycle.journal,
   observed:{run:other}}}}
 ];
 for(const change of scenarios){
  const r=caveTeamCoordination({...f,...change});
  assert.equal(r.ready,false,r.reason);
  assert.equal(r.canPull,false);
 }
});

test('N12 stale server snapshots, stale heartbeats and missing participants deny coordination',()=>{
 const f=fixture();
 const examples=[
  {now:at+3001},
  {now:at-1},
  {peers:{...f.peers,R:{...f.peers.R,received:at-3001}}},
  {peers:{...f.peers,R:{...f.peers.R,received:at+10}}},
  {peers:{...f.peers,R:{...f.peers.R,realm:'USII'}}},
  {peers:{...f.peers,R:{...f.peers.R,running:false}}},
  {peers:{H:f.peers.H}},
  {peers:{...f.peers,H:{...f.peers.H,map:'main'}}},
  {peers:{...f.peers,H:{...f.peers.H,hp:20}}}
 ];
 for(const x of examples)
  assert.equal(caveTeamCoordination({...f,...x}).ready,false,JSON.stringify(x));
});

test('N12 all original trio members must remain connected and intentionally selected',()=>{
 const f=fixture();
 for(const roster of [
  f.cave.live.roster.slice(0,2),
  [...f.cave.live.roster.slice(0,2),{name:'Z',left:false,disconnected:false}],
  f.cave.live.roster.map(m=>m.name==='H'?{...m,disconnected:true}:m),
  f.cave.live.roster.map(m=>m.name==='R'?{...m,left:true}:m)
 ]){
  const r=caveTeamCoordination({...f,cave:{...f.cave,live:{
   ...f.cave.live,roster}}});
  assert.equal(r.ready,false);
  assert.equal(r.reason,'complete-active-trio-required');
 }
 for(const names of [['P','R'],['P','R','Z'],['P','R','R']]){
  assert.equal(caveTeamCoordination({...f,teamNames:names}).reason,
   'configured-team-mismatch');
 }
});

test('N12 separated ranger and out-of-range Priest are fail-closed',()=>{
 const f=fixture();
 const parted=caveTeamCoordination({...f,peers:{
  ...f.peers,R:{...f.peers.R,x:200}}});
 assert.equal(parted.reason,'team-not-assembled');
 const tether=caveTeamCoordination({...f,peers:{
  ...f.peers,H:{...f.peers.H,x:145,y:0},
  R:{...f.peers.R,x:110,y:0}}});
 assert.equal(tether.reason,'priest-out-of-support-range');
 const noPriest=caveTeamCoordination({...f,peers:{
  ...f.peers,H:{...f.peers.H,class:'ranger',ctype:'ranger'}}});
 assert.equal(noPriest.reason,'priest-identity-unconfirmed');
});

test('N12 paused Cave instance never becomes a farm/pull permission',()=>{
 const f=fixture(),live={...f.cave.live,paused:true};
 const r=caveTeamCoordination({...f,cave:{...f.cave,live}});
 assert.equal(r.reason,'instance-paused');
 assert.equal(r.focus,null);
 assert.equal(r.canAttack,false);
});

test('N12 Cave map detection is independent of snapshot visibility',()=>{
 assert.equal(inCaveInstance(actor()),true);
 assert.equal(inCaveInstance({map,cave:null}),true);
 assert.equal(inCaveInstance({map:'main',cave:{run}}),true);
 assert.equal(inCaveInstance({map:'main',cave:null}),false);
 assert.equal(inCaveInstance({map:'zone_fake_1',cave:null}),false);
 assert.equal(inCaveInstance({map:'zone_fake_1',cave:{run:other}}),true);
 assert.equal(inCaveInstance({map:'main',cave:{run:'bogus'}}),false);
});

test('N12 transport and cave team status read only, without any game API action',()=>{
 const f=fixture(),calls=[];
 const bot={p:{c:f.character,realm:()=> 'EUI',
   call:(...args)=>{calls.push(args);throw Error('game action');}},
   me:{name:'P'},farmers:f.teamNames,
   transport:{fresh:name=>f.peers[name]},
   cave:{status:()=>f.cave},
   caveLifecycle:{status:()=>f.lifecycle},
   monsters:()=>[]};
 const status=createCaveTeamCoordination(bot,{now:()=>at}).status();
 assert.equal(status.ready,true);
 assert.deepEqual(calls,[]);
});

test('N12 ordinary farmer tick cannot select farm mobs or navigate inside a Cave instance',()=>{
 const c=actor(),calls=[],orders=[];
 const bot={
  p:{c,realm:()=> 'EUI',G:{},
   call:(name,...args)=>{calls.push([name,...args]);throw Error('no game calls expected');}},
  me:{name:'P',role:'farmer'},exec:{run:()=>{throw Error('no attack');}},
  cfg:{farming:{enabled:true,hpBelow:.3,mpBelow:.3,
   restBelow:.2,resumeAbove:.9,potions:false},
   party:{enabled:true}},session:'session-one',
  logistics:{handoffActive:false},gold:null,journal:null,
  caveTeam:{status:()=>({reason:'team-not-assembled'})},
  movement:{order:{owner:'farm'},stop:()=>{orders.push('stop')},
   go:()=>{throw Error('no movement in Cave');}},
  monsters:()=>[],farmers:['P','R','H'],target:{id:'neutral'},
  strategy:{busy:false},skills:{rotation:()=>{throw Error('no farm skills');}}
 };
 createFarmer(bot).tick();
 assert.equal(bot.target,null);
 assert.equal(bot.reason,'Cave-Gruppe: team-not-assembled');
 assert.deepEqual(orders,['stop']);
 assert.deepEqual(calls,[]);
});
