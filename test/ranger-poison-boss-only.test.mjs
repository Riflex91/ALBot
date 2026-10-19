import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills,poisonArrowCombatAllowed} from '../src/combat/skills.mjs';

const monster=(mtype='bee')=>({id:'M-1',type:'monster',mtype,map:'main',
 in:'main',x:30,y:0,hp:5000,max_hp:5000,target:'R'});
const G={monsters:{bee:{},greenjr:{boss:true},eventmob:{}},
 skills:{poisonarrow:{class:['ranger'],consume:'poison',hostile:true,mp:360,
  range:200,wtype:['bow'],target:true,condition:'poisoned'}},
 items:{bow:{wtype:'bow'}},maps:{main:{}},conditions:{}};
function fixture(){
 const c={name:'R',ctype:'ranger',level:80,map:'main',in:'main',x:0,y:0,
  hp:1000,max_hp:1000,mp:2000,max_mp:2000,attack:100,range:180,
  slots:{mainhand:{name:'bow'}},s:{}};
 const calls=[],events=[];
 let target=monster(),activity=null,deferred=null;
 const p={c,G,parent:{is_pvp:false},call:(name,...args)=>{
  if(name==='is_on_cooldown')return false;
  if(name==='use_skill')calls.push(args);
  return Promise.resolve({});
 }};
 const bot={p,cfg:{general:{testLogging:true},farming:{pvp:false,maxAggro:5},
   party:{enabled:false,aoe:false,aoeMaxTargets:5},skills:[]},
  me:{name:'R',role:'farmer'},farmers:['R'],teamNames:['R'],running:true,
  count:()=>4,canConsumeImplicit:()=>true,
  beginValue(){},endValue(){},event:(name,details)=>events.push({name,details}),
  entity:id=>id===target.id?target:null,monsters:()=>[target],allowed:()=>true,
  strategy:{heartbeat:()=>activity},bosses:{profile:id=>id==='greenjr'?
   {id,supported:true}:null},
  teamPlan:{roles:()=>({})},exec:{run:(_key,_locks,guard,call)=>{
   deferred={guard,call};if(!guard())return false;call();return true;
  }}};
 return {bot,c,p,calls,events,skills:createSkills(bot),
  setTarget:m=>{target=m;},setActivity:a=>{activity=a;},
  queued:()=>deferred};
}
test('normal farm monster cannot spend poison even through explicit use',()=>{
 const f=fixture(),target=monster('bee');
 f.setTarget(target);
 assert.equal(f.skills.use('poisonarrow',target,0,0,5,true),false);
 assert.equal(f.calls.length,0);
});
test('confirmed boss allows Poison Arrow and the normal resource guards still run',()=>{
 const f=fixture(),target=monster('greenjr');f.setTarget(target);
 assert.equal(f.skills.use('poisonarrow',target,0,0,5,true),true);
 assert.equal(f.calls[0][0],'poisonarrow');
});
test('event authorization requires active objective, exact target and no unknown observation',()=>{
 const target=monster('eventmob'),active={kind:'event',target:'eventmob',
  map:'main',in:'main',expires:Date.now()+20000};
 assert.equal(poisonArrowCombatAllowed(G,target,active),true);
 assert.equal(poisonArrowCombatAllowed(G,target,{...active,observationUnknown:true}),false);
 assert.equal(poisonArrowCombatAllowed(G,target,{...active,target:'bee'}),false);
 assert.equal(poisonArrowCombatAllowed(G,target,{...active,expires:Date.now()-1}),false);
 assert.equal(poisonArrowCombatAllowed(G,target,{...active,kind:'quest'}),false);
 const f=fixture();f.setTarget(target);f.setActivity(active);
 assert.equal(f.skills.use('poisonarrow',target,0,0,5,true),true);
});
test('skill dispatch denies poisoned arrows after boss target identity changes',()=>{
 const f=fixture(),boss=monster('greenjr');f.setTarget(boss);
 f.bot.exec.run=(_key,_locks,guard)=>{f.guard=guard;return true;};
 assert.equal(f.skills.use('poisonarrow',boss,0,0,5,true),true);
 assert.equal(f.guard(),true);
 f.setTarget({...monster('bee'),id:boss.id});
 assert.equal(f.guard(),false);
 assert.deepEqual(f.calls,[]);
});
