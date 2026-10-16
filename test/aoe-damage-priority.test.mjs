import test from 'node:test';
import assert from 'node:assert/strict';
import {aoeDamageScore,createSkills} from '../src/combat/skills.mjs';

function fixture(ctype='ranger',hps=[1000,1000,1000,1000],{
 mp=2000,cooldowns=[],custom3shot=false
}={}){
 const calls=[],events=[],mobs=hps.map((hp,i)=>({
  id:'mob-'+i,type:'monster',mtype:'bee',map:'main',in:'main',
  x:20+i,y:0,target:'F1',hp,max_hp:1000,armor:0,resistance:0
 }));
 const c={name:'F1',ctype,level:80,attack:100,frequency:1,mp,max_mp:2000,
  hp:1000,max_hp:1000,map:'main',in:'main',x:0,y:0,range:200,
  slots:{mainhand:{name:ctype==='ranger'?'bow':'dagger'},belt:{name:'knifebelt'}},s:{}};
 const game={maps:{main:{}},monsters:{bee:{}},
  items:{bow:{wtype:'bow'},dagger:{wtype:'dagger'},knifebelt:{}},
  skills:{
   '3shot':{class:['ranger'],wtype:['bow'],level:60,hostile:true,
    share:'attack',range:200,mp:200,damage_multiplier:.7,damage_type:'physical'},
   '5shot':{class:['ranger'],wtype:['bow'],level:75,hostile:true,
    share:'attack',range:200,mp:320,damage_multiplier:.5,damage_type:'physical'},
   fanofknives:{class:['rogue'],level:65,hostile:true,share:'attack',
    range:160,mp:180,damage_multiplier:.85,damage_type:'physical',
    slot:[['belt','knifebelt']]},
   cleave:{class:['warrior'],level:52,hostile:true,range:160,mp:720,damage_type:'physical'}
  }};
 const cfg={general:{testLogging:true},
  farming:{maxAggro:12,pvp:false},party:{enabled:true,aoe:true,
   aoeMaxTargets:5,healing:false,buffs:false,energize:false,advancedSkills:false},
  skills:custom3shot?[{name:'User 3shot',enabled:true,skill:'3shot',
    class:'ranger',character:'F1',target:'enemy',priority:10,
    conditions:[],minMp:0,maxTargets:15,minTargets:2,everyMs:600}]:[]};
 const bot={me:{role:'farmer',name:'F1'},farmers:['F1'],leader:'F1',
  p:{c,G:game,parent:{is_pvp:false},call(name,...args){
   if(name==='is_on_cooldown')return cooldowns.includes(args[0]);
   if(name==='can_attack')return true;
   if(name==='use_skill'){calls.push({id:args[0],targets:args[1]});return {success:true};}
   return null;
  }},cfg,teamNames:['F1'],monsters:()=>mobs,
  entity:id=>mobs.find(m=>m.id===id),allowed:()=>true,
  strategy:{safeTarget:()=>true},teamPlan:{target:()=> 'bee',
   wantsCombat:()=>true,roles:()=>({})},
  encounter:{status:()=>({phase:'BUILD',capacity:5})},
  allies:()=>[],measure:()=>({}),event:(type,details)=>events.push({type,details}),
  exec:{run:(_name,_locks,guard,fn)=>{if(!guard())return false;fn();return true;}}};
 return {bot,c,mobs,calls,events,skills:createSkills(bot)};
}

test('four full-health targets prefer 3shot over 5shot even though 5shot has a higher MP cost',()=>{
 const f=fixture();f.skills.rotation(f.mobs[0]);
 assert.deepEqual(f.calls.map(x=>x.id),['3shot']);
 assert.equal(f.calls[0].targets.length,3);
});

test('five full-health targets prefer 5shot by damage, without dividing by MP',()=>{
 const f=fixture('ranger',[1000,1000,1000,1000,1000]);
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls[0]?.id,'5shot');
 assert.equal(f.calls[0].targets.length,5);
});

test('remaining HP prevents scoring wasted overkill as useful AoE damage',()=>{
 const f=fixture('ranger',[1,1,1,1000]);
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls[0]?.id,'5shot');
});

test('lack of mana for 5shot is still a legality check, not an efficiency penalty',()=>{
 const f=fixture('ranger',[1000,1000,1000,1000,1000],{mp:240});
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls[0]?.id,'3shot');
});

test('existing explicit 3shot rule stays authoritative instead of silently being bypassed',()=>{
 const f=fixture('ranger',[1000,1000,1000,1000],{custom3shot:true});
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls[0]?.id,'3shot');
});

test('rogue does not exchange one ordinary attack for a weaker one-target fanofknives',()=>{
 const f=fixture('rogue',[1000]);
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls.some(x=>x.id==='fanofknives'),false);
});

test('rogue prefers fanofknives for two verified party-engaged enemies',()=>{
 const f=fixture('rogue',[1000,1000]);
 f.skills.rotation(f.mobs[0]);
 assert.equal(f.calls[0]?.id,'fanofknives');
 assert.equal(f.calls[0]?.targets,null);
});

test('a damage estimate never rewards MP cost, but rejects unknown target HP',()=>{
 const f=fixture();
 const a=aoeDamageScore(f.c,f.bot.p.G.skills['3shot'],f.mobs.slice(0,3),f.mobs[0]);
 assert.equal(a?.effectiveDamage,210);
 assert.equal(a?.normalDamage,100);
 const muchMoreExpensive={...f.bot.p.G.skills['3shot'],mp:1999};
 assert.deepEqual(aoeDamageScore(f.c,muchMoreExpensive,f.mobs.slice(0,3),f.mobs[0]),a);
 assert.equal(aoeDamageScore(f.c,muchMoreExpensive,[{...f.mobs[0],hp:undefined}],f.mobs[0]),null);
});
