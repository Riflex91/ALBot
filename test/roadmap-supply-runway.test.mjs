import test from 'node:test';
import assert from 'node:assert/strict';
import {supplyRunwayDelta,createSupplyForecast} from '../src/merchant/supply-forecast.mjs';

const clock=100000,realm='USIV';
const heart=(received,potions={hpot0:3000,mpot0:3000},other={})=>({
 name:'Ranger',session:'r1',realm,received,running:true,rip:false,
 reserved:false,journal:false,inventoryBlocked:false,
 lifecycleChanging:false,potions,...other
});
test('net depletion yields bounded advisory runway, never confirmed consumption',()=>{
 const result=supplyRunwayDelta(heart(90000),heart(95000,{hpot0:2950,mpot0:2970}),
  {now:clock,realm});
 assert.equal(result.valid,true);
 assert.equal(result.authority,'none');
 assert.equal(result.records.hpot0.status,'observed-net-decrease');
 assert.equal(result.records.hpot0.observedDecrease,50);
 assert.equal(result.records.hpot0.remainingSeconds,295);
 assert.equal(result.records.mpot0.observedDecrease,30);
});
test('no decrease or replenishment does not infer consumption',()=>{
 const same=supplyRunwayDelta(heart(90000),heart(95000),{now:clock,realm});
 assert.equal(same.records.hpot0.status,'no-depletion');
 assert.equal(same.records.hpot0.remainingSeconds,null);
 const added=supplyRunwayDelta(heart(90000),heart(95000,{hpot0:3200,mpot0:3200}),
  {now:clock,realm});
 assert.equal(added.records.mpot0.status,'replenished');
 assert.equal(added.records.mpot0.remainingSeconds,null);
});
test('session/realm/staleness and pending transfer states reject runway evidence',()=>{
 const before=heart(90000),after=heart(95000,{hpot0:2900,mpot0:2900});
 for(const broken of [
  {...after,session:'r2'}, {...after,realm:'EU1'},
  {...after,journal:true}, {...after,reserved:true},
  {...after,inventoryBlocked:true}, {...after,received:clock+1},
  {...after,potions:{hpot0:-1,mpot0:50}}
 ]){
  assert.equal(supplyRunwayDelta(before,broken,{now:clock,realm}).valid,false);
 }
 assert.equal(supplyRunwayDelta(heart(70000),heart(80000),{now:clock,realm}).valid,false);
});
test('merchant captures two fresh same-session snapshots, no new actions, clears on restart',()=>{
 const now=Date.now();let current=heart(now-7000);
 const bot={me:{name:'Merchant',role:'merchant'},farmers:['Ranger'],
  cfg:{general:{messageTtlMs:12000}},
  p:{realm:()=>realm},transport:{fresh:()=>current}};
 const p=createSupplyForecast(bot);
 p.tick();assert.equal(p.status().recipients.length,0);
 current=heart(now-3000,{hpot0:2980,mpot0:2980});
 p.tick();
 assert.equal(p.status().recipients.length,1);
 assert.equal(p.status().recipients[0].records.hpot0.observedDecrease,20);
 assert.equal(p.status().executable,false);
 current=heart(now-1000,{hpot0:2800,mpot0:2800},{session:'restarted'});
 p.tick();assert.equal(p.status().recipients.length,0);
 p.close();assert.equal(p.status().recipients.length,0);
});
