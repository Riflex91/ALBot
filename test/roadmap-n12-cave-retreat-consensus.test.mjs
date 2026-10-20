import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveTeamCoordination} from '../src/world/cave-team-coordination.mjs';
import {createCaveCriticalResponse} from '../src/world/cave-critical-response.mjs';
import {caveRetreatLocalProof,createCaveRetreatConsensus}
 from '../src/world/cave-retreat-consensus.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {createCaveRetreatPreparation,caveRetreatPreparationPreflight}
 from '../src/world/cave-retreat-preparation.mjs';
import {createCaveRetreatWatchdog,caveRetreatArrivalEvidence}
 from '../src/world/cave-retreat-watchdog.mjs';

const when=1770000000000,run='a'.repeat(24),map=`zone_${run}_1`;
function fixture(){
 const names=['R1','R2','P'],events=[],calls=[],votes={},prepared={},aborts={} ,
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
    ...members[other],retreatVote:votes[other]??null,
    retreatPrepare:prepared[other]??null,
    retreatAbort:aborts[other]??null}},
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
  bot.caveRetreatPrepare=createCaveRetreatPreparation(bot,{now:()=>state.now});
  bot.caveRetreatWatchdog=createCaveRetreatWatchdog(bot,{now:()=>state.now});
  bots[name]=bot;
 }
 function publish(){
  for(const name of names)votes[name]=bots[name].caveRetreat.heartbeat();
  return votes;
 }
 function publishPrepared(){
  for(const name of names)votes[name]=bots[name].caveRetreat.heartbeat();
  for(const name of names)
   prepared[name]=bots[name].caveRetreatPrepare.heartbeat();
  return prepared;
 }
 function arm(){
  publish();publishPrepared();
  for(const name of names)aborts[name]=bots[name].caveRetreatWatchdog.heartbeat();
 }
 return {bots,members,names,monsters,state,calls,events,votes,
  prepared,aborts,publish,publishPrepared,arm};
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

test('N12 independent second-round retreat receipts establish preparation, never native movement',()=>{
 const f=fixture();
 f.publish();
 for(const name of f.names)
  assert.equal(f.bots[name].caveRetreatPrepare.status().ready,false);
 f.publishPrepared();
 for(const name of f.names){
  const st=f.bots[name].caveRetreatPrepare.status();
  assert.equal(st.ready,true,st.reason);
  assert.equal(st.prepared,true);
  assert.equal(st.phase,'prepared');
  assert.deepEqual(st.participants,['P','R1','R2']);
  assert.equal(st.executable,false);
  assert.equal(st.canMove,false);
  assert.equal(st.canAttack,false);
  assert.equal(st.canPull,false);
  assert.equal(f.prepared[name].proof,f.votes[name].key);
  assert.equal(f.prepared[name].voteAt,f.votes[name].at);
 }
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 second-round status is read-only and never creates an extra native path check',()=>{
 const f=fixture();
 f.publish();f.publishPrepared();
 const count=f.calls.length;
 for(const name of f.names){
  const bot=f.bots[name];
  for(let i=0;i<4;i++){
   assert.equal(bot.caveRetreatPrepare.status().prepared,true);
   assert.equal(caveRetreatPreparationPreflight(bot,{now:when}).ready,true);
  }
 }
 assert.equal(f.calls.length,count);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 partial or missing second-round quorum never stages a Cave move',()=>{
 const f=fixture();f.publish();
 const a=f.bots.R1.caveRetreatPrepare.heartbeat();
 f.prepared.R1=a;
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,false);
 f.prepared.R2=f.bots.R2.caveRetreatPrepare.heartbeat();
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,false);
 f.prepared.P=f.bots.P.caveRetreatPrepare.heartbeat();
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,true);
 delete f.prepared.R2;
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,false);
 assert.equal(f.bots.R1.caveRetreatPrepare.status().missing,'R2');
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 second-round peer tampering, stale messages and contradictory first votes are rejected',()=>{
 const edits=[
  f=>{f.prepared.R2.actor='P'},
  f=>{f.prepared.R2.proof='forged'},
  f=>{f.prepared.R2.threat='different'},
  f=>{f.prepared.R2.dir=3},
  f=>{f.prepared.R2.run='b'.repeat(24)},
  f=>{f.prepared.R2.floor=2},
  f=>{f.prepared.R2.map='main'},
  f=>{f.prepared.R2.toX+=4},
  f=>{f.prepared.R2.x+=3},
  f=>{f.prepared.R2.voteAt=when-1},
  f=>{f.prepared.R2.at=when-2600},
  f=>{f.prepared.R2.at=when+2},
  f=>{f.prepared.R2.v=2},
  f=>{f.votes.R2.key='different'},
  f=>{f.votes.R2.toY+=3},
  f=>{f.members.R2.x+=3},
  f=>{f.members.R2.received=when-3200},
  f=>{f.members.R2.realm='USII'}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.publish();f.publishPrepared();
  edits[i](f);
  const st=f.bots.R1.caveRetreatPrepare.status();
  assert.equal(st.ready,false,'case '+i+' '+st.reason);
  assert.equal(st.canMove,false);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 first vote must also bind the official attacker damage definition',()=>{
 for(const edit of [
  f=>{f.bots.R1.p.G.monsters.shade.attack=9},
  f=>{f.bots.R1.p.G.monsters.shade.frequency=2},
  f=>{f.bots.R1.p.G.monsters.shade.attack=Infinity}
 ]){
  const f=fixture();f.publish();edit(f);
  assert.equal(f.bots.R1.caveRetreat.status().ready,false);
  assert.equal(f.bots.R1.caveRetreatPrepare.heartbeat(),null);
  assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,false);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 health, threat geometry and original team drift invalidate all preparation',()=>{
 const edits=[
  f=>{f.members.R1.hp--},
  f=>{f.members.P.x+=5},
  f=>{f.monsters[0].hp--},
  f=>{f.monsters[1].target='P';f.members.R2.threats=0;f.members.P.threats=1},
  f=>{f.state.monsters.push({id:'neutral',type:'monster',
   mtype:'shade',map,in:map,x:70,y:0,hp:90,target:null})},
  f=>{f.state.paused=true},
  f=>{f.state.now=when+2600},
  f=>{f.bots.R1.journal={kind:'gold'}},
  f=>{f.bots.R1.movement.order={owner:'cave',mode:'move'}},
  f=>{f.bots.R1.lifecycleChanging=true}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.publish();f.publishPrepared();edits[i](f);
  const st=f.bots.R1.caveRetreatPrepare.status();
  assert.equal(st.ready,false,'case '+i+' '+st.reason);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 a pending native Priest heal blocks movement preparation but not the heal itself',()=>{
 const f=fixture();f.publish();f.publishPrepared();
 const priest=f.bots.P;
 priest.exec={pending:new Map([['cave.priest.heal',{}]])};
 assert.equal(priest.caveRetreatPrepare.status().ready,false);
 assert.equal(priest.caveRetreatPrepare.heartbeat(),null);
 assert.equal(priest.caveRetreatPrepare.status().canMove,false);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 a native geometry refusal invalidates the second-round local receipt',()=>{
 const f=fixture();f.publish();f.publishPrepared();
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,true);
 f.state.clear=false;
 assert.equal(f.bots.R1.caveRetreat.heartbeat(),null);
 assert.equal(f.bots.R1.caveRetreatPrepare.heartbeat(),null);
 assert.equal(f.bots.R1.caveRetreatPrepare.status().ready,false);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 fitting a large heartbeat retains both compact safety receipts',()=>{
 const f=fixture();f.publish();f.publishPrepared();
 const vote=f.votes.R1,prep=f.prepared.R1;
 const packed=fitHeartbeat({items:[],materials:[],name:'R1',
  map,realm:'EUI',retreatVote:vote,retreatPrepare:prep,
  advice:'z'.repeat(4000),performance:{large:'y'.repeat(3000)}},1500);
 assert.ok(packed);
 assert.deepEqual(packed.retreatVote,vote);
 assert.deepEqual(packed.retreatPrepare,prep);
 assert.equal(packed.advice,undefined);
 assert.ok(JSON.stringify(packed).length<=1500);
});

test('N12 read-only Cave watchdog only arms after unanimous two-round preparation',()=>{
 const f=fixture(),first=f.bots.R1.caveRetreatWatchdog.status();
 assert.equal(first.ready,false);
 assert.equal(first.canMove,false);
 assert.equal(f.bots.R1.caveRetreatWatchdog.heartbeat(),null);
 f.arm();
 for(const name of f.names){
  const st=f.bots[name].caveRetreatWatchdog.status();
  assert.equal(st.ready,true,st.reason);
  assert.equal(st.phase,'staged');
  assert.equal(st.executable,false);
  assert.equal(st.canMove,false);
  assert.equal(st.canAttack,false);
  assert.deepEqual(st.participants,['P','R1','R2']);
 }
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 a changed Cave encounter latches an abort with original proof identity',()=>{
 const f=fixture();f.arm();
 const expected=f.bots.R1.caveRetreatPrepare.status().proofKey;
 f.monsters[0].hp--;
 assert.equal(f.bots.R1.caveRetreatWatchdog.status().ready,false);
 f.aborts.R1=f.bots.R1.caveRetreatWatchdog.heartbeat();
 assert.equal(f.aborts.R1.v,1);
 assert.equal(f.aborts.R1.proof,expected);
 assert.equal(f.aborts.R1.reason,'unanimous-preparation-no-longer-valid');
 assert.equal(f.bots.R1.caveRetreatWatchdog.status().phase,'aborted');
 assert.equal(f.bots.R1.caveRetreatWatchdog.status().canMove,false);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 one verified peer abort stops all remaining staged participants',()=>{
 const f=fixture();f.arm();
 f.aborts.R2={v:1,actor:'R2',run,floor:1,
  proof:f.bots.R1.caveRetreatPrepare.status().proofKey,
  at:when,reason:'native-route-lost'};
 assert.equal(f.bots.R1.caveRetreatWatchdog.status().reason,
  'peer-aborted-retreat');
 f.aborts.R1=f.bots.R1.caveRetreatWatchdog.heartbeat();
 assert.equal(f.aborts.R1.reason,'peer-aborted-retreat');
 assert.equal(f.bots.P.caveRetreatWatchdog.status().reason,
  'peer-aborted-retreat');
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 attacker, peer and movement drift rejects the staged Cave checkpoint',()=>{
 const edits=[
  f=>{f.members.P.hp--},
  f=>{f.members.R1.x+=5},
  f=>{f.monsters[1].x-=5},
  f=>{f.state.monsters.push({id:'c',type:'monster',
   mtype:'shade',map,in:map,x:20,y:0,hp:80,dead:false,target:null})},
  f=>{f.state.now=when+2600},
  f=>{f.bots.R1.journal={kind:'gold'}},
  f=>{f.bots.R1.movement.order={owner:'farm',mode:'smart_move'}},
  f=>{f.members.R2.received=when-3200},
  f=>{f.state.paused=true},
  f=>{f.members.P.moving=true}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.arm();edits[i](f);
  const r=f.bots.R1.caveRetreatWatchdog.status();
  assert.equal(r.ready,false,'case '+i+': '+r.reason);
  assert.equal(r.canMove,false);
  assert.equal(f.bots.R1.caveRetreatWatchdog.heartbeat()?.v,1);
  assert.deepEqual(movementCalls(f),[]);
 }
});

test('N12 read-only watchdog status never issues native checks after arm',()=>{
 const f=fixture();f.arm();
 const n=f.calls.length;
 for(let i=0;i<5;i++){
  const status=f.bots.R1.caveRetreatWatchdog.status();
  assert.equal(status.ready,true);
 }
 assert.equal(f.calls.length,n,'status is pure and cannot issue can_move_to');
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 arrival proof requires three independent dispatch receipts and bounded native endpoints',()=>{
 const f=fixture();f.arm();
 const proof=f.bots.R1.caveRetreatPrepare.status().proofKey;
 const waypoints=f.names.map(name=>({name,...f.votes[name]}));
 const observations=waypoints.map(w=>({
  name:w.name,run,floor:1,map,in:map,
  running:true,rip:false,hp:55,received:when+100,
  x:w.toX,y:w.toY,
  retreatDispatch:{v:1,owner:'cave-retreat',proof,
   run,floor:1,map,at:when+30,
   x:w.x,y:w.y,toX:w.toX,toY:w.toY}
 }));
 const args={proof,run,floor:1,map,participants:f.names,
  waypoints,observations,now:when+100,startedAt:when};
 const arrival=caveRetreatArrivalEvidence(args);
 assert.equal(arrival.ready,true,arrival.reason);
 assert.equal(arrival.phase,'arrived');
 assert.equal(arrival.complete,true);
 assert.deepEqual(arrival.arrived,['P','R1','R2']);
 assert.equal(arrival.canMove,false);
 assert.equal(arrival.executable,false);
 observations[0].x=waypoints[0].x;
 const pending=caveRetreatArrivalEvidence(args);
 assert.equal(pending.ready,true,pending.reason);
 assert.equal(pending.complete,false);
 assert.equal(pending.phase,'observing');
 assert.deepEqual(pending.waiting,['R1']);
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 arrival evidence denies any forged, missing or cross-floor native receipt',()=>{
 const f=fixture();f.arm();
 const proof=f.bots.R1.caveRetreatPrepare.status().proofKey;
 const waypoints=f.names.map(name=>({name,...f.votes[name]}));
 const source=waypoints.map(w=>({
  name:w.name,run,floor:1,map,in:map,
  running:true,hp:100,received:when+100,
  x:w.toX,y:w.toY,
  retreatDispatch:{v:1,owner:'cave-retreat',proof,
   run,floor:1,map,at:when+30,
   x:w.x,y:w.y,toX:w.toX,toY:w.toY}
 }));
 const edits=[
  xs=>{xs[1].retreatDispatch=null},
  xs=>{xs[1].retreatDispatch.owner='farm'},
  xs=>{xs[1].retreatDispatch.proof='forged'},
  xs=>{xs[1].retreatDispatch.map='main'},
  xs=>{xs[1].retreatDispatch.toX+=3},
  xs=>{xs[1].retreatDispatch.at=when-1},
  xs=>{xs[1].x+=35},
  xs=>{xs[1].map='main'},
  xs=>{xs[1].floor=2},
  xs=>{xs[1].received=when-3001},
  xs=>{xs[1].hp=0},
  xs=>{xs[1].name=xs[0].name}
 ];
 for(let i=0;i<edits.length;i++){
  const observations=structuredClone(source);edits[i](observations);
  const report=caveRetreatArrivalEvidence({
   proof,run,floor:1,map,participants:f.names,
   waypoints,observations,now:when+100,startedAt:when});
  assert.equal(report.complete,false,'variant '+i+' '+report.reason);
  assert.equal(report.ready,false);
  assert.equal(report.canMove,false);
 }
 assert.deepEqual(movementCalls(f),[]);
});

test('N12 arrival deadline, stale heartbeat and wrong original roster fail closed',()=>{
 const f=fixture();f.arm();
 const proof=f.bots.R1.caveRetreatPrepare.status().proofKey;
 const waypoints=f.names.map(name=>({name,...f.votes[name]}));
 const source=waypoints.map(w=>({
  name:w.name,run,floor:1,map,in:map,
  hp:100,running:true,received:when+6100,
  x:w.toX,y:w.toY,
  retreatDispatch:{v:1,owner:'cave-retreat',proof,run,
   floor:1,map,at:when+20,x:w.x,y:w.y,toX:w.toX,toY:w.toY}
 }));
 const args={proof,run,floor:1,map,participants:f.names,
  waypoints,observations:source,now:when+6100,startedAt:when};
 assert.equal(caveRetreatArrivalEvidence(args).ready,false);
 assert.equal(caveRetreatArrivalEvidence({...args,
  now:when+100,observations:source.slice(0,2)}).ready,false);
 assert.equal(caveRetreatArrivalEvidence({...args,
  now:when+100,participants:['R1','R1','P']}).ready,false);
 assert.equal(caveRetreatArrivalEvidence({...args,
  now:when+100,startedAt:null}).ready,false);
});

test('N12 a bounded heartbeat preserves the peer safety abort over optional diagnostics',()=>{
 const f=fixture();f.arm();
 f.monsters[0].hp--;
 const abort=f.bots.R1.caveRetreatWatchdog.heartbeat();
 const packet=fitHeartbeat({items:[],materials:[],name:'R1',
  map,realm:'EUI',retreatAbort:abort,retreatPrepare:null,
  advice:'x'.repeat(2400),performance:{blob:'y'.repeat(3200)}},1000);
 assert.ok(packet);
 assert.deepEqual(packet.retreatAbort,abort);
 assert.equal(packet.advice,undefined);
 assert.ok(JSON.stringify(packet).length<=1000);
 assert.deepEqual(movementCalls(f),[]);
});
