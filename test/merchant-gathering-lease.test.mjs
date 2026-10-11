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

test('smart_move is attempted when no direct can_move_to path exists to a fishing zone',()=>{
 const {bot,calls}=fixture({item:'rod'});
 bot.cfg.merchant.mining=false;
 bot.p.has=name=>name==='can_move_to';
 bot.p.call=name=>name==='is_on_cooldown'?false:name==='can_move_to'?false:null;
 const services=createServices(bot);
 assert.equal(services.tick(),true,'distant legal gathering zone must reach pathfinder');
 assert.ok(calls.some(x=>x[0]==='travel'&&x[1]==='fishing'));
 assert.equal(calls.some(x=>x[0]==='note'&&x[1].includes('Kein erreichbarer fishing-Arbeitsplatz')),false);
});

test('fishing retries an alternate shoreline waypoint after one smart_move rejection',async()=>{
 const {chooseGatherWorksite}=await import('../src/merchant/services.mjs');
 const polygon=[[0,0],[100,0],[100,100],[0,100]];
 const points=[{x:-16,y:25},{x:-16,y:75},{x:50,y:-16}];
 const zones=[{map:'main',in:'main',kind:'fishing',polygon,points}];
 const merchant={map:'main',x:-800,y:0},failed=new Set();
 const options={failedRecently:point=>failed.has(point.x+','+point.y),canMoveTo:()=>false};
 const first=chooseGatherWorksite(zones,merchant,options);
 assert.deepEqual([first.x,first.y],[-16,25]);
 failed.add('-16,25');
 const second=chooseGatherWorksite(zones,merchant,options);
 assert.deepEqual([second.x,second.y],[-16,75]);
 failed.add('-16,75');failed.add('50,-16');
 assert.equal(chooseGatherWorksite(zones,merchant,options),null);
});
test('directly reachable gathering spot is preferred to a closer route requiring smart_move',async()=>{
 const {chooseGatherWorksite}=await import('../src/merchant/services.mjs');
 const polygon=[[0,0],[100,0],[100,100],[0,100]],points=[{x:-16,y:25},{x:-16,y:75}];
 const choice=chooseGatherWorksite([{map:'main',in:'main',kind:'fishing',polygon,points}],{map:'main',x:-100,y:25},
  {canMoveTo:(x,y)=>y===75});
 assert.equal(choice.y,75);
});
test('fishing does not initiate a route without a free inventory slot',()=>{
 const {bot,calls}=fixture({item:'rod',free:0});
 bot.cfg.merchant.mining=false;bot.free=()=>0;
 const service=createServices(bot);
 assert.equal(service.tick(),false);
 assert.ok(calls.some(x=>x[0]==='note'&&x[1].includes('freien Inventarplatz')));
 assert.equal(calls.some(x=>x[0]==='travel'),false);
});
