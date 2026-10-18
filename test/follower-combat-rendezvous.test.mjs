import test from 'node:test';
import assert from 'node:assert/strict';
import {followerCombatRendezvous} from '../src/combat/team-readiness.mjs';
const leader={name:'Leader',running:true,rip:false,realm:'EUII',
 map:'main',in:'main',x:500,y:1000,target:'monster-123'};
test('targetless follower approaches a fighting leader even inside old 140-unit follow threshold',()=>{
 const far={map:'main',in:'main',x:590,y:1020};
 const r=followerCombatRendezvous(far,leader,{followDistance:140});
 assert.equal(r.move,true);
 assert.ok(r.distance>55&&r.distance<140);
 assert.ok(r.radius>=20&&r.radius<=40);
 assert.equal(followerCombatRendezvous({...far,x:545,y:1000},leader,{followDistance:140}).move,true,
  '45-unit spectator gap should trigger a tighter rendezvous');
 assert.equal(followerCombatRendezvous({...far,x:520,y:1000},leader,{followDistance:140}).move,false);
});
test('no neutral pull or unsafe follower motion is authorized without current same-realm leader target',()=>{
 const follower={map:'main',in:'main',x:595,y:1000};
 for(const options of [
  {hasEligibleTarget:true},{storageHeld:true},{hasActiveMovement:true}
 ])assert.equal(followerCombatRendezvous(follower,leader,options).move,false);
 for(const different of [{...leader,target:null},{...leader,run:false,running:false},
  {...leader,rip:true},{...leader,map:'bank'},{...leader,in:'different'},
  {...leader,x:NaN}])
 assert.equal(followerCombatRendezvous(follower,different).move,false);
});
