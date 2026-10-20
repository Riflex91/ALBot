import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verifiedFollowerOneShot,verifiedFollowerBoundedSpawn,
 verifiedFollowerAoeBoundedSpawn
} from '../src/combat/team-readiness.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';
const now=Date.now();
const plan={id:'safe:bee:35',target:'bee',map:'main',in:'main',
 realm:'EUII',x:100,y:100,expires:now+60000};
const actor={name:'My_Ranger2',ctype:'ranger',map:'main',in:'main',
 x:103,y:99,attack:320,frequency:1.1,apiercing:0,
 hp:4300,max_hp:4500,mp:1700,max_mp:2000};
const meta={hp:300,attack:27,frequency:1,
 armor:0,resistance:0,avoidance:0,evasion:0,reflection:0};
const game={monsters:{bee:meta},maps:{main:{pvp:false}}};
const mobs=(count=3)=>Array.from({length:count},(_,i)=>({
 id:'weak-'+i,type:'monster',mtype:'bee',map:'main',in:'main',
 x:110+i*10,y:101,hp:300,dead:false,target:null
}));
const peer=name=>({name,running:true,rip:false,realm:'EUII',
 received:now,map:'main',in:'main',x:102,y:100,
 hp:4200,max_hp:4500,mp:1800,max_mp:2000});
const leader={...peer('My_Ranger1'),farmPlan:{...plan}};
const others=[leader,peer('My_Priest')];
const opts={plan,leader,peers:others,realm:'EUII',game,now};

test('normal attack may safely clear two-hit bee although exact one-shot proof fails',()=>{
 const m=mobs(1)[0];
 assert.equal(verifiedFollowerOneShot(actor,m,opts),null);
 const proof=verifiedFollowerBoundedSpawn(actor,m,opts);
 assert.ok(proof,'verified small creature ought to be admitted');
 assert.equal(proof.hits,2);
 assert.ok(proof.seconds<=6);
 assert.ok(proof.marginHp>=0);
});

test('bounded neutral combat rejects stronger monsters and unsafe personal risk',()=>{
 const m=mobs(1)[0];
 assert.equal(verifiedFollowerBoundedSpawn({...actor,attack:65},m,opts),null);
 assert.equal(verifiedFollowerBoundedSpawn({...actor,hp:700},m,opts),null);
 assert.equal(verifiedFollowerBoundedSpawn({...actor,frequency:.15},m,opts),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,{...m,target:'Other'},opts),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,{...m,mtype:'crab'},opts),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,m,{...opts,peers:[leader,{...others[1],received:now-8000}]}),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,m,{...opts,game:{monsters:{bee:{...meta,attack:3000}}}}),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,m,{...opts,game:{monsters:{bee:{...meta,abilities:{stun:{}}}}}}),null);
 assert.equal(verifiedFollowerBoundedSpawn(actor,m,{...opts,plan:{...plan,id:'wrong'}}),null);
});

test('multi-target verification approves short casts only against distinct proven spawn mobs',()=>{
 const targets=mobs(3);
 const skill={hostile:true,damage_multiplier:.9,range:300};
 assert.equal(verifiedFollowerAoeBoundedSpawn(actor,targets,{
   ...opts,skillId:'3shot',skill})?.targets,3);
 assert.equal(verifiedFollowerAoeBoundedSpawn(actor,targets.slice(0,2),{
   ...opts,skillId:'3shot',skill}),null);
 assert.equal(verifiedFollowerAoeBoundedSpawn(actor,[targets[0],targets[0],targets[2]],{
   ...opts,skillId:'3shot',skill}),null);
 assert.equal(verifiedFollowerAoeBoundedSpawn(actor,[targets[0],{...targets[1],target:'Other'},targets[2]],{
   ...opts,skillId:'3shot',skill}),null);
 assert.equal(verifiedFollowerAoeBoundedSpawn(actor,targets,{
   ...opts,skillId:'3shot',skill:{...skill,damage_multiplier:.2}}),null);
});

test('encounter grants strictly bounded follower combat, never an active second pull on same actor',()=>{
 const m=mobs(1)[0],teamNames=['My_Ranger1','My_Ranger2','My_Priest'];
 let live=[m];
 const bot={
   me:{name:actor.name,role:'farmer'},leader:'My_Ranger1',
   running:true,recovering:false,inventoryBlocked:false,journal:null,
   p:{c:{...actor},G:game,realm:()=> 'EUII',read:()=>({}),parent:{}},
   cfg:{party:{enabled:true,healing:false},farming:{freeSlots:3,maxAggro:12}},
   teamNames,farmers:teamNames,
   monsters:()=>live,free:()=>30,
   strategy:{busy:false,safeTarget:()=>true},
   teamPlan:{heartbeat:()=>plan,target:()=> 'bee',wantsCombat:()=>true},
   transport:{fresh:n=>n===leader.name?leader:others.find(x=>x.name===n)}
 };
 const encounter=createEncounter(bot);
 assert.equal(encounter.soloOneShot(m),null);
 assert.ok(encounter.soloBoundedSpawn(m),'bounded independently permitted');
 assert.equal(encounter.permit(m),true);
 live=[m,{...m,id:'attacker',target:actor.name}];
 assert.equal(encounter.soloBoundedSpawn(m),null,
  'never initiate second neutral fight while follower is under attack');
});
