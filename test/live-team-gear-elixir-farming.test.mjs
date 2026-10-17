import test from 'node:test';
import assert from 'node:assert/strict';
import {neutralPullReadiness} from '../src/combat/team-readiness.mjs';
import {effectiveFarmAggro} from '../src/world/strategy.mjs';
import {balancedFarmUtility} from '../src/world/team-plan.mjs';
import {chooseElixir,chooseStockedElixir} from '../src/items/elixirs.mjs';

const group=()=>({
 me:{name:'R1'},leader:'R1',farmers:['R1','R2','Priest'],
 p:{c:{name:'R1',x:100,y:100,map:'main',in:'main'},realm:()=> 'USV'},
 cfg:{party:{enabled:true,waitForTeam:true,followDistance:180,aoeMaxTargets:5},
  farming:{pullHp:.8}},
 transport:{fresh:name=>({
  name,x:name==='R2'?190:205,y:100,map:'main',in:'main',
  realm:'USV',running:true,rip:false,hp:900,max_hp:1000,mp:500,
  max_mp:1000,reserved:false,journal:false,inventoryBlocked:false
 })}
});
test('group neutral pull waits for every healthy farmer inside staging radius',()=>{
 const bot=group();
 assert.equal(neutralPullReadiness(bot).ready,true);
 bot.transport.fresh=name=>({...group().transport.fresh(name),x:name==='Priest'?340:190});
 assert.deepEqual(neutralPullReadiness(bot).reason,'peer-not-assembled');
 bot.transport.fresh=name=>({...group().transport.fresh(name),hp:name==='Priest'?600:900});
 assert.equal(neutralPullReadiness(bot).reason,'peer-recovering');
 bot.transport.fresh=name=>({...group().transport.fresh(name),journal:name==='Priest'});
 assert.equal(neutralPullReadiness(bot).reason,'peer-not-ready');
 bot.cfg.party.waitForTeam=false;
 assert.equal(neutralPullReadiness(bot).ready,true);
});
test('follower is never admitted to initiate a neutral pull',()=>{
 const bot=group();bot.me.name='R2';
 assert.equal(neutralPullReadiness(bot).ready,false);
});
test('farm risk budgets verified AoE and existing aggro, never hypothetical 12 by default',()=>{
 assert.equal(effectiveFarmAggro(12,5,0),5);
 assert.equal(effectiveFarmAggro(12,1,0),3);
 assert.equal(effectiveFarmAggro(12,5,8),8);
 assert.equal(effectiveFarmAggro(12,5,14),14);
 assert.equal(effectiveFarmAggro(2,5,0),2);
 assert.equal(effectiveFarmAggro(12,5,-1),12);
});
test('balanced scoring rewards materially better XP without ignoring gold',()=>{
 const goo=balancedFarmUtility(360000,74880);
 const crab=balancedFarmUtility(616066,38443);
 assert.ok(crab>goo);
 assert.ok(goo>0);
 assert.equal(balancedFarmUtility(NaN,100),0);
 assert.ok(balancedFarmUtility(100,500)>balancedFarmUtility(100,100));
});
test('verified physically stocked elixir replaces inaccessible wishlist, per class',()=>{
 const G={items:{
  candypop:{type:'elixir',int:50,duration:20,g:1},
  elixirint0:{type:'elixir',int:35,duration:20,g:100},
  elixirdex0:{type:'elixir',dex:32,duration:20,g:100},
  potion:{type:'pot',int:99,duration:20,g:1}
 }};
 assert.equal(chooseElixir(G,'priest').name,'candypop');
 assert.equal(chooseStockedElixir(G,'priest',[
  {name:'elixirint0',level:0},{name:'elixirdex0',level:0}]).name,'elixirint0');
 assert.equal(chooseStockedElixir(G,'ranger',[
  {name:'elixirint0',level:0},{name:'elixirdex0',level:0}]).name,'elixirdex0');
 assert.equal(chooseStockedElixir(G,'priest',[{name:'elixirdex0'}]),null);
 assert.equal(chooseStockedElixir(G,'priest',[{name:'potion'}]),null);
});
