import {killQuantile,materialEvent} from './probability.mjs';
// Adapted from v3 elixir-policy: weighted nested drop tables, bounded recursion.
export function materialDrops(G,table,multiplier=1,seen=new Set()){
 const rows=[];if(seen.size>8)return rows;
 for(const row of Array.isArray(table)?table:[]){if(!Array.isArray(row)||!(row[0]>0)||typeof row[1]!=='string')continue;
  if(row[1]==='open'&&Array.isArray(G.drops?.[row[2]])&&!seen.has(row[2])){const children=G.drops[row[2]],total=children.reduce((n,r)=>n+(Number(r[0])||0),0);if(total>0)rows.push(...materialDrops(G,children,multiplier*row[0]/total,new Set([...seen,row[2]])));}
  else if(row[1]!=='open')rows.push({item:row[1],chance:row[0]*multiplier,quantity:Math.max(1,Number(row[2])||1)});
 }return rows;
}
export function materialSources(G,item,quantity,allowedMonsters,maxHours,rate=()=>({value:20,source:'configured-estimate'}),context={}){
 const result=[];for(const monster of allowedMonsters){const drops=materialDrops(G,G.drops?.monsters?.[monster]).filter(x=>x.item===item),yieldPerKill=drops.reduce((n,x)=>n+x.chance*x.quantity,0);
  if(!(yieldPerKill>0))continue;const meta=G.monsters?.[monster],eventInfo=materialEvent(G,monster,context.state),event=eventInfo.id;
  if(!eventInfo.active)continue;
  if(meta?.quest&&!context.questAllowed?.(meta.quest))continue;
  const measured=rate(monster),hours=quantity/(measured.value*yieldPerKill);
  const successes=Math.ceil(quantity/Math.min(...drops.map(d=>d.quantity))),probability=Math.min(1,drops.reduce((n,d)=>n+d.chance,0)),confidence=measured.source==='observed-team'?.8:.25,p50Hours=killQuantile(probability,successes,.5)/measured.value,p90Hours=killQuantile(probability,successes,.9)/measured.value*(measured.source==='observed-team'?1.1:1.5),budgetHours=context.confidence==='p90'?p90Hours:hours;
  if(budgetHours<=maxHours&&(!eventInfo.ends||Date.now()+budgetHours*3600000<eventInfo.ends))result.push({monster,item,quantity,estimatedHours:hours,selectedHours:budgetHours,p50Hours,p90Hours,confidence,quantileModel:successes<=128?'bernoulli-conservative-yield':'normal-estimate',sourceKind:event?'event-drop':meta?.quest?'quest-drop':'monster-drop',event:event??null,eventExpires:eventInfo.ends,rateSource:measured.source,killsPerHour:measured.value});
 }return result.sort((a,b)=>a.selectedHours-b.selectedHours||a.estimatedHours-b.estimatedHours||a.monster.localeCompare(b.monster)).slice(0,10);
}

// One verified source contract is shared by route selection and the dispatch guard.
// Quest exchanges must have a concrete location in the current game definitions;
// a missing quest workstation is never substituted with the generic exchange NPC.
export function exchangeSource(G,item,state={},now=Date.now()){
 const meta=G.items?.[item];if(!meta)return {ready:false,reason:'EXCHANGE_SOURCE_MISSING'};
 const quest=typeof meta.quest==='string'?meta.quest.trim():null;
 if(meta.quest&&!quest)return {ready:false,reason:'QUEST_SOURCE_DESTINATION_UNVERIFIED'};
 let npc=null,destination=null,evidence='GENERIC_EXCHANGE';
 if(quest){
  const direct=G.quests?.[quest];
  if(typeof direct?.map==='string'&&Number.isFinite(direct.x)&&Number.isFinite(direct.y)&&!G.maps?.[direct.map]?.ignore){
   destination={map:direct.map,x:direct.x,y:direct.y};npc=typeof direct.id==='string'?direct.id:null;evidence='G_QUESTS_COORDINATE';
  }else{
   for(const [mapName,map] of Object.entries(G.maps??{})){
    if(map?.ignore)continue;
    for(const row of Array.isArray(map?.npcs)?map.npcs:[]){
     const id=Array.isArray(row)?row[0]:row?.id??row?.name;
     if(typeof id!=='string'||G.npcs?.[id]?.quest!==quest)continue;
     const pos=Array.isArray(row?.position)?row.position:null;
     const x=Array.isArray(row)?row[1]:row?.x??pos?.[0],y=Array.isArray(row)?row[2]:row?.y??pos?.[1];
     if(!Number.isFinite(x)||!Number.isFinite(y))continue;
     npc=id;destination={map:mapName,x,y};evidence='G_NPC_QUEST_MAPPING';break;
    }
    if(destination)break;
   }
  }
  if(!destination)return {ready:false,reason:'QUEST_SOURCE_DESTINATION_UNVERIFIED',quest};
 }
 const event=typeof meta.event==='string'?meta.event.trim():null;
 if(meta.event&&!event)return {ready:false,reason:'EVENT_SOURCE_UNVERIFIED',quest};
 let eventExpires=null;
 if(event){
  if(!Object.hasOwn(G.events??{},event)&&!Object.hasOwn(state??{},event))return {ready:false,reason:'EVENT_SOURCE_UNVERIFIED',quest,event};
  const live=materialEvent({events:{[event]:{}}},event,state,now);
  if(!live.active)return {ready:false,reason:'EVENT_SOURCE_INACTIVE',quest,event,eventExpires:live.ends};
  eventExpires=live.ends;
 }
 return {ready:true,quest,npc,destination,evidence,event,eventExpires};
}

export function expectedMonsterGold(G,id){const base=Number(G.monster_gold?.[id]??G.monsters?.[id]?.gold??0),d=G.drops?.gold;return (Number.isFinite(base)?base:0)*(Number.isFinite(d?.base)?d.base+(Number(d.random)||0)/2:1)+materialDrops(G,G.drops?.monsters?.[id]).filter(r=>r.item==='gold').reduce((n,r)=>n+r.chance*r.quantity,0);}
