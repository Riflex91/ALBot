import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderAssignedFarmTarget} from '../src/combat/team-readiness.mjs';
import {verifiedNativeFarmFocus} from '../src/party/transport.mjs';
import {reachedMovementRadius} from '../src/core/movement.mjs';

const now=Date.now();
const plan={id:'leader:plan:3',target:'bee',realm:'EUII',
 map:'main',in:'main',expires:now+30000};
const me={map:'main',in:'main',x:100,y:100};
const leader={name:'Leader',running:true,rip:false,realm:'EUII',
 received:now,map:'main',in:'main',x:130,y:100,
 target:'bee-7',farmPlan:{...plan}};
const monster={id:'bee-7',mtype:'bee',hp:300,dead:false,
 map:'main',in:'main',x:145,y:100,target:null};
const options={plan,realm:'EUII',teamNames:['Leader','Follower'],now};

test('verified, single leader-assigned neutral target is eligible for coordinated assist',()=>{
 assert.equal(leaderAssignedFarmTarget(me,leader,[monster],options),monster);
 assert.equal(leaderAssignedFarmTarget(me,{...leader,farmPlan:null,
   march:{plan:plan.id}},[monster],options),monster,
   'compact shared march is an acceptable verified plan reference');
 assert.equal(leaderAssignedFarmTarget(me,leader,[{...monster,target:'Leader'}],options)?.id,'bee-7');
});

test('neutral focus fails closed for stale, hostile, remote or different-plan evidence',()=>{
 const variations=[
  {lead:{...leader,target:null}},
  {lead:{...leader,received:now-5000}},
  {lead:{...leader,realm:'USIV'}},
  {lead:{...leader,rip:true}},
  {lead:{...leader,farmPlan:{...plan,id:'other-plan'}}},
  {mob:{...monster,id:'different'}},
  {mob:{...monster,mtype:'crab'}},
  {mob:{...monster,hp:0}},
  {mob:{...monster,target:'OtherPlayer'}},
  {mob:{...monster,x:900}},
  {char:{...me,map:'bank'}},
  {opts:{...options,plan:{...plan,expires:now-1}}}
 ];
 for(const v of variations){
  assert.equal(leaderAssignedFarmTarget(v.char??me,v.lead??leader,
   [v.mob??monster],v.opts??options),null,JSON.stringify(v));
 }
});

test('native leader target is never broadcast as an unverified or dead farm target',()=>{
 assert.equal(verifiedNativeFarmFocus({...me,target:'bee-7'},
   [monster],plan),'bee-7');
 for(const invalid of [
  {character:{...me,target:'other'}},
  {character:{...me,target:'bee-7',rip:true}},
  {mob:{...monster,mtype:'crab'}},
  {mob:{...monster,hp:0}},
  {mob:{...monster,map:'bank'}},
  {plan:{...plan,target:'crab'}}
 ]){
  assert.equal(verifiedNativeFarmFocus(invalid.character??{...me,target:'bee-7'},
    [invalid.mob??monster],invalid.plan??plan),null);
 }
});

test('native moving flag must not restart an already satisfied follow radius',()=>{
 assert.equal(reachedMovementRadius({...me,moving:true},
   {...me,radius:30}),true);
 assert.equal(reachedMovementRadius({...me,x:145,moving:true},
   {...me,radius:30}),false);
 assert.equal(reachedMovementRadius({...me,map:'bank',moving:false},
   {...me,radius:30}),false);
});
