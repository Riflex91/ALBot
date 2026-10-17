import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatAssessment} from '../src/combat/threat-capability.mjs';
import {teamRealmRendezvous,nonPvpRealm} from '../src/party/travel.mjs';

const farmer=['My_Ranger1','My_Ranger2','My_Priest'];
const peer=(name,realm)=>({name,running:true,realm,rip:false,hp:3000,max_hp:4000,threats:0,
 map:'main',in:'main',x:0,y:0});
function roster(localName,localRealm,remotes){
 return teamRealmRendezvous({farmers:farmer,localName,localRealm,
  peers:Object.fromEntries(remotes.map(x=>[x.name,x]))});
}

test('Ranger1 and Ranger2 on USI plus Priest on USIV elect USI from all three farmers',()=>{
 const a=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USIV')]);
 const b=roster('My_Priest','USIV',[
  peer('My_Ranger1','USI'),peer('My_Ranger2','USI')]);
 assert.equal(a.target,'USI');
 assert.equal(b.target,'USI');
 assert.equal(a.split,true);
 assert.equal(b.split,true);
 assert.deepEqual(a.counts,{USI:2,USIV:1});
});

test('Merchant on USIV also follows the 2 of 3 Farmer consensus to USI',()=>{
 const x=roster('My_Merchant','USIV',[
  peer('My_Ranger1','USI'),peer('My_Ranger2','USI'),peer('My_Priest','USIV')]);
 assert.equal(x.complete,true);
 assert.equal(x.split,true);
 assert.equal(x.target,'USI');
 const reunited=roster('My_Merchant','USI',farmer.map(n=>peer(n,'USI')));
 assert.equal(reunited.complete,true);
 assert.equal(reunited.split,false);
});

test('No return hop if already united, incomplete or no trusted fresh selected farmer',()=>{
 const unified=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USI')]);
 assert.equal(unified.complete,true);
 assert.equal(unified.split,false);
 const missing=roster('My_Ranger1','USI',[peer('My_Ranger2','USI')]);
 assert.equal(missing.complete,false);
 assert.equal(missing.target,null);
 const dead=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),{...peer('My_Priest','USIV'),running:false}]);
 assert.equal(dead.complete,false);
 const pvp=roster('My_Ranger1','USI',[
  peer('My_Ranger2','USI'),peer('My_Priest','USPVP')]);
 assert.equal(pvp.complete,false);
 assert.equal(nonPvpRealm('USIV'),true);
});

test('Configured home or fixed leader overrides majority only when explicitly specified',()=>{
 const peers={
  My_Ranger1:peer('My_Ranger1','USI'),
  My_Ranger2:peer('My_Ranger2','USI'),
  My_Priest:peer('My_Priest','USIV')};
 const home=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,homeRealm:'USIV'});
 assert.equal(home.target,'USIV');
 const leader=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,fixedLeader:'My_Priest'});
 assert.equal(leader.target,'USIV');
 const invalid=teamRealmRendezvous({farmers:farmer,localName:'My_Merchant',
  localRealm:'USIV',peers,homeRealm:'USPVP'});
 assert.equal(invalid.target,'USI');
});

test('New Priest threat emergency does not read rip of null unobserved team peer',()=>{
 const c={name:'My_Priest',ctype:'priest',hp:2500,max_hp:3000,rip:false,
  map:'main',in:'main',x:0,y:0};
 let ranger=null;
 const bot={farmers:farmer,me:{name:'My_Priest'},running:true,
  p:{c,realm:()=> 'USIV',G:{monsters:{greenjr:{aggro:1}}}},
  transport:{fresh:n=>n==='My_Ranger1'?ranger:null},
  monsters:()=>[],event(){}};
 const evaluator=createCombatAssessment(bot);
 assert.doesNotThrow(()=>evaluator.emergency());
 assert.deepEqual(evaluator.emergency(),{
  active:false,monsters:[],critical:[],anchor:null});
 ranger={...peer('My_Ranger1','USI'),hp:200,max_hp:4000,threats:1,received:Date.now()};
 assert.equal(evaluator.emergency().active,false,'cross-server injured farmer does not trigger a fake local emergency');
 ranger={...ranger,realm:'USIV'};
 assert.equal(evaluator.emergency().active,true);
 assert.equal(evaluator.emergency().critical[0].name,'My_Ranger1');
 ranger={...ranger,received:Date.now()-8000};
 assert.equal(evaluator.emergency().active,false,'stale health data may not control Priest movement');
 evaluator.close();
});
