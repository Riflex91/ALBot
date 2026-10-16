import test from 'node:test';
import assert from 'node:assert/strict';
import {bossDamageShadow,bossReadiness} from '../src/combat/bosses.mjs';
import {outgoingDamageEstimate} from '../src/combat/damage-model.mjs';

const fighter=(type='physical',other={})=>({
 name:'Ranger',ctype:type==='magical'?'mage':'ranger',damage_type:type,
 hp:10000,max_hp:10000,mp:1000,max_mp:1000,
 attack:300,frequency:2,crit:0,apiercing:0,rpiercing:0,...other
});
const beast=(other={})=>({
 hp:1000,max_hp:1000,attack:2,frequency:1,crit:0,
 armor:100,resistance:500,avoidance:0,evasion:0,reflection:0,...other
});
const game=(m=beast())=>({monsters:{phoenix:{boss:true,...m}}});
const shadow=(m,team,opts={})=>bossDamageShadow(m,team,opts);

test('boss damage uses physical armor and magical resistance separately',()=>{
 const m=beast({armor:700,resistance:20});
 const p=shadow(m,[fighter('physical')]),mag=shadow(m,[fighter('magical')]);
 assert.ok(p.valid&&mag.valid);
 assert.ok(mag.newEstimate>p.newEstimate);
 assert.equal(p.newEstimate,2*outgoingDamageEstimate(fighter('physical'),m,{uncertainty:.15}).damage);
 const swapped=beast({armor:20,resistance:700});
 assert.ok(shadow(swapped,[fighter('physical')]).newEstimate>shadow(swapped,[fighter('magical')]).newEstimate);
});

test('physical and magical armor penetration applies to correct defense only',()=>{
 const m=beast({armor:400,resistance:400});
 const p=shadow(m,[fighter('physical',{apiercing:200})]);
 const no=shadow(m,[fighter('physical')]);
 assert.ok(p.newEstimate>no.newEstimate);
 const mag=shadow(m,[fighter('magical',{rpiercing:200})]);
 assert.ok(mag.newEstimate>shadow(m,[fighter('magical')]).newEstimate);
 assert.equal(shadow(m,[fighter('physical',{rpiercing:200})]).newEstimate,no.newEstimate);
});

test('pure damage bypasses both defenses, but still accounts for avoidance',()=>{
 const m=beast({armor:1200,resistance:1500});
 const pure=shadow(m,[fighter('pure')]);
 assert.ok(pure.valid);
 assert.equal(pure.newEstimate,300*2*.85);
 assert.equal(shadow({...m,avoidance:50},[fighter('pure')]).newEstimate,pure.newEstimate*.5);
});

test('one HP boss is modeled in hit-units instead of normal damage',()=>{
 const m=beast({'1hp':true,armor:9999,resistance:9999,hp:10,max_hp:10});
 const result=shadow(m,[fighter('physical',{attack:1000,frequency:3})],{mode:'hits'});
 assert.equal(result.valid,true);
 assert.equal(result.newEstimate,3*.85);
 assert.ok(result.conservativeEstimate<=result.oldEstimate);
});

test('unknown attacker, immunity and unknown type fail closed',()=>{
 const m=beast();
 assert.equal(shadow(m,[fighter('physical',{frequency:undefined})]).valid,false);
 assert.equal(shadow(m,[fighter('physical',{damage_type:'unregistered'})]).valid,false);
 assert.equal(shadow({...m,immune:true},[fighter('physical')]).valid,false);
 assert.equal(shadow({...m,invincible:true},[fighter('physical')]).valid,false);
 assert.equal(shadow({...m,avoidance:200},[fighter('physical')]).valid,false);
});

test('healer attack time cannot also count as full attack DPS',()=>{
 const m=beast({armor:0,resistance:0});
 const r=fighter('physical',{name:'Ranger',attack:200});
 const p=fighter('magical',{name:'Priest',ctype:'priest',attack:300});
 const concurrent=shadow(m,[r,p]);
 const exclusive=shadow(m,[r,p],{healer:'Priest'});
 assert.ok(exclusive.valid);
 assert.ok(exclusive.newEstimate<concurrent.newEstimate);
 assert.equal(exclusive.rows.find(x=>x.name==='Priest').newDps,0);
 const gate=bossReadiness(game(m),'phoenix',null,[r,p]);
 assert.equal(gate.damageShadow.rows.find(x=>x.name==='Priest').newDps,0);
});

test('boss readiness never uses optimistic typed damage above old gate',()=>{
 const m=beast({armor:10,resistance:10,attack:1,hp:500});
 const out=bossReadiness(game(m),'phoenix',null,[fighter('pure')]);
 assert.equal(out.safe,true);
 assert.equal(out.damageShadow.authority,'conservative-gate');
 assert.ok(out.damageShadow.conservativeEstimate<=out.damageShadow.oldEstimate);
 assert.ok(out.damageShadow.conservativeEstimate<=out.damageShadow.newEstimate);
});

test('unsupported phase, protection and shell failure still prevent combat',()=>{
 const G=game(beast({attack:1}));
 const member=[fighter('physical')];
 assert.equal(bossReadiness(G,'phoenix',{s:{phase_shield:{ms:5000}}},member).safe,false);
 assert.equal(bossReadiness(G,'phoenix',{immune:true},member).safe,false);
 assert.equal(bossReadiness(G,'phoenix',{s:{fullguard:{ms:1000}}},member).phase,'WAIT');
 const shell={...beast({abilities:{rimeshell:{duration:1000,break_fraction:1}}})};
 const G2=game(shell);
 const blocked=bossReadiness(G2,'phoenix',{s:{rimeshell:{remaining:100000,ms:300}}},member);
 assert.equal(blocked.safe,false);
 assert.match(blocked.reason,/Shell/);
});
