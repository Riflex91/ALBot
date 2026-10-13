import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills} from '../src/combat/skills.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';

function fixture(targetCount,{explicit=false,level=80}={}){
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);
 cfg.party.enabled=true;cfg.party.aoe=true;cfg.party.aoeMaxTargets=5;
 cfg.farming.maxAggro=5;cfg.farming.pvp=false;
 const char={name:'Ranger1',ctype:'ranger',level,mp:1600,max_mp:2000,
  map:'main',in:'main',x:0,y:0,hp:2000,max_hp:2000,attack:100,
  range:240,slots:{},s:{}};
 const monsters=Array.from({length:targetCount},(_,n)=>({
  id:'g'+n,type:'monster',mtype:'goo',target:'Ranger1',
  map:'main',in:'main',x:20+n,y:0,hp:1000,max_hp:1000}));
 const calls=[],scheduled=[];
 const G={skills:{
  '3shot':{class:['ranger'],level:60,range:250,mp:200,share:'attack',hostile:true,target:'monster'},
  '5shot':{class:['ranger'],level:75,range:250,mp:320,share:'attack',hostile:true,target:'monster'}
 },monsters:{goo:{attack:1}},items:{},maps:{main:{}}};
 if(explicit){
  const rule=defaultsFor(FULL_DESCRIPTOR.schema.properties.skills.items);
  cfg.skills=[{...rule,name:'Einzelziel ausdrücklich',enabled:true,skill:'3shot',
   class:'ranger',character:'Ranger1',target:'enemy',
   minTargets:1,maxTargets:1,conditions:[]}];
 }
 const bot={me:{name:'Ranger1',role:'farmer'},farmers:['Ranger1'],
  cfg,p:{c:char,G,parent:{is_pvp:false},call(method,...args){
   if(method==='is_on_cooldown')return false;
   if(method==='can_attack')return true;
   if(method==='use_skill'){calls.push({id:args[0],targets:args[1],extra:args[2]});return Promise.resolve({success:true});}
   return false;
  }},teamNames:['Ranger1'],target:null,
  monsters:()=>monsters,allies:()=>[],allowed:()=>true,
  entity:id=>monsters.find(m=>m.id===id),
  teamPlan:{target:()=> 'goo',wantsCombat:()=>true,roles:()=>({})},
  strategy:{safeTarget:()=>true},event:()=>{},measure:()=>({}),
  exec:{run(name,resources,guard,fn){scheduled.push({name,resources});if(!guard())return false;fn();return true;}}};
 bot.skills=createSkills(bot);
 return {bot,monsters,calls,scheduled,run(){bot.skills.rotation(monsters[0]??null);}};
}
test('single target in verified one-hit normal attack range does not waste Ranger 3shot mana',()=>{
 const f=fixture(1);f.monsters[0].hp=100;f.run();
 assert.deepEqual(f.calls,[]);
 assert.deepEqual(f.scheduled,[]);
});
test('two already engaged targets admit normal 3shot on shared attack resource',()=>{
 const f=fixture(2);f.run();
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].id,'3shot');
 assert.equal(f.calls[0].targets.length,2);
 assert.ok(f.scheduled[0].resources.includes('attack'));
});
test('four already engaged targets prefer 5shot when unlocked',()=>{
 const f=fixture(4);f.run();
 assert.equal(f.calls[0]?.id,'5shot');
 assert.equal(f.calls[0]?.targets.length,4);
});
test('four engaged targets at level 65 fallback from locked 5shot to 3shot',()=>{
 const f=fixture(4,{level:65});f.run();
 assert.equal(f.calls[0]?.id,'3shot');
 assert.equal(f.calls[0]?.targets.length,3);
});
test('an explicit one-target 3shot rule is respected despite verified normal one-hit range',()=>{
 const f=fixture(1,{explicit:true});f.monsters[0].hp=100;f.run();
 assert.equal(f.calls[0]?.id,'3shot');
 assert.equal(f.calls[0]?.targets.length,1);
 assert.ok(f.scheduled[0].resources.includes('attack'));
});

test('single higher-health engaged mob retains verified Ranger 3shot opener',()=>{
 const f=fixture(1);f.run();
 assert.equal(f.calls[0]?.id,'3shot');
 assert.equal(f.calls[0]?.targets.length,1);
});
