import test from 'node:test';
import assert from 'node:assert/strict';
import {crossRoleGearPriority,gearCatchUpPriority} from '../src/production/gear-fairness.mjs';
const now=Date.now();
const slots={
 mainhand:null,offhand:null,helmet:null,chest:null,pants:null,shoes:null,
 gloves:null,amulet:null,belt:null,cape:null,ring1:null,ring2:null,
 earring1:null,earring2:null,orb:null
};
const profile=(cls,filled=[],at=now)=>({
 class:cls,level:70,complete:true,at,realm:'EUI',
 slots:Object.fromEntries(Object.keys(slots).map(k=>[k,
  filled.includes(k)?{name:k,level:2}:null]))
});
test('W05 fair coverage compares distinct roles rather than cross-class raw stats',()=>{
 const healer=profile('priest',['chest','helmet','pants','shoes']);
 const dps=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves','amulet','ring1']);
 const cohort=[{profile:healer,role:'healer'},{profile:dps,role:'dps'}];
 const missingWeapon=crossRoleGearPriority(healer,cohort,{role:'healer',slot:'mainhand',now});
 const alreadyFilled=crossRoleGearPriority(healer,cohort,{role:'healer',slot:'shoes',now});
 assert.ok(missingWeapon>alreadyFilled);
 assert.ok(missingWeapon>0);
 assert.equal(gearCatchUpPriority(healer,[dps]),0,'existing same-class rule remains independent');
});
test('W05 stale or incomplete profiles do not grant account-wide priority',()=>{
 const weak=profile('priest',[]);
 const old=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves'],now-8*86400000);
 assert.equal(crossRoleGearPriority(weak,[{profile:weak,role:'healer'},{profile:old,role:'dps'}],{role:'healer',slot:'mainhand',now}),0);
 assert.equal(crossRoleGearPriority({...weak,complete:false},[{profile:weak,role:'healer'},{profile:profile('ranger',['mainhand']),role:'dps'}],{role:'healer',slot:'mainhand',now}),0);
});
test('W05 verified wait bonus is time-bounded and absent without receipt',()=>{
 const weak=profile('priest',[]);
 const strong=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves','amulet','ring1']);
 const cohort=[{profile:weak,role:'healer'},{profile:strong,role:'dps'}];
 const ordinary=crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now});
 const waiting=crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now,lastImprovedAt:now-12*86400000});
 assert.ok(waiting>=ordinary);
 assert.ok(waiting-ordinary<=12);
 assert.equal(ordinary,crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now,lastImprovedAt:null}));
});
test('W05 role-specific vacancies and upper bound are deterministic',()=>{
 const empty=profile('merchant',[]);
 const full=profile('warrior',Object.keys(slots));
 const cohort=[{profile:empty,role:'economy'},{profile:full,role:'tank'}];
 const shoes=crossRoleGearPriority(empty,cohort,{role:'economy',slot:'shoes',now});
 const weapon=crossRoleGearPriority(empty,cohort,{role:'economy',slot:'mainhand',now});
 assert.ok(shoes>weapon);
 assert.ok(shoes<=60);
 assert.equal(crossRoleGearPriority(empty,[],{role:'economy',slot:'shoes',now}),0);
});


test('W05 equal slot counts use actual role weights, not interchangeable occupancy',()=>{
 const strong=profile('ranger',Object.keys(slots));
 const healerChest=profile('priest',['chest']);
 const healerStaff=profile('priest',['mainhand']);
 const priority=(self,role)=>crossRoleGearPriority(self,
  [{profile:self,role},{profile:strong,role:'dps'}],
  {role,slot:'shoes',now});
 assert.ok(priority(healerChest,'healer')>priority(healerStaff,'healer'),
  'Priest mainhand carries more utility than chest with same slot count');
 const tankShoes=profile('warrior',['shoes']);
 const tankChest=profile('warrior',['chest']);
 assert.ok(priority(tankShoes,'tank')>priority(tankChest,'tank'),
  'Tank chest carries more coverage than shoes with same slot count');
 const merchantBelt=profile('merchant',['belt']);
 const merchantShoes=profile('merchant',['shoes']);
 assert.ok(priority(merchantBelt,'economy')>priority(merchantShoes,'economy'),
  'Merchant movement slot is explicitly weighted');
});

test('W05 absent canonical slots or stale/future owner never grant cross-role priority',()=>{
 const weak=profile('priest',[]);
 const strong=profile('ranger',Object.keys(slots));
 const base=self=>crossRoleGearPriority(self,
  [{profile:self,role:'healer'},{profile:strong,role:'dps'}],
  {role:'healer',slot:'mainhand',now});
 assert.ok(base(weak)>0);
 assert.equal(base({...weak,at:now-8*86400000}),0);
 assert.equal(base({...weak,at:now+1}),0);
 const malformed=structuredClone(weak);
 delete malformed.slots.offhand;
 assert.equal(base(malformed),0,'incomplete keyset is not complete gear evidence');
 const extra=structuredClone(weak);
 extra.slots.fake1={name:'unrelated'};
 assert.equal(base(extra),base(weak),'unknown UI slots cannot raise gear coverage');
});

test('W05 foreign-realm gear snapshots never inflate same-class or cross-role fairness',()=>{
 const weak=profile('priest',[]);
 const sameClass=profile('priest',Object.keys(slots));
 const otherRole=profile('warrior',Object.keys(slots));
 assert.ok(gearCatchUpPriority(weak,[sameClass],{now})>0);
 assert.equal(gearCatchUpPriority(weak,[{...sameClass,realm:'USV'}],{now}),0);
 assert.equal(crossRoleGearPriority(weak,[
  {profile:weak,role:'healer'},
  {profile:{...otherRole,realm:'USV'},role:'tank'}
 ],{role:'healer',slot:'mainhand',now}),0);
});

test('W05 old, future, incomplete or malformed peer gear cannot grant catch-up',()=>{
 const weak=profile('priest',[]);
 const strong=profile('priest',Object.keys(slots));
 for(const invalid of [
  {...strong,at:now-8*86400000},
  {...strong,at:now+5000},
  {...strong,at:NaN},
  {...strong,complete:false},
  {...strong,realm:null},
  {...strong,slots:{...strong.slots,mainhand:{name:'weapon',level:NaN}}}
 ]){
  assert.equal(gearCatchUpPriority(weak,[invalid],{now}),0);
 }
 const partial=structuredClone(strong);
 delete partial.slots.offhand;
 assert.equal(gearCatchUpPriority(weak,[partial],{now}),0);
});

test('W05 canonical fifteen slots exclude synthetic extra slot inflation',()=>{
 const weak=profile('priest',[]);
 const strong=profile('priest',['mainhand','helmet','chest']);
 const original=gearCatchUpPriority(weak,[strong],{now});
 assert.ok(original>0);
 const extra=structuredClone(strong);
 extra.slots.synthetic={name:'impossible',level:99};
 assert.equal(gearCatchUpPriority(weak,[extra],{now}),original);
});

test('W05 same-realm stale owner never gets a bonus from a fresh peer',()=>{
 const weak=profile('priest',[]);
 const strong=profile('priest',Object.keys(slots));
 assert.ok(gearCatchUpPriority(weak,[strong],{now})>0);
 assert.equal(gearCatchUpPriority({...weak,at:now-8*86400000},[strong],{now}),0);
 assert.equal(gearCatchUpPriority({...weak,realm:'USV'},[strong],{now}),0);
});
