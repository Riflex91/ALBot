// Adapted from v3 elixir-policy: weighted nested drop tables, bounded recursion.
export function materialDrops(G,table,multiplier=1,seen=new Set()){
 const rows=[];if(seen.size>8)return rows;
 for(const row of Array.isArray(table)?table:[]){if(!Array.isArray(row)||!(row[0]>0)||typeof row[1]!=='string')continue;
  if(row[1]==='open'&&Array.isArray(G.drops?.[row[2]])&&!seen.has(row[2])){const children=G.drops[row[2]],total=children.reduce((n,r)=>n+(Number(r[0])||0),0);if(total>0)rows.push(...materialDrops(G,children,multiplier*row[0]/total,new Set([...seen,row[2]])));}
  else if(row[1]!=='open')rows.push({item:row[1],chance:row[0]*multiplier,quantity:Math.max(1,Number(row[2])||1)});
 }return rows;
}
export function materialSources(G,item,quantity,allowedMonsters,maxHours){
 const result=[];for(const monster of allowedMonsters){const yieldPerKill=materialDrops(G,G.drops?.monsters?.[monster]).filter(x=>x.item===item).reduce((n,x)=>n+x.chance*x.quantity,0);
  if(!(yieldPerKill>0))continue;const hours=quantity/(20*yieldPerKill); // conservative estimate, not a measured rate
  if(hours<=maxHours)result.push({monster,item,quantity,estimatedHours:hours});
 }return result.sort((a,b)=>a.estimatedHours-b.estimatedHours).slice(0,10);
}
