// The official Guide observes fights but does not execute its advice.
// Only small, validated hints enter the existing scheduler; all action guards stay.
export function supportedProgressionRows(advice,G,allowed,excluded=[],pvp=false){
 if(!advice||advice.version!==1||advice.ready!==true||!Array.isArray(advice.rows))return [];
 const eligible=new Set(allowed),rows=[];
 for(const row of advice.rows.slice(0,32)){
  const route=row?.action?.kind==='farm'?row.action.route:null;
  if(!route||typeof route.monster!=='string'||typeof route.map!=='string'||!eligible.has(route.monster)||
    !G.monsters?.[route.monster]||!G.maps?.[route.map]||excluded.includes(route.map)||G.maps[route.map].ignore||
    (G.maps[route.map].pvp&&!pvp)||route.safe===false||!Number.isFinite(row.priority)||row.priority<0)continue;
  rows.push({kind:'farm',monster:route.monster,map:route.map,priority:Math.min(200,row.priority),source:'official-get_progression'});
  if(rows.length>=5)break;
 }
 return rows;
}
export function createProgression(bot){
 const {p,cfg,me}=bot;let cached=null,last=0,definitions=null,statusReason='not-read',lastError=0;
 const enabled=()=>cfg.production?.progressionAdvice===true;
 const options=()=>{
  const g=cfg.production?.goals?.find(x=>x.enabled&&typeof x.item==='string'&&x.quantity>0);
  const allowed=me.farmTargets?.length?me.farmTargets:cfg.farming.targets;
  const farm=allowed.find(id=>p.G.monsters?.[id]);
  const goal=me.role==='merchant'&&g?{kind:'item',name:g.item,level:g.level,quantity:g.quantity}:
    farm?{kind:'farm',monster:farm}:null;
  const spare=Math.max(0,(p.c.gold??0)-Math.max(me.goldReserve??0,cfg.merchant.goldReserve??0));
  const spendLimit=Math.floor(Math.max(0,Math.min(spare,cfg.merchant.maxSpendPerHour??0,cfg.production.lossBudget??0,g?.budget??Infinity)));
  return {goal,spendLimit,allowPvp:false};
 };
 function refresh(force=false){
  if(!enabled()){statusReason='disabled';return null;}
  const now=Date.now(),ttl=Math.max(15000,cfg.general.planningTickMs??15000);
  if(!force&&definitions===p.G&&now-last<ttl)return cached;
  last=now;
  if(definitions!==p.G){definitions=p.G;cached=null;}
  if(!p.hasProgression?.()){statusReason='official-api-unavailable';return cached=null;}
  const args=options();
  try{
   const advice=p.progression(args);
   if(!advice||advice.version!==1||advice.ready!==true||!Array.isArray(advice.rows)||!Array.isArray(advice.plans)&&advice.plans!==undefined){statusReason='unsupported-advice-shape';return cached=null;}
   const rows=supportedProgressionRows(advice,p.G,me.farmTargets?.length?me.farmTargets:cfg.farming.targets,cfg.world.excludedMaps??[],false);
   const plans=Array.isArray(advice.plans)?advice.plans:[];
   // Plan entries must never directly enqueue an upgrade, purchase or trade.
   cached={at:now,goal:args.goal,rows,plansCount:plans.length,observation:'Guide combat history is not a measured rate until observed'};
   statusReason=rows.length?'validated-farm-hints':'no-supported-hints';return cached;
  }catch(e){
   cached=null;statusReason='read-error';
   if(now-lastError>30000){lastError=now;bot.event?.('progression.unavailable',{reason:String(e?.message??e).slice(0,140)});}
   return null;
  }
 }
 function bonus(monster,map){
  if(!enabled())return 0;const state=refresh();return state?.rows.some(x=>x.monster===monster&&(!map||x.map===map))?.06:0;
 }
 function goalPriority(g){
  // Prefer existing explicit production goals only; no new materials or buying.
  const state=refresh(),goal=state?.goal;
  return goal?.kind==='item'&&g.item===goal.name&&g.level===goal.level?0.1:0;
 }
 return {refresh,bonus,goalPriority,status:()=>({reason:statusReason,lastRead:last,rows:cached?.rows??[],plansCount:cached?.plansCount??0}),close(){p.closeProgression?.();cached=null;}};
}
