// Aura choices are advisory until the common Executor validates the real skill.
export function chooseAura({hpRatio=1,mpRatio=1,damageType='physical',pressure=false,dangerRatio=0,unknownThreat=false}={}){
 if(hpRatio<.65||dangerRatio>=.35||unknownThreat)return damageType==='magical'?'sanctuary':'bulwark';
 if(mpRatio<.3||pressure)return 'warding';
 return 'zeal';
}
export function auraRisk(monsters,allies,G){
 const team=new Map(allies.filter(a=>a?.name&&!a.rip&&a.hp>0).map(a=>[a.name,a]));
 let dangerRatio=0,unknownThreat=false,damageType='physical';
 for(const m of monsters){
  if(!m||m.hp<=0||m.dead||m.rip||!team.has(m.target))continue;
  const ally=team.get(m.target),meta=G.monsters?.[m.mtype]??{},attack=m.attack??meta.attack,frequency=m.frequency??meta.frequency;
  if(!Number.isFinite(attack)||attack<0||!Number.isFinite(frequency)||frequency<=0){unknownThreat=true;continue;}
  const ratio=attack*frequency*3/Math.max(1,ally.hp);if(ratio>dangerRatio){dangerRatio=ratio;damageType=m.damage_type??meta.damage_type??'physical';}
 }
 return {dangerRatio,unknownThreat,damageType};
}
export function createAura(bot){
 const {p,cfg,exec}=bot;let last=0,proposed=null;
 const desired=()=>{
  const allies=[p.c,...bot.allies().filter(x=>x?.name!==p.c.name&&!x.rip)],hp=Math.min(...allies.map(x=>x.hp/Math.max(1,x.max_hp))),
   mp=Math.min(...allies.map(x=>x.mp/Math.max(1,x.max_mp))),risk=auraRisk(bot.monsters(),allies,p.G);
  const type=risk.dangerRatio>0?risk.damageType:p.G.monsters?.[bot.target?.mtype]?.damage_type??risk.damageType;
  const urgent=hp<.65||risk.dangerRatio>=.35||risk.unknownThreat;
  return {aura:cfg.party.aura==='auto'?chooseAura({hpRatio:hp,mpRatio:mp,damageType:type,pressure:!!(p.c.s?.poisoned||p.c.s?.burned),...risk,damageType:type}):cfg.party.aura,urgent,risk};
 };
 return {tick(){
  const s=p.G.skills?.paladin_aura;if(p.c.ctype!=='paladin'||!cfg.party.buffs||cfg.party.aura==='off'||!s||p.c.level<(s.level??60)||p.c.rip||p.c.s?.stunned||p.c.s?.silenced||bot.journal||p.call('is_on_cooldown','paladin_aura'))return false;
  const decision=desired(),aura=decision.aura;proposed=decision;
  const current=p.c.p?.paladin_aura,emergency=cfg.party.aura==='auto'&&decision.urgent&&['bulwark','sanctuary'].includes(aura)&&current!==aura&&(!['bulwark','sanctuary'].includes(current)||decision.risk.dangerRatio>=.7);
  if(!emergency&&Date.now()-last<cfg.party.auraHoldMs)return false;
  if(!s.states?.[aura]||current===aura)return false;
  const accepted=exec.run('paladin.aura',['skill'],()=>{const live=desired();return bot.running&&!bot.journal&&!p.c.rip&&!p.c.s?.stunned&&!p.c.s?.silenced&&!!p.G.skills?.paladin_aura?.states?.[aura]&&live.aura===aura;},()=>p.call('use_skill','paladin_aura',aura),{delay:cfg.party.auraHoldMs});
  if(accepted)last=Date.now();return accepted;
 },status:()=>({aura:p.c.p?.paladin_aura??null,lastChanged:last,proposal:proposed})};
}
