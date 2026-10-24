import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {leaderAssignedFarmTarget,followerCombatRendezvous}
 from '../src/combat/team-readiness.mjs';

// Reproduces the neutral-looking but specifically assigned live bat from
// 2026-10-24: the leader is attacking, while the monster's own target can
// temporarily be null in a follower's local entity snapshot.
const now=Date.now(),plan={
 id:'My_Ranger1:plan:9',target:'bat',realm:'EUII',map:'cave',in:'cave',
 x:1108,y:59,expires:now+20000
},leader={
 name:'My_Ranger1',running:true,rip:false,realm:'EUII',
 received:now,map:'cave',in:'cave',x:1056,y:64,
 target:'2746962',march:{plan:plan.id}
},actor={
 name:'My_Ranger2',map:'cave',in:'cave',x:1074,y:83
},monster={
 id:'2746962',type:'monster',mtype:'bat',hp:9000,
 target:null,map:'cave',in:'cave',x:1090,y:70
};
const team=['My_Ranger1','My_Ranger2','My_Priest'];
const focus=(l=leader,m=monster,p=plan)=>
 leaderAssignedFarmTarget(actor,l,[m],{
  plan:p,realm:'EUII',teamNames:team,maxDistance:280,now
 });

test('follower may identify an exact still-neutral leader focus by live ID and plan',()=>{
 assert.equal(focus()?.id,monster.id);
 assert.equal(focus(leader,{...monster,target:'My_Ranger1'})?.id,monster.id);
 assert.equal(focus(leader,{...monster,target:'ForeignPlayer'}),null);
 assert.equal(focus({...leader,target:'different'}),null);
 assert.equal(focus({...leader,received:now-4100}),null);
 assert.equal(focus(leader,monster,{...plan,expires:now-1}),null);
 assert.equal(focus(leader,monster,{...plan,id:'different-plan'}),null);
 assert.equal(focus(leader,{...monster,in:'private-instance'}),null);
});

test('rendezvous to leader is only for a verified leader fight and is bounded',()=>{
 const far={...actor,x:970,y:83};
 assert.equal(followerCombatRendezvous(far,leader,{followDistance:140}).move,true);
 assert.equal(followerCombatRendezvous(actor,leader,{followDistance:140}).move,false);
 assert.equal(followerCombatRendezvous(far,{...leader,target:null},
  {followDistance:140}).move,false);
 assert.equal(followerCombatRendezvous(far,leader,{
  followDistance:140,hasActiveMovement:true}).move,false);
});

test('overworld farmer prioritizes focus assistance before voluntary spawn pulls',()=>{
 const src=readFileSync(new URL('../src/combat/farmer.mjs',import.meta.url),'utf8');
 const tick=src.slice(src.indexOf('function tick(){'));
 const assist=tick.indexOf('helpEngagedTeamFight(escortLeader))return;');
 const oneShot=tick.indexOf('independentOneShotAoE?.())return;');
 const newPull=tick.indexOf('independentSpawnEngagement())return;');
 assert.ok(assist>=0&&oneShot>assist&&newPull>assist,
  'assist must be evaluated before either fresh neutral pull');
 assert.match(src,/combat\.assistUnavailable/);
 assert.match(src,/leader-target-not-visible/);
 assert.match(src,/native-can-attack-false/);
 assert.match(src,/stillAssigned\(\)/);
});
