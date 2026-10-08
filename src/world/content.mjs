import {knowledgeFingerprint} from './knowledge.mjs';
export function createContentGuard(bot){const key='albot:content:'+bot.me.name;let known=bot.p.read(key)??{},dirty=false,lastSave=0;if(!known||typeof known!=='object'||Array.isArray(known))known={};
 function approve(scope,definition){const hash=knowledgeFingerprint(definition),now=Date.now(),old=known[scope];if(old&&old.hash!==hash){known[scope]={hash,previous:old.hash,changed:now,until:now+Math.min(10000,bot.cfg.world.cacheTtlMs),at:now};dirty=true;bot.event('content.quarantine',{scope,previous:old.hash,current:hash,reason:'Semantische Spieldaten geändert; alten Plan verwerfen und stabil neu bewerten'});return false;}
  if(!old){known[scope]={hash,at:now};dirty=true;}else if(old.until){if(now<old.until)return false;delete old.until;dirty=true;bot.event('content.release',{scope,hash,reason:'Geänderte Definition blieb stabil; aktueller Plan wird neu berechnet'});}return true;
 }
 function flush(){if(!dirty||Date.now()-lastSave<30000)return;const next=Object.fromEntries(Object.entries(known).sort((a,b)=>b[1].at-a[1].at).slice(0,96));if(bot.p.write(key,next)){known=next;dirty=false;lastSave=Date.now();}}
 return {approve,flush,status:()=>Object.entries(known).filter(([,r])=>r.until>Date.now()).map(([scope,r])=>({scope,previous:r.previous,current:r.hash,until:r.until})),close(){flush();}};
}
