import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkills,highestDpsFarmer} from '../src/combat/skills.mjs';
function ally(name,{attack=120,frequency=1,mp=100,max_mp=1000,hp=1000,x=40,map='main',rip=false}={}){
 return {name,type:'character',ctype:'ranger',attack,frequency,mp,max_mp,
 hp,max_hp:1000,rip,map,in:map,x,y:0};
}
function mageFixture(allies){
 const calls=[],mage={name:'Mage',ctype:'mage',level:80,
  map:'main',in:'main',x:0,y:0,hp:1000,max_hp:1000,
  mp:1000,max_mp:1000,range:120,slots:{},s:{}};
 const G={items:{},skills:{energize:{class:['mage'],range:250,mp:0,target:'player'}}};
 const bot={me:{name:'Mage',role:'farmer'},farmers:allies.map(a=>a.name),
  teamNames:['Mage',...allies.map(a=>a.name)],p:{c:mage,G,
   call:(name,id,target,extra)=>{
    if(name==='is_on_cooldown')return false;
    if(name==='use_skill'){calls.push({id,target,extra});return Promise.resolve({success:true});}
    return null;
   }},
  cfg:{party:{enabled:true,energize:true,buffs:false,aoeMaxTargets:5},
   skills:[],farming:{pvp:false,maxAggro:5},general:{}},
  allies:()=>allies,monsters:()=>[],canConsumeImplicit:()=>true,
  count:()=>0,entity:id=>allies.find(a=>a.id===id),event:()=>{}};
 bot.exec={run:(kind,resources,guard,fn)=>{if(!guard())return false;fn();return true;}};
 return {bot,calls,skills:createSkills(bot)};
}
test('a full-mana top DPS farmer does not suppress energize for the next eligible farmer',()=>{
 const full=ally('Top',{attack:200,mp:1000}),low=ally('Second',{attack:120,mp:500});
 const f=mageFixture([full,low]);f.skills.rotation(null);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].id,'energize');
 assert.equal(f.calls[0].target.name,'Second');
 assert.equal(f.calls[0].extra,200);
});
test('equal DPS prefers current transferrable mana deficit, not alphabetic name',()=>{
 const a=ally('Alpha',{attack:120,mp:950}),z=ally('Zeta',{attack:120,mp:700});
 const f=mageFixture([a,z]);assert.equal(highestDpsFarmer(f.bot,[a,z]).name,'Zeta');
 f.skills.rotation(null);
 assert.equal(f.calls[0]?.target.name,'Zeta');
});
test('same-DPS mana tie has deterministic name ordering',()=>{
 const a=ally('Alpha',{mp:700}),b=ally('Beta',{mp:700});
 const f=mageFixture([b,a]);assert.equal(highestDpsFarmer(f.bot,[b,a]).name,'Alpha');
});
test('unreachable, off-map, unselected or dead top DPS never steals energize priority',()=>{
 const far=ally('Far',{attack:500,x:400}),offmap=ally('Off',{attack:450,map:'bank'}),
  dead=ally('Dead',{attack:400,hp:0}),valid=ally('Valid',{attack:100,mp:650,x:70});
 const f=mageFixture([far,offmap,dead,valid]);
 f.skills.rotation(null);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].target.name,'Valid');
});
test('at full MP every ally is ineligible; no unnecessary cast is scheduled',()=>{
 const f=mageFixture([ally('A',{mp:1000}),ally('B',{mp:999})]);
 f.skills.rotation(null);assert.deepEqual(f.calls,[]);
});
test('unselected high DPS is ignored by the central priority helper',()=>{
 const f=mageFixture([ally('Selected',{attack:100}),ally('Unknown',{attack:1000})]);
 f.bot.farmers=['Selected'];
 assert.equal(highestDpsFarmer(f.bot,f.bot.allies()).name,'Selected');
});
