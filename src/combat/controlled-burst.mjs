import {damageMultiplier} from './damage-model.mjs';
// Positive integer allocations, one ID once, one base fee, at most 16 targets.
// Reflection and one-hit monsters require their own adapters and are excluded.
export function controlledBurstPlan(character,targets,skill,{
 budget,reserve=.2,maxTargets=16,primary=null
}={}){
 if(!Number.isFinite(budget)||budget<1||!Number.isFinite(reserve)||reserve<0||reserve>1||
    !Number.isFinite(skill?.ratio)||skill.ratio<=0||
    !Number.isFinite(character?.mp)||!Number.isFinite(character?.max_mp))return [];
 let remaining=Math.floor(Math.min(budget,character.mp-character.max_mp*reserve-(skill.mp??0)));
 const limit=Number.isSafeInteger(maxTargets)?Math.max(1,Math.min(16,maxTargets)):1;
 const seen=new Set(),rows=[];
 for(const m of (targets??[]).slice(0,128)){
  if(!m?.id||seen.has(m.id)||m.type!=='monster'||!Number.isFinite(m.hp)||m.hp<=0||
     m.dead||m.rip||m['1hp']||m.immune||m.invincible||(m.reflection??0)>0)continue;
  seen.add(m.id);
  const factor=damageMultiplier((m.resistance??0)-(character.rpiercing??0));
  if(!(factor>0))continue;
  const need=Math.ceil(m.hp/(skill.ratio*factor*.9));
  if(Number.isSafeInteger(need)&&need>0)rows.push({id:m.id,need});
 }
 rows.sort((a,b)=>a.need-b.need||Number(b.id===primary)-Number(a.id===primary));
 const result=[];
 for(const row of rows){if(row.need>remaining)continue;
  result.push([row.id,row.need]);remaining-=row.need;if(result.length===limit)break;}
 if(!result.length&&remaining>0){
  const row=rows.find(r=>r.id===primary);
  if(row)result.push([row.id,Math.min(remaining,row.need)]);
 }
 return result;
}
