import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor,validateProfile,importProfile,envelope} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
import {createSkills} from '../src/combat/skills.mjs';

function profile(){
 const c=defaultsFor(FULL_DESCRIPTOR.schema);
 const character=defaultsFor(FULL_DESCRIPTOR.schema.properties.characters.items);
 c.characters=[{...character,name:'Ranger1',role:'farmer',enabled:true}];
 const skill=defaultsFor(FULL_DESCRIPTOR.schema.properties.skills.items);
 c.skills=[{...skill,name:'Drei Ziele falsch',enabled:true,skill:'3shot',
  class:'ranger',character:'Ranger1',minTargets:2,maxTargets:1}];
 return c;
}
test('full profile rejects impossible AoE minTargets 2 / maxTargets 1',()=>{
 const c=profile();
 const errors=validateProfile(FULL_DESCRIPTOR,c);
 assert.ok(errors.some(e=>e.includes('3shot')&&e.includes('Mindestzahl')&&e.includes('maximale Ziele')));
 assert.throws(()=>importProfile(FULL_DESCRIPTOR,envelope(FULL_DESCRIPTOR,c)),/Mindestzahl Ziele/);
});
test('AoE target bounds become valid when user explicitly fixes maximum',()=>{
 const c=profile();c.skills[0].maxTargets=3;
 assert.deepEqual(validateProfile(FULL_DESCRIPTOR,c),[]);
});
test('non-AoE abilities are not rejected for unused minTargets/maxTargets editor metadata',()=>{
 const c=profile();c.skills[0].skill='energize';c.skills[0].maxTargets=1;
 assert.deepEqual(validateProfile(FULL_DESCRIPTOR,c),[]);
});
test('disabled AoE rules are not treated as executable conflicts',()=>{
 const c=profile();c.skills[0].enabled=false;
 assert.deepEqual(validateProfile(FULL_DESCRIPTOR,c),[]);
});
test('existing invalid AoE profiles never dispatch and emit bounded actionable diagnostics',()=>{
 const c=profile(),events=[],calls=[];
 const bot={me:{name:'Ranger1',role:'farmer'},cfg:c,teamNames:['Ranger1'],
  farmers:['Ranger1'],p:{c:{name:'Ranger1',ctype:'ranger',level:80,mp:1500,max_mp:2000,
   map:'main',in:'main',x:0,y:0,range:300,slots:{}},
   G:{items:{},skills:{'3shot':{class:['ranger'],level:60,mp:200,range:250,share:'attack'}}},
   call:(method)=>{calls.push(method);return false;}},
  monsters:()=>[],event:(name,d)=>events.push({name,d}),exec:{run(){assert.fail('Unmögliche AoE-Regel darf nicht ausgeführt werden');}}};
 const s=createSkills(bot),target={id:'goo',type:'monster',mtype:'goo',hp:1200,
  map:'main',in:'main',x:10,y:0};
 assert.equal(s.use('3shot',target,0,600,1,true),false);
 assert.equal(s.use('3shot',target,0,600,1,true),false);
 assert.equal(events.filter(e=>e.name==='skill.invalidRule').length,1);
 assert.deepEqual(events[0].d.code,'INVALID_AOE_TARGET_RANGE');
 assert.equal(s.diagnostics()['3shot'].ruleBlocked,2);
 assert.equal(calls.includes('use_skill'),false);
});
