import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCombat} from '../src/world/risk.mjs';
import {farmThroughput,combatMembers,stableFarmDefense,farmDamageMultiplier,farmFearFactor} from '../src/world/composition.mjs';
const G={skills:{heal:{class:['priest']},'3shot':{mp:200,damage_multiplier:.7},'5shot':{mp:320,damage_multiplier:.5},paladin_aura:{range:320},guardians_oath:{ratio:.35,link_range:360}},conditions:{hardshell:{armor:800}}};
const opts=()=>({G,healing:true,aoe:true,planned:false,leader:'Tank',ttl:10000});
const member=(name,ctype='ranger',skills=[])=>({name,ctype,hp:4000,max_hp:4000,mp:5000,max_mp:5000,mp_cost:20,level:80,attack:300,frequency:1,range:200,armor:0,resistance:0,map:'main',in:'main',x:0,y:0,capabilities:{at:Date.now(),ready:skills}});
const mob={hp:6000,attack:140,frequency:1,damage_type:'physical'};
test('three capable rangers gain per-character AoE throughput, not five times all damage',()=>{
 const team=['A','B','C'].map(n=>member(n,'ranger',['3shot','5shot']));
 const multi=farmThroughput(mob,team,5,opts()),single=farmThroughput(mob,team,1,opts());
 assert.ok(multi.effectiveDps>single.effectiveDps);assert.ok(multi.aoeMultiplier<=2.5);
 team[1].capabilities.ready=[];team[2].capabilities.ready=[];
 const mixed=farmThroughput(mob,team,5,opts());assert.ok(mixed.effectiveDps<multi.effectiveDps);
 team[0].mp=100;assert.equal(farmThroughput(mob,team,5,opts()).aoeMultiplier,1);
});
test('priest healing extends safe combat but consumes attack time and finite mana',()=>{
 const r=member('R'),p=member('P','priest',['heal']);p.attack=600;p.heal=600;
 const enemy={...mob,hp:6000,attack:130};
 const withHeal=assessCombat(enemy,[r,p],'balanced',1,opts());
 const without=assessCombat(enemy,[r,{...p,attack:1,capabilities:{at:Date.now(),ready:[]}}],'balanced',1,opts());
 assert.equal(withHeal.safe,true);assert.equal(without.safe,false);
 assert.equal(withHeal.outgoing,300);assert.ok(withHeal.healCredit>0);
 p.mp=100;assert.equal(assessCombat(enemy,[r,p],'balanced',1,opts()).healCredit,0);
 p.mp=5000;p.x=900;assert.equal(assessCombat(enemy,[r,p],'balanced',1,opts()).healCredit,0);
 p.x=0;p.capabilities.at=Date.now()-20000;assert.equal(assessCombat(enemy,[r,p],'balanced',1,opts()).healCredit,0);
});
test('tank mitigation respects damage type and armor penetration',()=>{
 const tank=member('Tank','warrior',['taunt']);tank.armor=1000;tank.hp=tank.max_hp=6000;
 const physical=assessCombat({...mob,attack:180},[tank],'balanced',1,opts());
 const magical=assessCombat({...mob,attack:180,damage_type:'magical'},[tank],'balanced',1,opts());
 assert.equal(physical.safe,true);assert.equal(magical.safe,false);
 assert.ok(assessCombat({...mob,attack:180,apiercing:1000},[tank],'balanced',1,opts()).exposure>physical.exposure);
 assert.equal(farmDamageMultiplier(100),.9);assert.equal(farmDamageMultiplier(0),1);
});
test('tank focus requires a controlled single target and does not pool team HP',()=>{
 const tank=member('Tank','warrior',['taunt']);tank.armor=1000;tank.hp=tank.max_hp=6000;
 const r=member('R');r.hp=r.max_hp=1000;
 const enemy={...mob,attack:100,hp:6000};
 assert.equal(assessCombat(enemy,[tank,r],'balanced',1,opts()).safe,true);
 assert.equal(assessCombat({...enemy,target:'R'},[tank,r],'balanced',1,opts()).safe,false);
 assert.equal(assessCombat(enemy,[tank,r],'balanced',3,opts()).safe,false);
 tank.capabilities.ready=[];assert.equal(assessCombat(enemy,[tank,r],'balanced',1,opts()).safe,false);
});
test('paladin aura and Hard Shell already in live stats are not doubled or extended past expiry',()=>{
 const pal=member('Pal','paladin'),r=member('R');r.armor=930;r.hp=r.max_hp=4500;
 r.s={paladin_aura_bulwark:{f:'Pal',armor:30,hp:500,ms:60000},hardshell:{ms:8000}};
 assert.equal(stableFarmDefense(r,[r,pal],2,opts()).armor,930);
 assert.equal(stableFarmDefense(r,[r,pal],10,opts()).armor,130);
 pal.x=500;const far=stableFarmDefense(r,[r,pal],10,opts());assert.equal(far.armor,100);assert.equal(far.hp,4000);
 pal.x=0;r.received=Date.now()-60000;assert.equal(stableFarmDefense(r,[r,pal],2,opts()).armor,100);
});
test('Mana Shield is finite and Aether Shield is not credited as damage reduction',()=>{
 const p=member('Pal','paladin');p.s={mshield:{ms:999999}};
 const shielded=assessCombat(mob,[p],'balanced',1,opts());assert.ok(shielded.defense[0].shield>0);
 p.mp=200;assert.equal(assessCombat(mob,[p],'balanced',1,opts()).defense[0].shield,0);
 p.mp=5000;p.s={aether_shield:{ms:999999}};assert.equal(assessCombat(mob,[p],'balanced',1,opts()).defense[0].shield,0);
});
test('Guardian oath requires active link, range and guardian HP budget',()=>{
 const p=member('Pal','paladin'),r=member('R');r.s={guardians_oath:{f:'Pal',ms:8000}};
 const enemy={...mob,hp:1800};
 assert.ok(assessCombat(enemy,[p,r],'balanced',1,opts()).defense.find(x=>x.name==='R').redirect>0);
 p.hp=10;assert.equal(assessCombat(enemy,[p,r],'balanced',1,opts()).defense.find(x=>x.name==='R').redirect,0);
 p.hp=4000;p.x=500;assert.equal(assessCombat(enemy,[p,r],'balanced',1,opts()).defense.find(x=>x.name==='R').redirect,0);
});
test('only selected fresh same-realm members count; combat excludes distant supports',()=>{
 const self=member('A'),peer={...member('B','priest',['heal']),running:true,realm:'EU1',x:900};
 const bot={p:{c:self,realm:()=> 'EU1'},me:{name:'A'},cfg:{party:{enabled:true,followDistance:100}},farmers:['A','B'],transport:{fresh:()=>peer}};
 assert.equal(combatMembers(bot).length,1);assert.equal(combatMembers(bot,true).length,2);
 peer.realm='US1';assert.equal(combatMembers(bot,true).length,1);
 peer.realm='EU1';bot.cfg.party.enabled=false;assert.equal(combatMembers(bot,true).length,1);
});
test('solo priest retains attack capability and cannot claim simultaneous healing',()=>{
 const p=member('P','priest',['heal']);const result=assessCombat({hp:100,attack:1,frequency:1},[p],'balanced',1,opts());
 assert.equal(result.safe,true);assert.equal(result.outgoing,300);assert.equal(result.healCredit,0);
});
test('Courage limits forecast AoE output; existing Fear is not applied twice',()=>{
 const r=member('R');r.courage=2;r.mcourage=1;r.pcourage=0;
 assert.equal(farmFearFactor(r,mob,3),.6);assert.equal(farmFearFactor(r,{...mob,damage_type:'magical'},3),.4);
 r.fear=1;assert.equal(farmFearFactor(r,mob,3),1);
});
test('critical burst can veto a high-damage monster despite enough healing',()=>{
 const p=member('P','priest',['heal']),r=member('R');
 const result=assessCombat({hp:100,attack:600,frequency:1,crit:1},[r,p],'balanced',1,opts());
 assert.equal(result.safe,false);
});
