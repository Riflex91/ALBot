import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills} from '../src/combat/skills.mjs';

function rangerFixture(teamCount,outsiders=0,maxTargets=5,{allowNeutral=false,capacity=3,phase='BUILD',foreign=0}={}){
 const actions=[];
 const mobs=[
  ...Array.from({length:teamCount},(_,i)=>({id:'team-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:20+i*3,y:0,hp:1200,max_hp:1200,target:i%2?'Ranger2':'Ranger1'})),
  ...Array.from({length:outsiders},(_,i)=>({id:'outsider-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:40+i*3,y:0,hp:1200,max_hp:1200,target:null})),
  ...Array.from({length:foreign},(_,i)=>({id:'foreign-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:75+i*3,y:0,hp:1200,max_hp:1200,target:'UnrelatedParty'}))
 ];
 const c={name:'Ranger1',ctype:'ranger',level:80,map:'main',in:'main',x:0,y:0,range:150,
  mp:2000,max_mp:2000,attack:100,hp:1000,max_hp:1000,slots:{},s:{}};
 const cfg={general:{testLogging:true},farming:{pvp:false,maxAggro:5},party:{enabled:true,aoe:true,aoeMaxTargets:maxTargets,advancedSkills:true},skills:[]};
 const p={c,parent:{is_pvp:false},G:{items:{},skills:{
  '3shot':{class:['ranger'],level:60,mp:300,range:150,hostile:true},
  '5shot':{class:['ranger'],level:75,mp:420,range:150,hostile:true},
 },monsters:{bee:{}},maps:{main:{}}},call:(name,...args)=>{
  if(name==='is_on_cooldown')return false;
  if(name==='use_skill')actions.push({skill:args[0],targets:args[1]});
  return null;
 }};
 const bot={p,cfg,exec:{run:(_key,_locks,guard,invoke)=>{if(!guard())return false;invoke();return true;}},
  teamNames:['Ranger1','Ranger2'],monsters:()=>mobs,entity:id=>mobs.find(m=>m.id===id),
  allowed:m=>!!m&&((!!m.target&&['Ranger1','Ranger2'].includes(m.target))||(allowNeutral&&!m.target&&m.mtype==='bee')),
  teamPlan:{target:()=> 'bee',wantsCombat:()=>true},encounter:{status:()=>({phase,capacity})},strategy:{safeTarget:()=>true},
  allies:()=>[],event:()=>{},count:()=>0};
 return {skills:createSkills(bot),mobs,actions};
}

test('ranger 3shot selects the two engaged teammates targets despite a neutral bystander',()=>{
 const {skills,mobs,actions}=rangerFixture(2,1);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,1);
 assert.equal(actions[0].skill,'3shot');
 assert.deepEqual(actions[0].targets.map(x=>x.id),['team-0','team-1']);
});

test('ranger 5shot caps already engaged targets at five, even when six are nearby',()=>{
 const {skills,mobs,actions}=rangerFixture(6,1);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,1);
 assert.equal(actions[0].skill,'5shot');
 assert.deepEqual(actions[0].targets.map(x=>x.id),['team-0','team-1','team-2','team-3','team-4']);
});

test('ranger ignores unapproved neutral monsters even when they would enable an AoE skill',()=>{
 const {skills,mobs,actions}=rangerFixture(1,5);
 skills.rotation(mobs[0]);
 assert.deepEqual(actions,[]);
});

test('ranger respects the per-cast target cap and skill min target floor',()=>{
 const {skills,mobs,actions}=rangerFixture(5,1,2);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,1);
 assert.equal(actions[0].skill,'3shot');
 assert.equal(actions[0].targets.length,2);
 assert.ok(actions[0].targets.every(t=>t.target==='Ranger1'||t.target==='Ranger2'));
});

test('ranger opens combat with 3shot on three explicitly approved neutral targets',()=>{
 const {skills,mobs,actions}=rangerFixture(0,3,5,{allowNeutral:true,capacity:3});
 skills.rotation(mobs[0]);
 assert.equal(actions[0]?.skill,'3shot');
 assert.deepEqual(actions[0].targets.map(t=>t.id),['outsider-0','outsider-1','outsider-2']);
});
test('ranger may start with one legal neutral target without waiting for existing aggro',()=>{
 const {skills,mobs,actions}=rangerFixture(0,1,5,{allowNeutral:true,capacity:1});
 skills.rotation(mobs[0]);
 assert.deepEqual(actions[0]?.targets.map(t=>t.id),['outsider-0']);
});
test('neutral AoE opener rejects unsafe phases, and never selects foreign-party monsters',()=>{
 const stopped=rangerFixture(0,3,5,{allowNeutral:true,capacity:3,phase:'RECOVER'});
 stopped.skills.rotation(stopped.mobs[0]);assert.deepEqual(stopped.actions,[]);
 const mixed=rangerFixture(0,3,5,{allowNeutral:true,capacity:3,foreign:1});
 mixed.skills.rotation(mixed.mobs[0]);
 assert.deepEqual(mixed.actions[0]?.targets.map(t=>t.id),['outsider-0','outsider-1','outsider-2']);
 assert.ok(!mixed.actions[0]?.targets.some(t=>t.target==='UnrelatedParty'));
});
test('approved neutral opener respects reduced per-skill target limit',()=>{
 const {skills,mobs,actions}=rangerFixture(0,4,2,{allowNeutral:true,capacity:5});
 skills.rotation(mobs[0]);
 assert.equal(actions[0]?.skill,'3shot');
 assert.equal(actions[0]?.targets.length,2);
});
