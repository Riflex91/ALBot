import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrategy} from '../src/world/strategy.mjs';
import {createGear} from '../src/production/gear.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {INTEGRATION_DESCRIPTOR} from '../src/config/live-c.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
test('event grace really holds runtime travel and neutral authorization, then resumes on observation',()=>{
 const cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema),moves=[];
 cfg.party.enabled=false;cfg.world.bosses=true;cfg.world.allowedBosses=['phoenix'];
 const character={name:'A',ctype:'ranger',map:'main',in:'main',x:0,y:0,
  hp:10000,max_hp:10000,mp:1000,max_mp:1000,attack:1000,frequency:5,armor:100,resistance:100};
 const state={phoenix:{live:true,type:'phoenix',map:'main',x:500,y:0}};
 const bot={cfg,me:{name:'A',role:'farmer',farmTargets:[]},leader:'A',farmers:['A'],teamNames:['A'],
  running:true,p:{c:character,root:{S:state},parent:{},
   G:{maps:{main:{}},events:{},skills:{},monsters:{phoenix:{hp:100,attack:1,frequency:1}}},
   realm:()=>'EUII',read:()=>null,write:()=>true},
  movement:{stop(){},go:dest=>moves.push(dest)},monsters:()=>[],allies:()=>[character],
  logistics:{reserved:false},transport:{fresh:()=>null},event:()=>{}};
 const strategy=createStrategy(bot);
 assert.equal(strategy.requestTask('boss:phoenix'),true);strategy.plan();strategy.travel();
 assert.equal(moves.length,1);
 delete state.phoenix;strategy.plan();
 assert.equal(strategy.heartbeat().observationUnknown,true);
 assert.equal(strategy.safeTarget('phoenix',{target:null}),false);
 assert.equal(strategy.travel(),true);assert.equal(moves.length,1);
 state.phoenix={live:true,type:'phoenix',map:'main',x:500,y:0};
 strategy.plan();strategy.travel();assert.equal(moves.length,2);
});
test('optimized automatic gear receives observed catchup priority while explicit goal priority stays exact',()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);
 cfg.production.gear=true;cfg.production.autoGear=false;
 cfg.characters=['A','B'].map(name=>({...defaultsFor(FULL_DESCRIPTOR.schema.properties.characters.items),
  enabled:true,name,role:'farmer',class:'ranger'}));
 cfg.production.gearTargets=[{enabled:true,name:'manual',character:'A',slot:'helmet',item:'helmet',level:7,budget:100000,priority:50}];
 const names=['mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
 const profile=level=>({class:'ranger',complete:true,level:80,at:Date.now(),
  slots:Object.fromEntries(names.map(slot=>[slot,slot==='mainhand'?{name:'bow',level}:null]))});
 const profiles={A:profile(1),B:profile(5)};
 const bot={cfg,me:{name:'M',role:'merchant'},teamNames:['M','A','B'],farmers:['A','B'],
  p:{c:{name:'M',ctype:'merchant',level:80,slots:{},items:[]},read:()=>profiles,write:()=>true,
   realm:()=>'EUI',G:{items:{bow:{type:'weapon',wtype:'bow',upgrade:true},helmet:{type:'helmet',upgrade:true}},
    classes:{ranger:{mainhand:{bow:1},doublehand:{}}}},
   call:(name,item)=>name==='item_properties'?{attack:10+(item.level??0)*20,armor:10+(item.level??0)*20}:null},
  economy:{safe:()=>true,explicit:()=>null},
  transport:{fresh:()=>null},
  intelligence:{targets:()=>['A','B'].map(character=>({enabled:true,name:'auto '+character,character,
   slot:'mainhand',item:'bow',level:6,budget:100000,priority:10}))}};
 const goals=createGear(bot).goals();
 const a=goals.find(g=>g.character==='A'&&g.slot==='mainhand'),
  b=goals.find(g=>g.character==='B');
 assert.ok(a.priority>b.priority);
 assert.equal(goals.find(g=>g.name==='Gear: manual').priority,50);
});
