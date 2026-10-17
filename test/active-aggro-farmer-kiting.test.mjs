import test from 'node:test';
import assert from 'node:assert/strict';
import {createFarmer} from '../src/combat/farmer.mjs';
import {createCombatNavigation} from '../src/combat/navigation.mjs';

test('farmer scheduler initiates kite before returning on ordinary farm decisions',()=>{
 const monster={id:'arm-1',type:'monster',mtype:'armadillo',x:0,y:0,map:'main',in:'main',
  target:'Ranger',hp:500,range:22,speed:30};
 const c={name:'Ranger',ctype:'ranger',map:'main',in:'main',x:100,y:0,
  hp:3000,max_hp:3000,mp:1000,max_mp:1000,range:150,speed:65,
  rip:false,items:[],slots:{mainhand:{name:'bow'}}};
 const cfg={farming:{kiting:true,enabled:false,orbitRadius:220,orbit:true,
   hpBelow:.75,mpBelow:.5,restBelow:.4,resumeAbove:.85,potions:false,
   pullHp:.8,pullMp:.5},party:{enabled:true,healing:true},world:{}};
 const actions=[],events=[];
 const movement={order:null,stop(){this.order=null;},
  local(x,y,owner){actions.push(['move',owner,x,y]);this.order={owner};return true;}};
 const bot={p:{c,G:{monsters:{armadillo:{range:22,speed:30,aggro:0}}},realm:()=> 'EUII',
  call:(key)=>key==='can_move_to'?true:key==='is_on_cooldown'?true:false},
  me:{name:'Ranger',role:'farmer'},cfg,teamNames:['Ranger'],farmers:['Ranger'],
  monsters:()=>[monster],running:true,logistics:{handoffActive:false},
  gold:{reserved:false},journal:null,movement,skills:{rotation(){}},
  event:(type,data)=>events.push({type,data})};
 bot.navigation=createCombatNavigation(bot);
 createFarmer(bot).tick();
 assert.equal(actions.length,1);
 assert.equal(actions[0][1],'kite');
 assert.equal(movement.order.owner,'kite');
 assert.equal(events.some(e=>e.type==='combat.orbitStep'||e.type==='combat.spiralEscape'),true);
});
