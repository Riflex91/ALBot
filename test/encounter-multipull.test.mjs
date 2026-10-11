import test from 'node:test';
import assert from 'node:assert/strict';
import {createEncounter} from '../src/combat/encounter.mjs';

function scenario(){
 let mobs=[{id:'already',type:'monster',mtype:'bee',target:'Leader',hp:400,x:20,y:0}],
     calls=[],blocked=false,plan='bee';
 const c={name:'Leader',range:150,x:0,y:0,map:'main',in:'main',hp:1000,max_hp:1000,mp:1000,max_mp:1000,xp:0,attack:200};
 const aoe={aoe:[{id:'3shot',capacity:3}]};
 const bot={
  running:true,me:{name:'Leader'},leader:'Leader',recovering:false,farmers:['Leader','Ranger2'],teamNames:['Leader','Ranger2'],
  p:{c,G:{monsters:{bee:{hp:400,attack:20,frequency:1}},skills:{}},read:()=>({}),write:()=>true,call:(id,...args)=>{
   if(id==='can_attack')return true;
   if(id==='is_on_cooldown')return false;
   if(id==='attack')calls.push(args[0].id);
   return false;
  }},
  cfg:{farming:{maxAggro:5,pullHp:.8,pullMp:.5,restBelow:.3,adaptivePull:true,rangeBuffer:10},party:{aoe:true,aoeMaxTargets:5}},
  transport:{fresh:n=>({name:n,running:true,hp:1000,max_hp:1000,mp:1000,max_mp:1000,capabilities:aoe})},
  capabilities:{available:()=>false,snapshot:()=>aoe},gear:{snapshot:()=>({})},
  teamPlan:{target:()=>plan,wantsCombat:()=>true},monsters:()=>mobs,entity:id=>mobs.find(m=>m.id===id),
  strategy:{safeTarget:()=>true},allowed:m=>!blocked&&m.mtype==='bee'&&(!m.target||m.target==='Leader'),
  exec:{run:(_key,_locks,guard,act)=>{if(!guard())return false;act();return true;}},
  skills:{use:()=>false}
 };
 const encounter=createEncounter(bot);
 return {bot,encounter,c,calls,add:()=>{mobs=[
 {id:'already',type:'monster',mtype:'bee',target:'Leader',hp:400,x:20,y:0},
 {id:'fresh',type:'monster',mtype:'bee',target:null,hp:400,x:40,y:0},
 {id:'not-for-us',type:'monster',mtype:'goo',target:null,hp:400,x:35,y:0}
 ];},clear:()=>{mobs=[]},setBlocked:b=>blocked=b,setPlan:v=>plan=v};
}
test('after a healthy single kill, leader can add one approved bee for teammate 3shot',()=>{
 const f=scenario();f.encounter.tick();f.clear();f.c.xp=100;f.encounter.tick();f.add();f.encounter.tick();
 assert.equal(f.encounter.status().phase,'BUILD');
 assert.equal(f.encounter.status().capacity,2);
 assert.equal(f.encounter.pull(),true);
 assert.deepEqual(f.calls,['fresh']);
});
test('never pull unapproved mobs, foreign types, or unknown farming plan',()=>{
 const f=scenario();f.encounter.tick();f.clear();f.encounter.tick();f.add();f.encounter.tick();
 f.setBlocked(true);assert.equal(f.encounter.pull(),false);
 f.setBlocked(false);f.setPlan(null);assert.equal(f.encounter.pull(),false);
 assert.deepEqual(f.calls,[]);
});
test('adaptive pull disabled retains single-target boundary',()=>{
 const f=scenario();f.bot.cfg.farming.adaptivePull=false;
 f.encounter.tick();f.clear();f.encounter.tick();f.add();f.encounter.tick();
 assert.equal(f.encounter.status().capacity,1);
 assert.equal(f.encounter.pull(),false);
});
