import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamPlan} from '../src/world/team-plan.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

test('dangerous farm-area failure quarantines a spawn instead of instantly reselecting it',()=>{
 const events=[],G={monsters:{goo:{hp:30,attack:1,frequency:1,xp:20,respawn:1}},maps:{main:{monsters:[{type:'goo',boundaries:[['main',0,0,100,100]]}]}}};
 const bot={p:{c:{name:'Leader',map:'main',in:'main',x:0,y:0,attack:50,frequency:1,max_hp:500,hp:500,level:20,items:[],xp:0,gold:0},G,root:{S:{}},parent:{S:{}},read:()=>null,realm:()=> 'EUII',entities:{}},
   cfg:{general:{testLogging:true,messageTtlMs:10000},farming:{pvp:false,maxAggro:1,planHoldMs:300000,deathWindowMs:600000},world:{excludedMaps:[],cacheTtlMs:60000},party:{enabled:true}},
   me:{name:'Leader',role:'farmer',farmTargets:[]},leader:'Leader',farmers:['Leader'],transport:{fresh:()=>null},
   strategy:{safeTarget:()=>true,permittedMap:()=>true,busy:false},monsters:()=>[],event:(...x)=>events.push(x),
   decisionEpoch:1,movement:{order:null,stop(){}},gear:{snapshot:()=>({})},content:{approve:()=>true},progression:{bonus:()=>0}};
 const plan=createTeamPlan(bot);plan.tick();const first=plan.heartbeat();
 assert.ok(first?.key,'first viable area selected');
 plan.failed('Gefährliche Aggro');assert.ok(events.some(([type,d])=>type==='plan.quarantined'&&d.key===first.key));
 bot.decisionEpoch=2;plan.tick();
 assert.equal(plan.heartbeat(),null,'dangerous area must not be immediately reused');
});

test('roaming overpowered hostile causes preemptive retreat before aggro',()=>{
 const calls=[],monster={id:'greenjr-1',mtype:'greenjr',type:'monster',map:'main',in:'main',x:100,y:0,real_x:100,real_y:0,hp:10000,max_hp:10000,range:40,aggro:1};
 const c={name:'Farmer',map:'main',in:'main',x:0,y:0,range:100,speed:50,hp:900,max_hp:1000,mp:100,max_mp:100,items:[],slots:{},gold:0,ctype:'ranger',rip:false};
 const bot={p:{c,G:{monsters:{greenjr:{aggro:1,range:40,boss:true}}},call:(name)=>name==='can_move_to'?true:false},
   cfg:{farming:{enabled:true,deathWindowMs:600000,restBelow:.4,resumeAbove:.9,freeSlots:3,maxAggro:2,kiting:true,hpBelow:.7,mpBelow:.5},party:{enabled:false}},
   me:{name:'Farmer',role:'farmer'},reason:'',monsters:()=>[monster],strategy:{safeTarget:()=>false,failActivity:(...a)=>calls.push(['fail',...a])},
   movement:{order:null,stop:()=>calls.push(['stop']),local:(...a)=>calls.push(['local',...a])},
   navigation:{orbit:()=>false},skills:{rotation:()=>calls.push(['rotate'])},
   logistics:{handoffActive:false,reserved:false},bank:{pending:false},gold:{reserved:false},exec:{pending:new Map()},target:null,free:()=>20,
   account:{active:()=>true},event:()=>{},transport:{fresh:()=>null}};
 createFarmer(bot).tick();
 assert.ok(calls.some(x=>x[0]==='fail'));
 assert.ok(calls.some(x=>x[0]==='local'));
 assert.equal(bot.target,null);
 assert.match(bot.reason,/Gefahrenrückzug/);
});

test('audit G01 follower assists existing safe fight instead of opening another pull',()=>{
 const commands=[],mob={id:'bee-1',mtype:'bee',type:'monster',hp:100,max_hp:100,target:'Leader',map:'main',in:'main',x:50,y:0};
 const c={name:'Follower',ctype:'ranger',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,range:200,rip:false,items:[],slots:{}};
 const leader={name:'Leader',running:true,rip:false,realm:'EUII',map:'main',in:'main',x:150,y:0,target:mob.id};
 const bot={p:{c,G:{items:{},monsters:{bee:{}},maps:{main:{}}},parent:{is_pvp:false},call:(name)=>{if(name==='can_attack')return true;if(name==='is_on_cooldown')return true;if(name==='attack')commands.push('attack');if(name==='change_target')commands.push('target');return false;},realm:()=> 'EUII'},
 cfg:{farming:{enabled:true,loot:false,autoTravel:false,restBelow:.3,resumeAbove:.8,hpBelow:.5,mpBelow:.2,freeSlots:1,rangeBuffer:10,deathWindowMs:600000},party:{enabled:true,followDistance:100,waitForTeam:false,focusFire:false}},
 me:{name:'Follower',role:'farmer'},leader:'Leader',farmers:['Leader','Follower'],teamNames:['Leader','Follower'],
 monsters:()=>[mob],allowed:()=>true,entity:()=>mob,
 transport:{fresh:()=>leader},strategy:{safeTarget:()=>true,busy:false,travel:()=>false},
 logistics:{handoffActive:false,reserved:false},bank:{pending:false},gold:{reserved:false},free:()=>20,
 account:{active:()=>true},movement:{order:null,go:()=>commands.push('follow'),stop:()=>commands.push('stop')},
 skills:{rotation:t=>commands.push(t?'offense':'support-only')},exec:{run:(key,res,guard,invoke)=>guard()?!!(invoke(),true):false},reason:''};
 createFarmer(bot).tick();
 assert.ok(commands.includes('offense'));assert.ok(commands.includes('attack'));
 assert.equal(commands.includes('follow'),false);
});
