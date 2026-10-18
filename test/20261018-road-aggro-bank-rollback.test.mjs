import test from 'node:test';
import assert from 'node:assert/strict';
import {committedFarmTransit,roadAggroTravelDecision} from '../src/combat/transit-defense.mjs';
import {selectedFarmerAvailable} from '../src/party/account.mjs';
import {reclaimRollbackEvidence} from '../src/merchant/bank.mjs';
const char={name:'My_Ranger1',map:'main',in:'main',x:1200,y:420,hp:4000,max_hp:4200};
const plan={id:'p:1',key:'halloween:minimush:4',map:'halloween',
 in:'halloween',x:8,y:630,kind:'farm'};
const route={owner:'follow',mode:'smart_move',dest:{map:'halloween',in:'halloween',x:8,y:630}};
const bigbird={id:'danger',mtype:'bigbird',target:'My_Ranger1',hp:3200,dead:false};
test('roadside bigbird must NOT replace the verified shared native route with orbit/spiral',()=>{
 assert.equal(committedFarmTransit(char,route,plan),true);
 assert.deepEqual(roadAggroTravelDecision(char,route,plan,[bigbird],
  ['My_Ranger1','My_Ranger2','My_Priest']),{
  continueRoute:true,reason:'team-road-aggro-preserve-native-route',hostileCount:1});
 assert.equal(committedFarmTransit(char,{...route,owner:'kite'},plan),false);
 assert.equal(committedFarmTransit(char,{...route,dest:{...route.dest,x:1000}},plan),false);
 assert.equal(committedFarmTransit({...char,map:'halloween',in:'halloween',x:8,y:630},route,plan),false);
 assert.equal(committedFarmTransit(char,route,{...plan,kind:'quest'}),false);
 assert.equal(roadAggroTravelDecision(char,route,plan,[{...bigbird,target:'Other'}],
  ['My_Ranger1','My_Ranger2']).continueRoute,false);
});
test('respawn keeps already observed selected combat roster for at most 45s',()=>{
 const now=100000,dead={running:true,rip:true,realm:'EUII'};
 const options={selected:true,lastSeen:65000,now,realm:'EUII'};
 assert.equal(selectedFarmerAvailable(dead,options),true);
 assert.equal(selectedFarmerAvailable(dead,{...options,lastSeen:54999}),false);
 assert.equal(selectedFarmerAvailable(dead,{...options,selected:false}),false);
 assert.equal(selectedFarmerAvailable({...dead,running:false},options),false);
 assert.equal(selectedFarmerAvailable({...dead,realm:'USIV'},options),false);
 assert.equal(selectedFarmerAvailable({...dead,inventoryBlocked:true},options),false);
 assert.equal(selectedFarmerAvailable({...dead,rip:false},options),true);
});
test('revoked bank sale rolls back ONLY an exact still-carried item into empty original slot',()=>{
 const item={name:'beewings',level:0,q:7};
 const record={item,pack:'items0',slot:9,dest:3,quantity:7,
  before:2,bankBefore:18,sourcePrint:'beewings'};
 assert.equal(reclaimRollbackEvidence(record,{...item},null,11),true);
 assert.equal(reclaimRollbackEvidence(record,{...item,q:6},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item,level:1},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item},item,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item},null,12),false);
 assert.equal(reclaimRollbackEvidence({...record,quantity:0},{...item},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,null,null,11),false);
});
