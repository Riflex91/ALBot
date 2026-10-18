import test from 'node:test';
import assert from 'node:assert/strict';
import {boosterExpiry,preferredBooster,holidayOpportunity,createWorldOpportunities} from '../src/world/opportunities.mjs';
const now=4000000;
function fixture(){
 const calls=[],jobs=[],c={name:'A',map:'main',in:'main',x:0,y:0,
  items:[{name:'xpbooster',level:2,expires:now+86400000}],s:{},c:{}};
 const bot={running:true,me:{name:'A',role:'farmer'},
  cfg:{world:{boosters:true,activateBoosters:false,seasonalBuff:false},farming:{mode:'gold'}},
  p:{c,G:{maps:{main:{}}},root:{},parent:{},has:()=>true,read:()=>null,write:()=>true,
   call:(name,...args)=>{calls.push([name,...args]);if(name==='shift')c.items[args[0]].name=args[1];
    if(name==='activate')c.items[args[0]].expires=now+86400000;}},
  economy:{safe:i=>!!i&&!i.l&&!i.b,explicit:()=>null,
   perform:(name,job)=>{jobs.push({name,...job});if(!job.guard())return false;
    job.call();assert.equal(job.observe(),true);return true;}},
  free:()=>4,logistics:{},movement:{},monsters:()=>[],event:()=>{}};
 return {bot,c,calls,jobs};
}
test('booster expiry and mode are data-driven; unknown dates are not activated',()=>{
 assert.equal(boosterExpiry({expires:'bad'}),null);
 assert.equal(boosterExpiry({expires:1234}),1234);
 assert.equal(preferredBooster('xp','farmer'),'xpbooster');
 assert.equal(preferredBooster('gold','merchant'),'luckbooster');
});
test('owned active booster shifts once with a durable timestamp; no cash buy API is used',()=>{
 const {bot,c,calls}=fixture();
 assert.equal(createWorldOpportunities(bot,{now:()=>now}).tick(),true);
 assert.deepEqual(calls,[['shift',0,'goldbooster']]);
 assert.equal(c.items[0].expires,now+86400000);
});
test('inactive booster requires its separate explicit lifetime opt-in',()=>{
 const {bot,c,calls}=fixture();delete c.items[0].expires;
 let run=createWorldOpportunities(bot,{now:()=>now});
 assert.equal(run.tick(),false);assert.deepEqual(calls,[]);
 bot.cfg.world.activateBoosters=true;
 run=createWorldOpportunities(bot,{now:()=>now});assert.equal(run.tick(),true);
 assert.deepEqual(calls,[['activate',0]]);
});
test('locked boosters, explicit keep and ongoing value work block activation',()=>{
 for(const mode of ['locked','keep','journal']){
  const {bot,c,calls}=fixture();delete c.items[0].expires;bot.cfg.world.activateBoosters=true;
  if(mode==='locked')c.items[0].l=true;
  if(mode==='keep')bot.economy.explicit=()=>({action:'keep'});
  if(mode==='journal')bot.journal={kind:'sell'};
  assert.equal(createWorldOpportunities(bot,{now:()=>now}).tick(),false);
  assert.deepEqual(calls,[]);
 }
});
test('seasonal buff is only collected while passing a verified seasonal tree outside instances',()=>{
 const G={maps:{main:{ref:{newyear_tree:{x:0,y:0}}},crypt:{instance:true,ref:{newyear_tree:{x:0,y:0}}}}};
 const c={map:'main',x:0,y:0,s:{}};
 assert.equal(holidayOpportunity(c,G,{holidayseason:true}),true);
 assert.equal(holidayOpportunity(c,G,{holidayseason:{live:false}}),false);
 assert.equal(holidayOpportunity({...c,map:'crypt'},G,{holidayseason:true}),false);
 assert.equal(holidayOpportunity({...c,cave:{run:'r'}},G,{holidayseason:true}),false);
 assert.equal(holidayOpportunity({...c,x:300},G,{holidayseason:true}),false);
 assert.equal(holidayOpportunity({...c,s:{holidayspirit:{ms:100}}},G,{holidayseason:true}),false);
});
