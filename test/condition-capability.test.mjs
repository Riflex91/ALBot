import test from 'node:test';
import assert from 'node:assert/strict';
import {farmHealer,farmThroughput} from '../src/world/composition.mjs';
import {compactCombatSupport} from '../src/party/transport.mjs';
import {neutralPullReadiness} from '../src/combat/team-readiness.mjs';
import {bossDamageShadow,bossProfile} from '../src/combat/bosses.mjs';
const G={skills:{heal:{mp:10,range:500}},conditions:{stoned:{blocked:true}}};
const priest={name:'P',ctype:'priest',class:'priest',level:80,mp:1000,max_mp:1000,
 hp:1000,max_hp:1000,attack:100,frequency:1,range:500,map:'main',x:0,y:0,
 s:{stoned:{ms:4000}},capabilities:{at:Date.now(),ready:['heal'],sustainable:['heal']}};
test('a petrified priest is neither a current nor planned healer despite old capability telemetry',()=>{
 const options={G,healing:true,planned:true,ttl:10000};
 assert.equal(farmHealer([priest,{...priest,name:'R',ctype:'ranger',class:'ranger'}],options),null);
 assert.equal(compactCombatSupport(priest,G,priest.capabilities).healReady,false);
 const r=farmThroughput({hp:100,armor:0,resistance:0,attack:1,frequency:1},[priest],1,options);
 assert.equal(r.baseDps,0);
});
test('neutral pull refuses a condition-blocked partner without dropping its physical HP from the team',()=>{
 const c={...priest,name:'R',ctype:'ranger',s:{}};
 const bot={cfg:{party:{enabled:true,waitForTeam:true,followDistance:140},farming:{pullHp:.75}},
  p:{c,G,realm:()=>'EUI'},me:{name:'R'},leader:'R',farmers:['R','P'],
  transport:{fresh:()=>({...priest,running:true,realm:'EUI'})}};
 assert.equal(neutralPullReadiness(bot).reason,'peer-condition-blocked');
});
test('boss estimate gives no attack output to a petrified member and catalogs rare mechanics honestly',()=>{
 const estimate=bossDamageShadow({hp:100,armor:0,resistance:0},[priest],{conditions:G.conditions});
 assert.equal(estimate.valid,false);
 const catalog={monsters:{manyeye:{hp:2520000,abilities:{stone:{cooldown:6400}}},mimic:{hp:2240000},paledino:{hp:1320000}}};
 assert.equal(bossProfile(catalog,'manyeye').supported,false);
 assert.equal(bossProfile(catalog,'mimic').supported,true);
 assert.equal(bossProfile(catalog,'paledino').supported,true);
});
