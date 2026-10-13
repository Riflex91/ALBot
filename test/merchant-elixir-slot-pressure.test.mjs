import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actionCapacity,gearChainReady,gearInputReady} from '../src/production/production.mjs';
import {purchaseFits} from '../src/merchant/economy.mjs';
import {wholeBankRule} from '../src/merchant/controller.mjs';
import {createSkills} from '../src/combat/skills.mjs';

test('partial exchange of 10 seashells out of 344 works with exactly 4 physical slots',()=>{
 const inventory=Array.from({length:42},(_,n)=>n<38?
  {name:n===0?'seashell':'protected',level:0,q:n===0?344:1}:null);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:10}]),true);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:344}]),true);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:345}]),false);
 // Full inventory with a partial input still cannot receive an output.
 for(let slot=38;slot<42;slot++)inventory[slot]={name:'protected'};
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:10}]),false);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:344}]),true);
});
test('mutation/recipe output may merge only with compatible real stack',()=>{
 const inventory=[{name:'scroll0',level:0,q:8},{name:'material',level:0,q:50}];
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:1}],{name:'scroll0',level:0},
  {items:{scroll0:{s:100}}}),true);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:1}],{name:'different',level:0},
  {items:{different:{s:100}}}),false);
 assert.equal(actionCapacity(inventory,[{slot:0,quantity:8}],{name:'different',level:0},
  {items:{different:{s:100}}}),true);
});
test('scroll NPC buy fits at reserve but cannot overflow true inventory capacity',()=>{
 const inventory=Array(42).fill(null).map((_,n)=>n<38?{name:'other'}:null);
 assert.equal(purchaseFits(inventory,{name:'cscroll0',level:0},1,{s:9999}),true);
 assert.equal(purchaseFits(inventory,{name:'cscroll0',level:0},5,{s:9999}),true);
 assert.equal(purchaseFits(inventory,{name:'a',level:0},5,{}),false);
 for(let n=38;n<42;n++)inventory[n]={name:'other'};
 assert.equal(purchaseFits(inventory,{name:'cscroll0',level:0},1,{s:9999}),false);
 inventory[2]={name:'cscroll0',level:0,q:100};
 assert.equal(purchaseFits(inventory,{name:'cscroll0',level:0},1,{s:9999}),true);
});
test('unreserved automated bank materials can be deposited as whole stacks',()=>{
 const material={name:'beewings',level:0,q:313};
 const rule={action:'bank',_autoDisposition:true,batch:100,keep:10,teamReserve:0};
 const optimized=wholeBankRule(material,rule,{reserved:0,explicit:false});
 assert.equal(optimized.batch,313);assert.equal(optimized.keep,0);
 assert.deepEqual(wholeBankRule(material,rule,{reserved:200,explicit:false}),rule);
 assert.deepEqual(wholeBankRule(material,rule,{reserved:0,explicit:true}),rule);
 assert.deepEqual(wholeBankRule(material,{...rule,_autoDisposition:false},
  {reserved:0,explicit:false}),{...rule,_autoDisposition:false});
});
test('multi-level compound gear receives planning credit for available level-zero materials',()=>{
 const target={item:'ringsj',level:2,gearSlot:'ring1'};
 const stock=[{name:'ringsj',level:0,q:9}];
 assert.equal(gearInputReady(target,stock,{compound:true}),false);
 assert.equal(gearChainReady(target,stock,{compound:true}),true);
 assert.equal(gearChainReady(target,[{name:'ringsj',level:0,q:2}],{compound:true}),false);
});
test('personalized 3shot rule is set to 15 without claiming the skill fires 15 projectiles',()=>{
 const js=readFileSync(new URL('../bot.js',import.meta.url),'utf8');
 const prefix=js.slice(0,js.indexOf('/* ALBot '));
 const json=prefix.slice(prefix.indexOf('globalThis.ALBotConfig=')+'globalThis.ALBotConfig='.length).trim().replace(/;$/,'');
 const config=JSON.parse(json);
 const rules=config.skills.filter(r=>r.skill==='3shot'&&r.class==='ranger');
 assert.ok(rules.length>0);
 assert.equal(rules[0].maxTargets,15);
});
test('Mage energize at 2% missing mana and not at less than 2%',()=>{
 const make=mp=>{
  const calls=[];
  const friend={name:'Ranger1',id:'r1',ctype:'ranger',type:'character',hp:1000,
   max_hp:1000,attack:400,frequency:1.5,map:'main',in:'main',x:10,y:0,mp,max_mp:1000};
  const c={name:'Mage',ctype:'mage',type:'character',hp:2000,max_hp:2000,
   mp:1400,max_mp:1600,level:70,attack:200,map:'main',in:'main',x:0,y:0,slots:{mainhand:{name:'staff'}}};
  const G={items:{staff:{wtype:'staff'}},maps:{main:{}},
   skills:{energize:{class:['mage'],target:'player',mp:30,range:320}}};
  const bot={me:{name:'Mage',role:'farmer'},p:{c,G,parent:{is_pvp:false},
    call:(fn,...args)=>{if(fn==='is_on_cooldown')return false;if(fn==='use_skill'){calls.push(args);return true;}}},
   cfg:{general:{},party:{enabled:true,energize:true,buffs:false,aoe:false},
    farming:{pvp:false},skills:[]},farmers:['Mage','Ranger1'],
   teamPlan:{roles:()=>({energize:'Mage'})},allies:()=>[friend],
   exec:{run:(_k,_r,g,fn)=>{if(!g())return false;fn();return true;}},event:()=>{}};
  createSkills(bot).rotation(null);return calls;
 };
 assert.equal(make(981).length,0);
 assert.equal(make(980).length,1);
 assert.equal(make(980)[0][0],'energize');
});
