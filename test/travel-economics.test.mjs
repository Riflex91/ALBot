import test from 'node:test';
import assert from 'node:assert/strict';
import {hopPenaltyDecision} from '../src/party/travel-economics.mjs';
import {travelBlinkEligible,blinkLandingPoint} from '../src/combat/travel-blink.mjs';
import {boundedInterceptPoint} from '../src/combat/intercept.mjs';
test('optional hop accounts for online penalties without overriding manual or pressure escape',()=>{
 const base={character:{ctype:'ranger',level:80},from:'EUI',to:'USI',home:'EUI',automatic:true};
 assert.equal(hopPenaltyDecision(base).allowed,false);
 assert.equal(hopPenaltyDecision({...base,automatic:false}).allowed,true);
 assert.equal(hopPenaltyDecision({...base,pressureEscape:true}).allowed,true);
 assert.equal(hopPenaltyDecision({...base,from:'USI',to:'EUI'}).allowed,true);
 assert.equal(hopPenaltyDecision({...base,character:{ctype:'merchant',level:80}}).allowed,true);
});
test('intercept remains finite for equal speed, missing motion and arrived targets',()=>{
 const c={x:0,y:0,speed:40},t={x:100,y:0,speed:40,moving:true,going_x:500,going_y:0};
 const lead=boundedInterceptPoint(c,t);assert.deepEqual(lead,{x:148,y:0});
 assert.deepEqual(boundedInterceptPoint(c,{...t,going_x:100}),{x:100,y:0});
 assert.deepEqual(boundedInterceptPoint(c,{...t,speed:NaN}),{x:100,y:0});
 assert.equal(boundedInterceptPoint(c,{...t,x:NaN}),null);
});
test('blink never spends the combat MP reserve or shortcuts an unwalkable or hostile path',()=>{
 let walk=true,hostile=false;
 const bot={p:{c:{name:'A',ctype:'mage',map:'main',x:0,y:0,mp:4000,max_mp:4000,speed:40,s:{},c:{}},
  G:{maps:{main:{}},skills:{blink:{mp:1600}}},has:()=>true,
  call:name=>name==='can_move_to'?walk:false},
  cfg:{world:{travelBlink:true},party:{advancedSkills:true},farming:{pullMp:.5}},
  monsters:()=>hostile?[{target:'A',hp:1}]:[]};
 const d={map:'main',x:300,y:0};
 assert.equal(travelBlinkEligible(bot,d,'farm'),true);
 bot.p.c.mp=3500;assert.equal(travelBlinkEligible(bot,d,'farm'),false);
 bot.p.c.mp=4000;walk=false;assert.equal(travelBlinkEligible(bot,d,'farm'),false);
 walk=true;hostile=true;assert.equal(travelBlinkEligible(bot,d,'farm'),false);
 hostile=false;assert.equal(travelBlinkEligible(bot,d,'kite'),false);
 assert.equal(travelBlinkEligible(bot,{...d,map:'bank'},'farm'),false);
});

test('blink rounds like the server and rejects a rounded landing that the direct route did not authorize',()=>{
 assert.deepEqual(blinkLandingPoint({x:5,y:-5}),{x:10,y:-10});
 assert.deepEqual(blinkLandingPoint({x:304.9,y:-304.9}),{x:300,y:-300});
 const bot={p:{c:{name:'A',ctype:'mage',map:'main',x:0,y:0,mp:4000,max_mp:4000,speed:40,s:{},c:{}},
  G:{maps:{main:{}},skills:{blink:{mp:1600}}},has:()=>true,
  call:(name,x)=>name==='can_move_to'?x!==300:false},
  cfg:{world:{travelBlink:true},party:{advancedSkills:true},farming:{pullMp:.5}},monsters:()=>[]};
 assert.equal(travelBlinkEligible(bot,{map:'main',x:304,y:0},'farm'),false);
});
