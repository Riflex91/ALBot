// Conservative, horizon-bound use of live status effects in farm planning.
// Server-observed stats already include conditions: never add a buff twice.
const finitePositive=x=>Number.isFinite(x)&&x>0;
const range=(n,min,max)=>Math.max(min,Math.min(max,n));
export function effectLastsThrough(owner,id,seconds,now=Date.now()){
 const effect=owner?.s?.[id];
 if(!effect||typeof effect!=='object'||!Number.isFinite(effect.ms)||
    !Number.isFinite(seconds)||seconds<0)return false;
 const received=owner.received;
 if(received!==undefined&&(!Number.isFinite(received)||received>now||now-received>4000))
  return false;
 const age=received===undefined?0:Math.max(0,now-received);
 return effect.ms-age>=(seconds+.5)*1000;
}
function verifiedAuraSource(owner,id,effect,members,game){
 if(!id.startsWith('paladin_aura_'))return true;
 const source=members.find(c=>c?.name===effect.f&&(c.ctype??c.class)==='paladin');
 const rangeLimit=game?.skills?.paladin_aura?.range;
 return !!source&&Number.isFinite(rangeLimit)&&rangeLimit>0&&
  source.map===owner.map&&String(source.in??source.map)===String(owner.in??owner.map)&&
  Number.isFinite(owner.x)&&Number.isFinite(owner.y)&&
  Number.isFinite(source.x)&&Number.isFinite(source.y)&&
  Math.hypot(source.x-owner.x,source.y-owner.y)<=rangeLimit;
}
const bonus=(effect,def,key)=>Math.max(0,
 (Number.isFinite(effect?.[key])?effect[key]:0)+
 (Number.isFinite(def?.[key])?def[key]:0));
export function stableFarmOffense(actor,seconds,{G={},members=[]}={}){
 if(!actor||!finitePositive(actor.attack)||!finitePositive(actor.frequency))
  return {valid:false,reason:'invalid-attacker'};
 const stats={...actor},removed=[];
 let outputBonus=0;
 for(const [id,effect] of Object.entries(actor.s??{})){
  if(!effect||typeof effect!=='object')continue;
  const def=G.conditions?.[id]??{};
  if(effectLastsThrough(actor,id,seconds)&&
     verifiedAuraSource(actor,id,effect,members,G))continue;
  // Unknown/unverified effects are never interpreted as newly available power.
  if(def.buff!==true&&effect.buff!==true&&!id.startsWith('paladin_aura_'))continue;
  const attributes=['str','int','dex'].filter(key=>bonus(effect,def,key)>0);
  if(attributes.length)return {valid:false,reason:'expiring-offense-attribute',effect:id};
  const frequency=bonus(effect,def,'frequency')/100;
  const attack=bonus(effect,def,'attack');
  const piercing=bonus(effect,def,'apiercing');
  const resistancePiercing=bonus(effect,def,'rpiercing');
  const output=bonus(effect,def,'output');
  const courage=['courage','mcourage','pcourage'];
  if(frequency)stats.frequency=Math.max(0.01,stats.frequency-frequency);
  if(attack)stats.attack=Math.max(0.01,stats.attack-attack);
  if(piercing)stats.apiercing=(stats.apiercing??0)-piercing;
  if(resistancePiercing)stats.rpiercing=(stats.rpiercing??0)-resistancePiercing;
  // farmFearFactor already removes a temporary Beacon credit.
  for(const key of courage)if(id!=='beacon_of_resolve'){
   const value=bonus(effect,def,key);
   if(value)stats[key]=(stats[key]??0)-value;
  }
  outputBonus+=output;
  if(frequency||attack||piercing||resistancePiercing||output||
     courage.some(key=>bonus(effect,def,key)>0))removed.push(id);
 }
 if(outputBonus){
  // 'output' is a percentage of the server's 100-based damage output stat.
  // When that stat is missing, a larger haircut is safer than assuming 100.
  const ratio=finitePositive(actor.output)?
   range((actor.output-outputBonus)/actor.output,.01,1):
   range(1-outputBonus/100,.01,1);
  stats.attack=Math.max(.01,stats.attack*ratio);
  if(finitePositive(actor.heal))stats.heal=Math.max(0,actor.heal*ratio);
 }
 return {valid:true,stats,removed};
}
// Debuff damage amplification is NOT baked into outgoingDamageEstimate.
// Count only server-visible, duration-verified, bounded amplification.
export function verifiedTargetDamageAmplification(monster,seconds,G={}){
 let amplification=0;
 for(const [id,effect] of Object.entries(monster?.s??{})){
  const def=G.conditions?.[id];
  if(def?.debuff!==true||!effectLastsThrough(monster,id,seconds))continue;
  const value=bonus(effect,def,'incdmgamp');
  if(Number.isFinite(value)&&value>0)amplification+=value;
 }
 return 1+range(amplification,0,20)/200; // half credit, maximum 10%
}
export function horizonMonsterStats(monster,seconds,{G={},monsterBase=null}={}){
 if(!monster)return monster;
 const adjusted={...monster},base=monsterBase??{};
 for(const [id,effect] of Object.entries(monster.s??{})){
  const def=G.conditions?.[id];
  if(!effect||typeof effect!=='object'||def?.debuff!==true||
     effectLastsThrough(monster,id,seconds))continue;
  for(const key of ['attack','frequency','armor','resistance','avoidance',
    'evasion','reflection']){
   const current=adjusted[key];
   const original=base[key];
   // Undo known debuff reductions if the original species stat is absent.
   const delta=Number.isFinite(def[key])&&def[key]<0?-def[key]:0;
   const conservative=Number.isFinite(original)?original:
    Number.isFinite(current)?current+delta:undefined;
   if(Number.isFinite(conservative))
    adjusted[key]=Math.max(current??conservative,conservative);
  }
 }
 return adjusted;
}
