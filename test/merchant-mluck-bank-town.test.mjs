import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant} from '../src/merchant/controller.mjs';
import {createMovement} from '../src/core/movement.mjs';

test('mluck executes immediately at arrival before pickup planning can redirect to bank',()=>{
 let casts=0,travelled=false;
 const target={name:'Farmer',id:'Farmer',map:'main',in:'main',x:50,y:0,rip:false,s:{}};
 const c={name:'Merchant',map:'main',in:'main',x:0,y:0,level:80,mp:400,items:[],slots:{},rip:false};
 const bot={
  me:{name:'Merchant',role:'merchant'},running:true,
  p:{c,G:{items:{},skills:{mluck:{mp:20,level:1,range:320}}},
   realm:()=> 'EUII',entities:{Farmer:target},
   call:(name,...args)=>name==='is_on_cooldown'?false:
    name==='use_skill'?(casts++,assert.equal(args[0],'mluck'),true):null},
  cfg:{merchant:{mluck:true,enabled:true,taskHoldMs:30000,starvationMs:120000},
   party:{merchant:'Merchant'}},
  transport:{fresh:()=>({...target,running:true,realm:'EUII'})},
  farmers:['Farmer'],entity:()=>target,allies:()=>[target],free:()=>10,
  event:()=>{},monsters:()=>[],reason:'',recovering:false,
  bank:{pending:false},
  movement:{order:null},
  logistics:{reserved:false,travel(){travelled=true;
    assert.equal(casts,1,'buff must be cast before depot trip is scheduled');
    bot.movement.order={owner:'economy'};}},
  exec:{busy:()=>false,run:(kind,resources,guard,action)=>{
    if(kind!=='mluck'||!guard())return false;action();return true;}},
  gold:{reserved:false}
 };
 createMerchant(bot).tick();
 assert.equal(casts,1);
 assert.equal(travelled,true);
});

test('merchant uses town teleport to reach distant bank portal instead of walking main-to-bank',()=>{
 const attempts=[],events=[];
 const c={name:'Merchant',map:'main',in:'main',x:1800,y:0,
   speed:40,items:[],slots:{},rip:false,c:{}};
 const bot={running:true,me:{name:'Merchant',role:'merchant'},cfg:{
  world:{excludedMaps:[]},farming:{pvp:false},
  merchant:{townTravel:true,townMinSavingsMs:3000}},
 p:{c,G:{maps:{main:{spawns:[[0,0]]},bank:{}}},has:id=>id==='town',
   call:()=>false,root:{},parent:{}},
 exec:{pending:new Map(),busy:()=>false,run:(kind)=>{attempts.push(kind);return true;}},
 monsters:()=>[],event:(kind,data)=>events.push({kind,data}),reason:''};
 const movement=createMovement(bot);
 movement.go({map:'bank',in:'bank',x:0,y:-100,radius:90},'economy');
 assert.deepEqual(attempts,['travel.town']);
 assert.equal(events.find(e=>e.kind==='travel.compare')?.data.savedMs>3000,true);
});
