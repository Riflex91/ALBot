import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedFollowerOneShot,neutralPullReadiness} from '../src/combat/team-readiness.mjs';

const now=Date.now();
const plan={id:'farm:bee:7',target:'bee',map:'main',in:'main',x:100,y:100,
 realm:'EUII',expires:now+30000};
const actor={name:'Ranger2',ctype:'ranger',map:'main',in:'main',
 x:110,y:100,hp:900,max_hp:1000,mp:200,max_mp:300,
 attack:600,damage_type:'physical',apiercing:0};
const peer=name=>({name,running:true,rip:false,realm:'EUII',
 map:'main',in:'main',x:120,y:105,hp:900,max_hp:1000,
 mp:200,max_mp:300,received:now,inventoryBlocked:false,
 journal:false,reserved:false});
const leader={...peer('Ranger1'),farmPlan:{...plan},target:'bee-other'};
const peers=[leader,peer('Priest')];
const monster={id:'bee-8',type:'monster',mtype:'bee',map:'main',in:'main',
 x:130,y:100,hp:100,dead:false,target:null};
const meta={hp:100,attack:20,frequency:1,armor:0,resistance:0,
 avoidance:0,evasion:0,reflection:0};
const options={plan,leader,peers,game:{monsters:{bee:meta}},realm:'EUII',now};
const admits=(m=monster,o=options,c=actor)=>
 verifiedFollowerOneShot(c,m,o);

test('assembled Ranger can independently one-shot another neutral same-spawn bee',()=>{
 const proof=admits();
 assert.ok(proof);
 assert.ok(proof.margin>=1.2);
 assert.ok(proof.damage>=monster.hp);
});
test('independent one-shots fail closed for stale team and mismatched plans',()=>{
 for(const override of [
  {leader:{...leader,received:now-5000}},
  {leader:{...leader,realm:'USIV'}},
  {leader:{...leader,farmPlan:{...plan,id:'other'}}},
  {plan:{...plan,expires:now-1}},
  {plan:{...plan,target:'crab'}},
  {peers:[{...peers[0],hp:100},peers[1]]},
  {peers:[peers[0],{...peers[1],received:now-5000}]},
  {peers:[peers[0],{...peers[1],map:'bank'}]},
  {peers:[peers[0],{...peers[1],journal:true}]},
  {peers:[]}
 ]){
  assert.equal(admits(monster,{...options,...override}),null,
   JSON.stringify(override));
 }
});
test('damage, dodge and special mechanics prevent speculative one-shot claims',()=>{
 for(const m of [
  {...monster,target:'OtherPlayer'},
  {...monster,mtype:'crab'},
  {...monster,x:500},
  {...monster,hp:2000},
  {...monster,hp:0},
  {...monster,dead:true},
  {...monster,invincible:true}
 ])assert.equal(admits(m),null,JSON.stringify(m));
 for(const variant of [
  {avoidance:1},{evasion:10},{reflection:20},{armor:10000},
  {boss:true},{explosion:true},{abilities:{multiattack:{}}}
 ]){
  const altered={...options,game:{monsters:{bee:{...meta,...variant}}}};
  assert.equal(admits(monster,altered),null,JSON.stringify(variant));
 }
 assert.equal(admits(monster,options,{...actor,attack:80}),null);
});
test('existing normal neutral-pull gate still rejects followers',()=>{
 const denied=neutralPullReadiness({
  me:{name:'Ranger2'},cfg:{party:{enabled:true,waitForTeam:true}},
  p:{c:actor,G:{},realm:()=> 'EUII'},
  account:{rotationPending:()=>false},leader:'Ranger1',
  farmers:['Ranger1','Ranger2']
 });
 assert.equal(denied.ready,false);
 assert.equal(denied.reason,'follower-cannot-pull');
});
