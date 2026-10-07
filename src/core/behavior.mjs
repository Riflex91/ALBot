import {matches,distance} from './policy.mjs';
export function createBehavior(bot){
 const {p,cfg,me}=bot,last=new Map(),checked=new Map(),supplies=new Map();
 function requestSupply(item,quantity,ttl=120000){const r=bot.rule({name:item,level:0});if(!bot.running||!r||!Number.isSafeInteger(quantity)||quantity<1||quantity>r.maxCount||!Number.isFinite(ttl)||ttl<1000)return false;supplies.set(item,{quantity,until:Date.now()+Math.min(120000,ttl)});return true;}
 function tick(){
  const now=Date.now();for(const [id,v] of supplies)if(v.until<=now)supplies.delete(id);
  for(const r of cfg.rules.filter(r=>r.enabled&&(r.role==='all'||r.role===me.role)&&(!r.character||r.character===me.name)).sort((a,b)=>b.priority-a.priority)){
   const id=cfg.rules.indexOf(r);if((checked.get(id)??0)+r.everyMs>now||(last.get(id)??0)+r.cooldownMs>now)continue;checked.set(id,now);
   const values=bot.measure(bot.target),yes=r.match==='any'?r.conditions.some(c=>matches([c],values)):matches(r.conditions,values);if(!yes)continue;
   let accepted=false;
   if(r.action==='notify'){bot.report(r.target);accepted=true;}
   if(r.action==='pause'){bot.pause(r.target||r.name);accepted=true;}
   if(r.action==='farm')accepted=bot.strategy.requestTask('farm:'+r.target,Math.min(3600000,r.everyMs+r.cooldownMs+1000));
   if(r.action==='task')accepted=bot.strategy.requestTask(r.target,Math.max(10000,r.cooldownMs));
   if(r.action==='skill'){const s=p.G.skills?.[r.target];accepted=!!s&&bot.skills.use(r.target,s.hostile?bot.target:s.target?p.c:null,.2,Math.max(1000,r.cooldownMs),cfg.party.aoeMaxTargets,true);}
   if(r.action==='supply')accepted=requestSupply(r.target,r.amount);
   if(r.action==='bank'&&me.role==='merchant'&&cfg.merchant.bank&&p.c.items.some(i=>i?.name===r.target&&bot.rule(i)?.action==='bank'))accepted=bot.strategy.requestTask('bank',Math.max(10000,r.cooldownMs));
   if(r.action==='retreat'){const threat=bot.monsters().filter(m=>m.target===me.name).sort((a,b)=>distance(p.c,a)-distance(p.c,b))[0];if(threat){bot.farmer.retreat(threat);accepted=true;}}
   if(accepted){last.set(id,now);bot.event('behavior.rule',{name:r.name,action:r.action,target:r.target});if(!bot.running)return;}
  }
 }
 return {tick,requestSupply,need(item,n){const request=supplies.get(item);return request&&request.until>Date.now()?Math.max(0,request.quantity-n):0;},close(){supplies.clear();checked.clear();}};
}
