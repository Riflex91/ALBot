import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills} from '../src/combat/skills.mjs';

function rogueFixture({skills={},targets=1,foreign=false,capacity=3,allowedNeutral=true}={}){
 const c={name:'My_Rogue',ctype:'rogue',level:80,map:'main',in:'main',x:0,y:0,range:65,
   hp:1000,max_hp:1000,mp:1200,max_mp:1200,attack:100,slots:{mainhand:{name:'fireblade',level:3},offhand:null},s:{}};
 const mobs=Array.from({length:targets},(_,i)=>({id:'bee-'+i,type:'monster',mtype:'bee',
  map:'main',in:'main',x:20+i*4,y:0,hp:300,max_hp:300,target:allowedNeutral?null:'My_Rogue'}));
 if(foreign)mobs.push({id:'stranger',type:'monster',mtype:'bee',map:'main',in:'main',
  x:26,y:0,hp:300,max_hp:300,target:'OtherTeam'});
 const calls=[],cfg={general:{testLogging:true},farming:{pvp:false,maxAggro:5},
  party:{enabled:false,aoe:true,aoeMaxTargets:5,buffs:true},skills:[]};
 const p={c,parent:{is_pvp:false},G:{items:{fireblade:{wtype:'short_sword'}},monsters:{bee:{}},maps:{main:{}},
   skills},call:(method,...args)=>{if(method==='is_on_cooldown')return false;
    if(method==='use_skill')calls.push({id:args[0],target:args[1]});return null;}};
 const bot={p,cfg,teamNames:['My_Rogue'],farmers:['My_Rogue'],leader:'My_Rogue',me:{name:'My_Rogue'},
  exec:{run:(_key,_locks,guard,invoke)=>{if(!guard())return false;invoke();return true;}},
  entity:id=>mobs.find(m=>m.id===id),monsters:()=>mobs,
  allowed:m=>!!m&&(m.target==='My_Rogue'||!m.target&&allowedNeutral),
  teamPlan:{target:()=> 'bee',wantsCombat:()=>true,roles:()=>({})},
  strategy:{safeTarget:()=>true},encounter:{status:()=>({phase:'BUILD',capacity}),approvePullSet:()=>({safe:true})},
  allies:()=>[],event(){},count:()=>0};
 return {c,mobs,calls,bot,rotation:createSkills(bot)};
}
test('fireblade does not bypass dagger or fist requirements; blocked reasons are visible',()=>{
 const f=rogueFixture({allowedNeutral:false,skills:{
  quickstab:{class:['rogue'],hostile:true,mp:40,range:70,wtype:'dagger'},
  quickpunch:{class:['rogue'],hostile:true,mp:40,range:70,wtype:'fist'}
 }});
 assert.equal(f.rotation.use('quickstab',f.mobs[0],.2),false);
 assert.equal(f.rotation.use('quickpunch',f.mobs[0],.2),false);
 assert.equal(f.rotation.diagnostics().quickstab.weaponBlocked,1);
 assert.equal(f.rotation.diagnostics().quickpunch.weaponBlocked,1);
 assert.deepEqual(f.calls,[]);
});
test('mentalburst is considered in a three-hit fight rather than requiring more than four hits',()=>{
 const f=rogueFixture({allowedNeutral:false,skills:{
  mentalburst:{class:['rogue'],hostile:true,mp:40,range:70}
 }});
 f.rotation.rotation(f.mobs[0]);
 assert.deepEqual(f.calls.map(c=>c.id),['mentalburst']);
 assert.equal(f.rotation.diagnostics().mentalburst.started,1);
});
test('Rogue fanofknives can open approved neutral fight without a targeted payload',()=>{
 const f=rogueFixture({skills:{fanofknives:{class:['rogue'],hostile:true,mp:100,range:70}},
  targets:2,capacity:2});
 f.rotation.rotation(f.mobs[0]);
 assert.deepEqual(f.calls.map(c=>c.id),['fanofknives']);
 assert.equal(f.calls[0].target,null);
});
test('untargeted fanofknives refuses a foreign engaged mob in blast radius',()=>{
 const f=rogueFixture({skills:{fanofknives:{class:['rogue'],hostile:true,mp:100,range:70}},
  targets:2,capacity:2,foreign:true});
 f.rotation.rotation(f.mobs[0]);
 assert.deepEqual(f.calls,[]);
 assert.ok(f.rotation.diagnostics().fanofknives.targetBlocked>=1);
});
