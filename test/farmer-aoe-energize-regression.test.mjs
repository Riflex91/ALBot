import test from 'node:test';
import assert from 'node:assert/strict';
import {aoePermitted,highestDpsFarmer,createSkills} from '../src/combat/skills.mjs';
import {gearInputReady,unbankedDemand} from '../src/production/production.mjs';

function testBot(klass,skill,allies=[]){
 const calls=[];
 const me={role:'farmer',name:klass==='mage'?'Mage':'Ranger'};
 const c={name:me.name,ctype:klass,type:'character',map:'main',in:'main',x:0,y:0,
  hp:2000,max_hp:2000,mp:1500,max_mp:2000,level:70,attack:330,range:250,
  frequency:1,slots:{mainhand:{name:klass==='mage'?'staff':'bow'}}};
 const game={items:{staff:{wtype:'staff'},bow:{wtype:'bow'}},
  maps:{main:{}},skills:{
   energize:{mp:30,range:320,class:['mage'],target:'player'},
   '3shot':{mp:25,range:250,class:['ranger'],wtype:['bow'],hostile:true}
  },monsters:{}};
 const p={c,G:game,parent:{is_pvp:false},call:(fn,...args)=>{
  if(fn==='is_on_cooldown')return false;
  if(fn==='use_skill'){calls.push(args);return {success:true};}
  return null;
 }};
 const cfg={party:{enabled:true,aoe:false,aoeMaxTargets:5,energize:false,
  buffs:false,healing:false,revive:false,advancedSkills:false},
  farming:{pvp:false,maxAggro:5},general:{},skills:[]};
 const bot={me,p,cfg,exec:{run:(_id,_resources,guard,call)=>{
   if(!guard())return false;call();return true;}},
  farmers:['Ranger1','Ranger2','Mage'],teamNames:['Ranger','Ranger1','Ranger2','Mage'],
  allies:()=>allies,monsters:()=>[],teamPlan:{roles:()=>({energize:'Mage'}),target:()=>null},
  entity:id=>allies.find(a=>a.id===id)||bot.monsters().find(m=>m.id===id),
  allowed:()=>true,event:()=>{}};
 return {bot,c,calls};
}
test('every farmer is permitted to use AoE despite a saved global false flag',()=>{
 const f=testBot('ranger');
 assert.equal(aoePermitted(f.bot),true);
 f.bot.me.role='merchant';assert.equal(aoePermitted(f.bot),false);
});
test('safe ranger 3shot uses multiple engaged targets with disabled party.aoe',()=>{
 const f=testBot('ranger'),t1={id:'s1',type:'monster',name:'snake',mtype:'snake',map:'main',x:30,y:0,target:'Ranger1',hp:500},
 t2={id:'s2',type:'monster',name:'snake',mtype:'snake',map:'main',x:45,y:0,target:'Ranger2',hp:500},
 t3={id:'s3',type:'monster',name:'snake',mtype:'snake',map:'main',x:50,y:0,target:'Ranger1',hp:500};
 f.bot.monsters=()=>[t1,t2,t3];
 f.bot.encounter={status:()=>({phase:'BUILD',capacity:3})};
 assert.equal(createSkills(f.bot).use('3shot',t1,0,600),true);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0][0],'3shot');
 assert.equal(f.calls[0][1].length,3);
});
test('Mage energize prioritizes maximum observed DPS rather than lowest mana ratio',()=>{
 const allies=[
  {name:'Ranger1',id:'r1',ctype:'ranger',type:'character',map:'main',x:10,y:0,
   hp:900,max_hp:1000,attack:300,frequency:2,mp:650,max_mp:1200},
  {name:'Ranger2',id:'r2',ctype:'ranger',type:'character',map:'main',x:15,y:0,
   hp:900,max_hp:1000,attack:400,frequency:1,mp:100,max_mp:1500}
 ];
 const f=testBot('mage','energize',allies);
 assert.equal(highestDpsFarmer(f.bot,allies).name,'Ranger1');
 const skills=createSkills(f.bot);
 skills.rotation(null);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0][0],'energize');
 assert.equal(f.calls[0][1].name,'Ranger1');
 assert.ok(f.calls[0][2]>0);
 // Do not retry in a hot loop without cooldown; continual support is bounded.
 skills.rotation(null);assert.equal(f.calls.length,1);
});
test('ready mutation inputs can promote Gear goals without manufacturing materials',()=>{
 const goal={item:'ringsj',level:1,gearSlot:'ring1'};
 assert.equal(gearInputReady(goal,Array.from({length:3},()=>({name:'ringsj',level:0})),{compound:true}),true);
 assert.equal(gearInputReady(goal,Array.from({length:2},()=>({name:'ringsj',level:0})),{compound:true}),false);
 assert.equal(gearInputReady({...goal,gearSlot:undefined},
   [{name:'ringsj',level:0,q:9}],{compound:true}),false);
 assert.equal(gearInputReady({...goal,item:'staff'},
   [{name:'staff',level:0}],{upgrade:true}),true);
 assert.equal(gearInputReady(goal,[{name:'ringsj',level:0,q:3,l:true}],{compound:true}),false);
});

test('verified bank reserves unblock only production consumption, not gross sale reserves',()=>{
 const otherGoals=[{item:'ringsj',level:0,quantity:9,variant:null}];
 const carried=[{name:'ringsj',level:0,q:7}];
 const bank=[{name:'ringsj',level:0,q:6}];
 assert.equal(unbankedDemand(otherGoals,[], 'ringsj',0),9);
 assert.equal(unbankedDemand(otherGoals,bank, 'ringsj',0),3);
 assert.equal(unbankedDemand(otherGoals,[{name:'ringsj',level:0,q:12}], 'ringsj',0),0);
 // The kept carried inventory is still separately checked against this
 // net requirement, and the gross demand is untouched for sale decisions.
 assert.equal(carried[0].q-3>=unbankedDemand(otherGoals,bank,'ringsj',0),true);
 assert.equal(otherGoals[0].quantity,9);
});
test('bank reservation offsets never count a mismatched exact item variant twice',()=>{
 const rows=[
  {item:'hpamulet',level:0,quantity:3,variant:{stat_type:'str'}},
  {item:'hpamulet',level:0,quantity:3,variant:null}
 ];
 const bank=[
  {name:'hpamulet',level:0,stat_type:'int',q:4},
  {name:'hpamulet',level:0,stat_type:'str',q:2}
 ];
 assert.equal(unbankedDemand(rows,bank,'hpamulet',0),1);
 assert.equal(unbankedDemand(rows,bank,'ringsj',0),0);
 assert.equal(unbankedDemand(rows,[{name:'hpamulet',level:0,stat_type:'int',q:6}],
   'hpamulet',0),3,'bank stock of wrong variant must not satisfy specific need');
});
