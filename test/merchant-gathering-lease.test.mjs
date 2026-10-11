import test from 'node:test';
import assert from 'node:assert/strict';
import {createServices} from '../src/merchant/services.mjs';

function fixture({item='pickaxe',free=8}={}){
 const data=new Map(),calls=[],polygon=[[-10,-10],[10,-10],[10,10],[-10,10]],c={
  name:'Merchant',map:'main',in:'main',x:150,y:100,level:50,mp:1000,
  slots:{mainhand:{name:'staff',level:0},offhand:{name:'shield',level:0}},
  items:[{name:item,level:0},...Array(42-free-1).fill({name:'hpot0',q:1}),...Array(free).fill(null)]};
 const bot={running:true,cfg:{merchant:{mining:true,fishing:true,merrit:false,massBuffs:false,minFreeSlots:4,serviceSliceMs:30000},
  general:{economyTickMs:2000},world:{excludedMaps:[]}},
  p:{c,G:{maps:{main:{zones:[{type:'mining',polygon},{type:'fishing',polygon}]}},skills:{mining:{level:16,mp:120},fishing:{level:16,mp:120}}},read:k=>data.get(k),write:(k,v)=>{data.set(k,v);return true;},
   call:name=>name==='is_on_cooldown'?false:null,has:()=>false},me:{name:'Merchant'},exec:{},
  economy:{safe:i=>!!i,note:s=>calls.push(['note',s]),travel:(zone,type)=>{calls.push(['travel',type]);return false;}},
  movement:{order:null,failedRecently:()=>false,stop(){calls.push(['stop']);}},
  monsters:()=>[],strategy:{status:()=>({manual:null})}};
 return {bot,c,calls};
}
test('gathering route survives the 30-second work slice while still approaching',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{
  const {bot,calls}=fixture();const s=createServices(bot);
  assert.equal(s.tick(),true);
  assert.ok(s.approaching);
  now+=31000;
  assert.equal(s.tick(),true);
  assert.ok(s.approaching,'do not reset tool lease during travel');
  assert.equal(calls.some(c=>c[0]==='stop'),false);
  assert.equal(new Set(calls.filter(c=>c[0]==='travel').map(c=>c[1])).size,1,'stick to one gathering activity');
 }finally{Date.now=old;}
});
test('merchant without an eligible market listing does not travel to Merrit',()=>{
 const {bot,calls}=fixture();bot.cfg.merchant.mining=false;bot.cfg.merchant.fishing=false;bot.cfg.merchant.merrit=true;
 bot.cfg.merchant.stand=true;bot.p.G.npcs={citizen22:{market:{areas:[[0,0,100,100]]}}};
 bot.p.c.slots={mainhand:{name:'staff'}};
 bot.p.entities={};bot.count=()=>0;
 const s=createServices(bot);
 assert.equal(s.tick(),false);
 assert.equal(calls.some(c=>c[0]==='travel'),false);
 assert.ok(calls.some(c=>c[0]==='note'&&c[1].includes('Merrit ausgesetzt')));
});
