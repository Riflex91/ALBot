import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrategy} from '../src/world/strategy.mjs';

test('manual farm task suppresses opportunistic quest and anniversary travel',()=>{
 let travels=0,anniversaryCalls=0;
 const c={name:'A',map:'main',in:'main',hp:100,max_hp:100,mp:100,max_mp:100,gold:0,items:[],s:{}};
 const p={c,root:{S:{anniversary:{active:true,live:true,expires:Date.now()+60000,available:true,map:'main',x:10,y:10}}},parent:{},G:{maps:{main:{}},monsters:{bee:{attack:1,hp:10}},drops:{monsters:{}},events:{}},entities:{},realm:()=> 'EUII',has:()=>true,call:(name)=>{if(name==='anniversary_can_visit')return true;if(name==='anniversary_kiss'){anniversaryCalls++;return true;}return false;}};
 const cfg={farming:{targets:['goo','bee'],mode:'balanced',pvp:false},party:{enabled:false},merchant:{},production:{maxFarmHours:12},world:{excludedMaps:[],risk:'conservative',bosses:false,events:false,quests:true,anniversary:true,allowedBosses:[],allowedEvents:[],cacheTtlMs:60000,learning:false,learningWeight:0}};
 const bot={p,cfg,me:{name:'A',role:'farmer',farmTargets:[]},running:true,journal:null,logistics:{reserved:false},movement:{stop(){},go(){travels++;return true;}},production:null,target:null,allies:()=>[],monsters:()=>[],entity:()=>null,count:()=>0,event(){}};
 bot.economy={destination:()=>({map:'main',in:'main',x:126,y:-413}),travel(){travels++;return false;},perform(){throw Error('must not perform while manual task is active');}};
 const strategy=createStrategy(bot);bot.strategy=strategy;
 assert.equal(strategy.requestTask('farm:bee',63000),true);
 assert.equal(strategy.quest(),false);
 assert.equal(strategy.anniversary(),false);
 assert.equal(travels,0);
 assert.equal(anniversaryCalls,0);
 assert.equal(strategy.status().manual.id,'bee');
});
