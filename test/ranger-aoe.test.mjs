import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills} from '../src/combat/skills.mjs';

function rangerFixture(teamCount,outsiders=0,maxTargets=5,{allowNeutral=false,capacity=3,phase='BUILD',foreign=0,maxAggro=5}={}){
 const actions=[];
 const mobs=[
  ...Array.from({length:teamCount},(_,i)=>({id:'team-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:20+i*3,y:0,hp:1200,max_hp:1200,target:i%2?'Ranger2':'Ranger1'})),
  ...Array.from({length:outsiders},(_,i)=>({id:'outsider-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:40+i*3,y:0,hp:1200,max_hp:1200,target:null})),
  ...Array.from({length:foreign},(_,i)=>({id:'foreign-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:75+i*3,y:0,hp:1200,max_hp:1200,target:'UnrelatedParty'}))
 ];
 const c={name:'Ranger1',ctype:'ranger',level:80,map:'main',in:'main',x:0,y:0,range:150,
  mp:2000,max_mp:2000,attack:100,hp:1000,max_hp:1000,slots:{},s:{}};
 const cfg={general:{testLogging:true},farming:{pvp:false,maxAggro},party:{enabled:true,aoe:true,aoeMaxTargets:maxTargets,advancedSkills:true},skills:[]};
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
  teamPlan:{target:()=> 'bee',wantsCombat:()=>true,roles:()=>({})},encounter:{status:()=>({phase,capacity}),approvePullSet:()=>({safe:true})},strategy:{safeTarget:()=>true},
  allies:()=>[],event:()=>{},count:()=>0};
 return {skills:createSkills(bot),mobs,actions};
}

test('ranger waits instead of wasting 3shot on two engaged targets and an unsafe bystander',()=>{
 const {skills,mobs,actions}=rangerFixture(2,1);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,0,'three verified targets required');
});
test('3shot hits three existing party threats with a two-monster new-pull limit',()=>{
 const {skills,mobs,actions}=rangerFixture(3,0,5,{maxAggro:2});skills.use('3shot',mobs[0],.2,0,15,true);
 assert.deepEqual(actions[0].targets.map(x=>x.id),['team-0','team-1','team-2']);
});
test('3shot does not pull a third neutral monster through the new-pull limit',()=>{
 const {skills,mobs,actions}=rangerFixture(2,1,5,{maxAggro:2,capacity:3,allowNeutral:true});skills.use('3shot',mobs[0],.2,0,15,true);
 assert.deepEqual(actions,[],'maxAggro two cannot trigger third unsafe pull');
});
test('3shot can open on three neutral monsters only when encounter and user approve three',()=>{
 const {skills,mobs,actions}=rangerFixture(0,3,5,{maxAggro:3,capacity:3,allowNeutral:true});skills.use('3shot',mobs[0],.2,0,15,true);
 assert.equal(actions[0].targets.length,3);
});
test('requested maxAggro twelve permits a neutral third target, while 3shot itself stays capped at three',()=>{
 const mixed=rangerFixture(2,10,5,{maxAggro:12,capacity:3,allowNeutral:true});mixed.skills.use('3shot',mixed.mobs[0],.2,0,15,true);
 assert.deepEqual(mixed.actions[0].targets.map(x=>x.id),['team-0','team-1','outsider-0']);
 const neutral=rangerFixture(0,12,5,{maxAggro:12,capacity:5,allowNeutral:true});neutral.skills.use('3shot',neutral.mobs[0],.2,0,15,true);
 assert.equal(neutral.actions[0].targets.length,3);
});

test('ranger 5shot caps already engaged targets at five, even when six are nearby',()=>{
 const {skills,mobs,actions}=rangerFixture(6,1);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,1);
 assert.equal(actions[0].skill,'5shot');
 assert.deepEqual(actions[0].targets.map(x=>x.id),['team-0','team-1','team-2','team-3','team-4']);
});

test('ranger fires at one engaged team target without including unapproved neutral monsters',()=>{
 const {skills,mobs,actions}=rangerFixture(1,5);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,0,'single target should use normal attacks');
});

test('ranger respects the per-cast target cap and skill min target floor',()=>{
 const {skills,mobs,actions}=rangerFixture(5,1,2);
 skills.rotation(mobs[0]);
 assert.equal(actions.length,0,'configured two-target cap cannot produce 3shot');
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
 assert.equal(actions.length,0,'one available neutral target is insufficient');
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
 assert.equal(actions.length,0,'limit two is incompatible with an exact-three cast');
});

test('three legal engaged enemies trigger 3shot even when stale single-target focus is out of range',()=>{
 const f=rangerFixture(3,0);
 const far={id:'distant-focus',type:'monster',mtype:'bee',map:'main',in:'main',
  x:600,y:0,hp:1200,max_hp:1200,target:'Ranger1'};
 f.skills.rotation(far);
 assert.equal(f.actions[0]?.skill,'3shot',
  'the current single-target focus is NOT an AoE target-range veto');
 assert.deepEqual(f.actions[0].targets.map(x=>x.id),
  ['team-0','team-1','team-2']);
});
test('out-of-range focus never authorizes a third neutral or another party target',()=>{
 const two=rangerFixture(2,1,5,{allowNeutral:false});
 two.skills.rotation({id:'distant',type:'monster',mtype:'bee',map:'main',
  in:'main',x:500,y:0,hp:1200,target:'Ranger1'});
 assert.equal(two.actions.length,0);
 const foreign=rangerFixture(2,0,5,{foreign:1,allowNeutral:false});
 foreign.skills.rotation({id:'distant',type:'monster',mtype:'bee',map:'main',
  in:'main',x:500,y:0,hp:1200,target:'Ranger1'});
 assert.equal(foreign.actions.length,0,
  'a hostile claimed by strangers must not fill the third AoE slot');
});
