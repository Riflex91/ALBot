export function chooseAura({hpRatio=1,mpRatio=1,damageType='physical',pressure=false}){return hpRatio<.65?damageType==='magical'?'sanctuary':'bulwark':mpRatio<.3||pressure?'warding':'zeal';}
export function createAura(bot){const {p,cfg,exec}=bot;let last=0;
 return {tick(){const s=p.G.skills?.paladin_aura;if(p.c.ctype!=='paladin'||!cfg.party.buffs||cfg.party.aura==='off'||!s||p.c.level<(s.level??60)||p.c.rip||p.c.s?.stunned||p.c.s?.silenced||bot.journal||Date.now()-last<cfg.party.auraHoldMs||p.call('is_on_cooldown','paladin_aura'))return false;
  const allies=bot.allies().filter(x=>!x.rip),hp=Math.min(p.c.hp/p.c.max_hp,...allies.map(x=>x.hp/x.max_hp)),mp=Math.min(p.c.mp/p.c.max_mp,...allies.map(x=>x.mp/x.max_mp));
  const aura=cfg.party.aura==='auto'?chooseAura({hpRatio:hp,mpRatio:mp,damageType:p.G.monsters[bot.target?.mtype]?.damage_type,pressure:!!(p.c.s?.poisoned||p.c.s?.burned)}):cfg.party.aura;
  if(!s.states?.[aura]||p.c.p?.paladin_aura===aura)return false;
  const accepted=exec.run('paladin.aura',['skill'],()=>bot.running&&!bot.journal,()=>p.call('use_skill','paladin_aura',aura),{delay:cfg.party.auraHoldMs});if(accepted)last=Date.now();return accepted;
 },status:()=>({aura:p.c.p?.paladin_aura??null,lastChanged:last})};}
