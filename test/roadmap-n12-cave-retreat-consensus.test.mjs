import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveTeamCoordination} from '../src/world/cave-team-coordination.mjs';
import {createCaveCriticalResponse} from '../src/world/cave-critical-response.mjs';
import {caveRetreatLocalProof,createCaveRetreatConsensus}
 from '../src/world/cave-retreat-consensus.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

const when=1770000000000,run='a'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const names=['R1','R2','P'],events=[],calls=[],votes={},
 state={now:when,clear:true,monsters:[],paused:false};
 const members={
  R1:{name:'R1',ctype:'ranger',class:'ranger',map,in:map,cave:{run},
   x:0,y:0,hp:60,max_hp:100,rip:false,threats:1,targets:1,
   running:true,realm:'EUI',received:when},
  R2:{name:'R2',ctype:'ranger',class:'ranger',map,in:map,cave:{run},
   x:20,y:0,hp:100,max_hp:100,rip:false,threats:1,targets:1,
   running:true,realm:'EUI',received:when},
  P:{name:'P',ctype:'priest',class:'priest',map,in:map,cave:{run},
   x:10,y:10,hp:100,max_hp:100,rip:false,threats:0,targets:0,
   running:true,realm:'EUI',received:when}
 };
 const monsters=[
  {id:'a',type:'monster',mtype:'shade',map,in:map,
   x:-100,y:0,hp:100,dead:false,target:'R1'},
  {id:'b',type:'monster',mtype:'shade',map,in:map,
   x:-120,y:10,hp:100,dead:false,target:'R2'}
 ];
 state.monsters=monsters;
 const bots={};
 for(const name of names){
  const c=members[name],p={
   c,G:{monsters:{shade:{attack:8,frequency:1}}},
   realm:()=> 'EUI',has:n=>n==='can_move_to',
   call:(action,...args)=>{
    calls.push([name,action,...args]);
    if(action==='can_move_to')return state.clear;
    throw Error('Forbidden Cave action: '+action);
   }
  };
  const bot={
   p,me:{name,role:'farmer'},running:true,farmers:names.slice(),
   cfg:{party:{enabled:true,waitForTeam:true,healing:true}},
   journal:null,inventoryBlocked:false,
   bank:{pending:false},logistics:{reserved:false,handoffActive:false},
   gold:{reserved:false},
   movement:{order:null,nativeBusy:()=>false},
   transport:{fresh:other=>other===name?null:{
    ...members[other],retreatVote:votes[other]??null}},
   entity:other=>members[other]?{
    ...members[other],visible:true,type:'character'}:null,
   monsters:()=>state.monsters,
   cave:{status:()=>({realm:'EUI',live:{
    run,floor:1,map,serverTime:when,paused:state.paused,
    roster:names.map(n=>({name:n,left:false,disconnected:false}))
   }})},
   caveLifecycle:{status:()=>({state:'live-observed',
    journal:{phase:'observed-run',name,realm:'EUI',
     observed:{run,floor:1,map,at:when}}})},
   event:(...row)=>events.push(row)
  };
  bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.now});
  bot.caveCriticalResponse=createCaveCriticalResponse(bot,{
   now:()=>state.now});
  bot.caveRetreat=createCaveRetreatConsensus(bot,{now:()=>state.now});
  bots[name]=bot;
 }
 function publish(){
  for(const name of names)votes[name]=bots[name].caveRetreat.heartbeat();
  return votes;
 }
 return {bots,members,names,monsters,state,calls,events,votes,publish};
}
const movementCalls=f=>f.calls.filter(([,kind])=>
 kind==='move'||kind==='smart_move'||kind==='town'||
 kind==='attack'||kind==='heal'||kind==='use_skill');

test('N12 all three independently attest the SAME away vector and native clearance',()=>{
 const f=fixture();
 for(const name of f.names){
  assert.equal(f.bots[name].caveCriticalResponse.status().critical,true);
  const plan=caveRetreatLocalProof(f.bots[name],{now:when});
  assert.equal(plan.direction,0);
  assert.equal(plan.ready,false,'local geometry not yet attested');
  assert.equal(plan.self.toX,plan.self.x+24);
  assert.equal(plan.self.toY,plan.self.y);
  assert.equal(plan.plans.length,3);
  assert.equal(f.bots[name].caveRetreat.status().consensus,false);
 }
 assert.equal(f.calls.length,0,'read-only status never calls host');
 f.publish();
 assert.equal(f.calls.length,3,'one native can_move_to per own Cave client');
 for(const name of f.names){
  const result=f.bots[name].caveRetreat.status();
  assert.equal(result.ready,true,result.reason);
  assert.equal(result.consensus,true,result.reason);
  assert.equal(result.votes,3);
  assert.equal(result.canMove,false,'unanimous vote is NOT movement authority');
  assert.equal(result.canAttack,false);
  assert.equal(result.canPull,false);
  assert.deepEqual(result.participants,['P','R1','R2']);
 }
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 one missing peer vote denies every claimant without issuing a move',()=>{
 const f=fixture();
 f.publish();
 delete f.votes.R2;
 assert.equal(f.bots.R1.caveRetreat.status().consensus,false);
 assert.equal(f.bots.P.caveRetreat.status().consensus,false);
 assert.equal(f.bots.R1.caveRetreat.status().missing,'R2');
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 remote attestations need identical run, floor, enemy and direction',()=>{
 const changes=[
  v=>{v.run='b'.repeat(24)},
  v=>{v.floor=2},
  v=>{v.map='main'},
  v=>{v.dir=1},
  v=>{v.threat='other-target'},
  v=>{v.toX+=5},
  v=>{v.x+=5},
  v=>{v.at=when-3000},
  v=>{v.at=when+5},
  v=>{v.v=2}
 ];
 for(let i=0;i<changes.length;i++){
  const f=fixture();f.publish();
  changes[i](f.votes.R2);
  const status=f.bots.P.caveRetreat.status();
  assert.equal(status.ready,false,'case '+i);
  assert.equal(status.canMove,false);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 local position, health and enemy changes invalidate an old unanimous vote',()=>{
 const changes=[
  f=>{f.members.R1.x+=4},
  f=>{f.members.R1.hp--},
  f=>{f.monsters[0].x-=2},
  f=>{f.monsters[1].hp--},
  f=>{f.monsters[0].target='P';f.members.R1.threats=0;
   f.members.P.threats=1},
  f=>{f.state.now=when+2501},
  f=>{f.state.paused=true},
  f=>{f.members.R2.rip=true},
  f=>{f.bots.R1.journal={kind:'bank'}},
  f=>{f.bots.R1.movement.order={owner:'cave',mode:'move'}}
 ];
 for(let i=0;i<changes.length;i++){
  const f=fixture();f.publish();changes[i](f);
  const result=f.bots.R1.caveRetreat.status();
  assert.equal(result.ready,false,'local drift '+i);
  assert.equal(result.canMove,false);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 native geometry failure denies the affected local route attestation',()=>{
 const f=fixture();f.state.clear=false;
 for(const name of f.names)
  assert.equal(f.bots[name].caveRetreat.heartbeat(),null);
 assert.equal(f.bots.R1.caveRetreat.status().consensus,false);
 assert.equal(f.calls.filter(([,name])=>name==='can_move_to').length,3);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 additional neutral Cave monster and split-threat geometries fail closed',()=>{
 const f=fixture();f.state.monsters.push({
  id:'neutral',type:'monster',mtype:'shade',map,in:map,
  x:70,y:40,hp:100,dead:false,target:null
 });
 for(const name of f.names){
  assert.equal(f.bots[name].caveRetreat.heartbeat(),null);
  assert.equal(f.bots[name].caveRetreat.status().consensus,false);
 }
 const g=fixture();
 g.monsters[0].x=-100;g.monsters[1].x=100;
 for(const name of g.names){
  assert.equal(g.bots[name].caveRetreat.heartbeat(),null);
  assert.equal(g.bots[name].caveRetreat.status().consensus,false);
 }
 assert.deepEqual(movementCalls(f),[]);
 assert.deepEqual(movementCalls(g),[]);
});

test('N12 damaged, stale or mismatched original-trio evidence rejects the vote',()=>{
 const changes=[
  f=>{f.members.R1.hp=30},
  f=>{f.members.R2.received=when-3200},
  f=>{f.members.P.realm='USII'},
  f=>{f.members.R2.map='main'},
  f=>{f.bots.R1.farmers=['R1','P']},
  f=>{f.bots.R1.caveLifecycle.status=()=>({state:'unknown'})},
  f=>{f.bots.R1.cave.status=()=>({realm:'EUI',live:null})},
  f=>{f.bots.R1.cfg.party.enabled=false},
  f=>{f.bots.R1.lifecycleChanging=true},
  f=>{f.state.monsters=null},
  f=>{f.state.now=when+3200},
  f=>{f.monsters[1].id='a'},
  f=>{f.monsters[1].type='character'}
 ];
 for(let i=0;i<changes.length;i++){
  const f=fixture();changes[i](f);
  const vote=f.bots.R1.caveRetreat.heartbeat();
  assert.equal(vote,null,'case '+i);
  assert.equal(f.bots.R1.caveRetreat.status().consensus,false);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 healthy or single-aggro Cave cannot issue emergency retreat votes',()=>{
 for(const change of [
  f=>{f.members.R1.hp=100},
  f=>{f.state.monsters=[f.monsters[0]];f.members.R2.threats=0},
  f=>{f.state.monsters=[];f.members.R1.threats=0;f.members.R2.threats=0}
 ]){
  const f=fixture();change(f);
  const vote=f.bots.R1.caveRetreat.heartbeat();
  assert.equal(vote,null);
  assert.equal(f.bots.R1.caveRetreat.status().consensus,false);
 }
});

test('N12 heartbeat size fitting retains the bounded retreat attestation',()=>{
 const f=fixture(),vote=f.bots.R1.caveRetreat.heartbeat();
 const packed=fitHeartbeat({items:[],materials:[],name:'R1',
  map,realm:'EUI',retreatVote:vote,
  advice:'a'.repeat(5000)},950);
 assert.ok(packed);
 assert.deepEqual(packed.retreatVote,vote);
 assert.equal(packed.advice,undefined,'optional advice trimmed first');
 assert.ok(JSON.stringify(packed).length<=950);
});

test('N12 no pending vote is transmitted after local geometry/critical risk expires',()=>{
 const f=fixture();f.publish();
 const b=f.bots.R1;
 assert.equal(b.caveRetreat.status().ready,true);
 f.state.clear=false;
 const freshVote=b.caveRetreat.heartbeat();
 assert.equal(freshVote,null);
 assert.equal(b.caveRetreat.status().ready,false);
 assert.deepEqual(movementCalls(f),[]);
});
