import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCombat} from '../src/world/risk.mjs';
import {stableFarmOffense,verifiedTargetDamageAmplification,
 horizonMonsterStats,effectLastsThrough} from '../src/world/effect-risk.mjs';
import {stableFarmDefense} from '../src/world/composition.mjs';

const actor=()=>({name:'Ranger',ctype:'ranger',hp:4000,max_hp:4000,
 attack:100,frequency:1,mp:1000,max_mp:1000,courage:3,
 map:'main',in:'main',x:0,y:0});
const mob=(hp=1000)=>({mtype:'test',hp,max_hp:hp,attack:1,frequency:.1});
const G={conditions:{
 warcry:{buff:true,frequency:10,armor:160,resistance:160},
 darkblessing:{buff:true,output:25},
 cursed:{debuff:true,output:-20,incdmgamp:20},
 sundered:{debuff:true,armor:-200},
 paladin_aura_bulwark:{buff:true,aura:true,armor:100}
},skills:{paladin_aura:{range:200}}};

test('expired War Cry does not double-count the observed and definition bonus',()=>{
 const c={...actor(),frequency:1.1,s:{warcry:{ms:1000,frequency:10}}};
 const result=stableFarmOffense(c,10,{G,members:[c]});
 assert.equal(result.valid,true);
 assert.ok(Math.abs(result.stats.frequency-1)<1e-9);
 assert.deepEqual(result.removed,['warcry']);
 assert.equal(c.frequency,1.1,'live character is immutable');
});

test('farm rejects a monster that only dies within 45 seconds with an expiring Dark Blessing',()=>{
 const short={...actor(),attack:125,output:125,
  s:{darkblessing:{ms:1500}}};
 const permanent={...short,s:{darkblessing:{ms:120000}}};
 const target=mob(4700),options={G,maxCombatSeconds:45};
 const temporary=assessCombat(target,[short],'assertive',1,options);
 const enduring=assessCombat(target,[permanent],'assertive',1,options);
 assert.equal(temporary.safe,false);
 assert.ok(temporary.seconds>45);
 assert.deepEqual(temporary.removedOffensiveEffects,['darkblessing']);
 assert.equal(enduring.safe,true);
 assert.ok(enduring.seconds<45);
 assert.equal(assessCombat(target,[short],'assertive',1,{G,maxCombatSeconds:300}).safe,true,
  'time cap and assertive damage-safety thresholds remain independent');
});

test('observed Curse only receives bounded credit while lasting the whole fight',()=>{
 const target={...mob(4700),s:{cursed:{ms:120000}}};
 const expired={...target,s:{cursed:{ms:1000}}};
 assert.equal(verifiedTargetDamageAmplification(target,45,G),1.1);
 assert.equal(verifiedTargetDamageAmplification(expired,45,G),1);
 assert.equal(assessCombat(target,[actor()],'assertive',1,{G,maxCombatSeconds:45}).safe,true);
 assert.equal(assessCombat(expired,[actor()],'assertive',1,{G,maxCombatSeconds:45}).safe,false);
});

test('expired Sundered can no longer suppress target armor in long fights',()=>{
 const target={...mob(),mtype:'test',armor:0,s:{sundered:{ms:500}}};
 const estimate=horizonMonsterStats(target,10,{G:{...G,monsters:{test:{armor:200}}}});
 assert.equal(estimate.armor,200);
 assert.equal(target.armor,0);
});

test('only a verified paladin aura protects the whole fight',()=>{
 const c={...actor(),armor:200,s:{paladin_aura_bulwark:{f:'P',ms:2500,armor:100}}};
 const p={...actor(),name:'P',ctype:'paladin'};
 const late=stableFarmDefense(c,[c,p],10,{G});
 assert.equal(late.armor,100);
 const lasting=stableFarmDefense({...c,s:{paladin_aura_bulwark:{f:'P',ms:40000,armor:100}}},[c,p],10,{G});
 assert.equal(lasting.armor,200);
 const alone=stableFarmDefense(c,[c],1,{G});
 assert.equal(alone.armor,100);
});

test('stale condition evidence is not treated as lasting or amplification',()=>{
 const now=Date.now();
 const c={...actor(),received:now-9000,s:{darkblessing:{ms:60000}}};
 assert.equal(effectLastsThrough(c,'darkblessing',10,now),false);
 assert.ok(stableFarmOffense({...c,attack:125,output:125},10,{G}).stats.attack<125);
});
