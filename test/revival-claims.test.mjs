import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevivalClaims,reviveDeathKey} from '../src/combat/revival-claims.mjs';
function fixture(){
 const data=new Map();let target={name:'R',rip:true,map:'main',hp:100,max_hp:100};
 const bot={me:{name:'P'},p:{realm:()=>'EUI',read:k=>data.get(k),
  write:(k,v)=>{data.set(k,structuredClone(v));return true;}},
  transport:{fresh:()=>null},entity:()=>target};
 return {bot,data,get target(){return target;},set target(v){target=v;}};
}
test('revive claim survives timeout, missing target and module restart without spending twice',()=>{
 const f=fixture(),a=createRevivalClaims(f.bot),key=reviveDeathKey(f.bot,f.target);
 assert.equal(a.canCast(f.target,key),true);assert.equal(a.claim(f.target,key),true);
 const old=f.target;f.target=null;a.observe();f.target=old;
 const restarted=createRevivalClaims(f.bot);assert.equal(restarted.canCast(f.target,key),false);
 assert.equal(restarted.claim(f.target,key),false);
});
test('observed alive state or a verified different death generation permits the next death',()=>{
 const f=fixture(),a=createRevivalClaims(f.bot);a.claim(f.target,reviveDeathKey(f.bot,f.target));
 f.target={...f.target,rip:false};a.observe();
 f.target={...f.target,rip:true,rip_time:1000};assert.equal(a.canCast(f.target),true);
 a.claim(f.target,reviveDeathKey(f.bot,f.target));f.target={...f.target,rip_time:2000};
 a.observe();assert.equal(a.canCast(f.target),true);
});
test('existing server revival and failed durable storage do not authorize consumption',()=>{
 const f=fixture(),a=createRevivalClaims(f.bot);
 assert.equal(a.canCast({...f.target,c:{revival:{ms:8000}}}),false);
 f.bot.p.write=()=>false;assert.equal(a.claim(f.target,reviveDeathKey(f.bot,f.target)),false);
 assert.equal(a.status().blocked,true);
});
