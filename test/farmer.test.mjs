import test from 'node:test';
import assert from 'node:assert/strict';
import {createFarmer} from '../src/combat/farmer.mjs';

test('explicit farm task bypasses normal follower leash so rule-directed Bee combat can start',()=>{
 let manual=null,attacks=0,follows=0;
 const c={name:'A',ctype:'ranger',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,range:120,items:[],target:null,rip:false};
 const bee={id:'bee-1',type:'monster',mtype:'bee',hp:100,map:'main',in:'main',x:100,y:0,target:null};
 const leader={name:'B',running:true,realm:'EUII',map:'main',in:'main',x:1000,y:0,target:null,rip:false};
 const cfg={farming:{enabled:true,loot:false,freeSlots:3,hpBelow:.75,mpBelow:.5,restBelow:.4,resumeAbove:.85,potions:false,respawn:true,respawnDelayMs:15000,maxDeaths:3,deathWindowMs:600000,kiting:true,rangeBuffer:15,maxAggro:2,avoidOthers:true,pvp:false,autoTravel:false},party:{enabled:true,followDistance:180,waitForTeam:true,focusFire:true}};
 const p={c,parent:{is_pvp:false},G:{maps:{main:{}},items:{}},realm:()=> 'EUII',call:(name,...args)=>{if(name==='is_on_cooldown')return false;if(name==='can_attack')return true;if(name==='change_target'){c.target=args[0].id;return true;}if(name==='attack'){attacks++;return {success:true};}return false;}};
 const exec={run:(key,resources,guard,invoke)=>{if(!guard())return false;invoke();return true;}};
 const bot={p,cfg,exec,me:{name:'A',role:'farmer'},account:null,inventoryBlocked:false,logistics:{reserved:false},free:()=>20,movement:{order:null,stop(){},go(d,owner){if(owner==='follow')follows++;return true;},local:()=>true,farmLocation:()=>null},skills:{rotation(){}},transport:{fresh:name=>name==='B'?leader:null},leader:'B',farmers:['A','B'],strategy:{travel:()=>false,status:()=>({manual})},monsters:()=>[bee],allowed:e=>e===bee,target:null,entity:id=>id===bee.id?bee:null,targets:()=>['bee']};
 const farmer=createFarmer(bot);
 farmer.tick();assert.equal(follows,1);assert.equal(attacks,0);
 manual={task:'farm',id:'bee',until:Date.now()+60000};farmer.tick();assert.equal(follows,1);assert.equal(attacks,1);
});
