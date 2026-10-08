import {samePlace,distance} from '../core/policy.mjs';
import {knowledgeFingerprint} from '../world/knowledge.mjs';
export const ROLE_SKILLS={heal:['heal','partyheal'],aggro:['taunt','agitate'],protect:['reflection','guardians_oath'],energize:['energize'],speed:['rspeed'],mark:['huntersmark']};
export function createCapabilities(bot){
 let generation=0,last='',cached=null;
 function snapshot(){if(cached&&Date.now()-cached.at<200)return cached;const {p,cfg}=bot,c=p.c,ready=[],present=[];
  for(const [id,s] of Object.entries(p.G.skills??{})){
   if(s.class&&!s.class.includes(c.ctype)||(s.level??0)>c.level)continue;
   present.push(id);const rules=cfg.skills.filter(r=>r.skill===id&&(!r.character||r.character===c.name)&&(r.class==='auto'||r.class===c.ctype));
   if(rules.length&&!rules.some(r=>r.enabled))continue;
   if(bot.skills.ready(id,null,rules.some(r=>r.enabled)?Math.min(...rules.filter(r=>r.enabled).map(r=>r.minMp)):.2))ready.push(id);
  }
  const signature=knowledgeFingerprint([c.ctype,c.level,c.slots,ready]);if(signature!==last){last=signature;generation++;}
  return cached={generation,definition:last,at:Date.now(),ready:ready.slice(0,48),present:present.slice(0,64),aoe:ready.filter(id=>['3shot','5shot','cleave','stomp','fanofknives','cburst'].includes(id)).map(id=>({id,capacity:id==='3shot'?3:id==='5shot'?5:p.G.skills[id]?.targets??cfg.party.aoeMaxTargets}))};
 }
 function available(name,id,target=null){const h=name===bot.me.name?{running:bot.running,rip:bot.p.c.rip,realm:bot.p.realm(),capabilities:snapshot()}:bot.transport.fresh(name);return !!(h?.running&&!h.rip&&h.realm===bot.p.realm()&&h.capabilities?.at>Date.now()-bot.cfg.general.messageTtlMs&&h.capabilities.ready.includes(id)&&(name===bot.me.name||samePlace(bot.p.c,h)&&distance(bot.p.c,h)<=bot.cfg.party.followDistance*2)&&(!target||name===bot.me.name||samePlace(h,target)&&distance(h,target)<=(bot.p.G.skills[id]?.range??h.stats?.range??0)));}
 return {snapshot,available};
}
