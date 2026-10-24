export function knowledgeFingerprint(value){const raw=JSON.stringify(value??null);let h=2166136261;for(let i=0;i<raw.length;i++)h=Math.imul(h^raw.charCodeAt(i),16777619);return (h>>>0).toString(16);}
export function spawnLocations(G,types,excluded=[],pvp=false){const rows=[];for(const [map,data] of Object.entries(G.maps??{})){if(data.ignore||data.instance||excluded.includes(map)||data.pvp&&!pvp)continue;for(const [index,pack] of (data.monsters??[]).entries()){if(!types.includes(pack.type))continue;for(const range of pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[])){const [place,x1,y1,x2,y2]=range;if(!G.maps[place]||G.maps[place].instance||excluded.includes(place)||G.maps[place].pvp&&!pvp||![x1,y1,x2,y2].every(Number.isFinite))continue;rows.push({key:place+':'+pack.type+':'+index+':'+knowledgeFingerprint(range),target:pack.type,map:place,in:place,bounds:range,x:(x1+x2)/2,y:(y1+y2)/2,count:Math.max(1,pack.count??1),radius:60,definition:knowledgeFingerprint([G.monsters[pack.type],range])});}}}return rows;}
export function mapGraph(G){const edges=[];for(const [from,m] of Object.entries(G.maps??{}))for(const d of m.doors??[]){if(Array.isArray(d)&&typeof d[4]==='string'&&G.maps[d[4]])edges.push({from,to:d[4],x:d[0],y:d[1]});}for(const [from,m] of Object.entries(G.maps??{}))for(const npc of m.npcs??[])if(npc.id==='transporter'&&Array.isArray(npc.position))for(const to of Object.keys(G.npcs?.transporter?.places??{}))if(G.maps[to]&&to!==from)edges.push({from,to,x:npc.position[0],y:npc.position[1],transport:true});return {definition:knowledgeFingerprint(edges),edges};}
// Safety admission for autonomous FARM transit. The game owns the physical
// smart_move route; map-graph hops are NOT proof of the chosen physical route.
// Fail closed if an aggressive/unknown intermediate map is on ANY shortest
// portal route. No NPC purchase, boss approval or attack permission comes from
// this estimate. Same-map farming retains its normal combat-risk admission.
export function farmTransitAdmission(G,graph,from,to,excluded=[]){
 if(typeof from!=='string'||typeof to!=='string'||
    !G?.maps?.[from]||!G.maps[to]||
    !Array.isArray(graph?.edges))return {allowed:false,reason:'missing-map-evidence'};
 if(from===to)return {allowed:true,reason:'same-map'};
 const forbidden=new Set(Array.isArray(excluded)?excluded:[]);
 const hazardous=map=>{
  if(map===from||map===to)return false;
  const d=G.maps[map];
  if(!d||d.ignore||d.instance||d.pvp||forbidden.has(map))return true;
  if(!Array.isArray(d.monsters))return true;
  return d.monsters.some(pack=>{
   const meta=G.monsters?.[pack?.type];
   return !meta||meta.aggro===true||
    typeof meta.aggro==='number'&&meta.aggro>0;
  });
 };
 const edges=graph.edges.filter(e=>typeof e?.from==='string'&&
    typeof e?.to==='string'&&G.maps[e.from]&&G.maps[e.to]);
 // Two-state BFS preserves the shortest clean and contaminated portal paths.
 // An equally short dangerous choice must also be rejected: the native
 // navigator is not obliged to choose the clean path from this abstract graph.
 const queue=[{map:from,distance:0,danger:null}];
 const seen=new Set([from+':clean']);
 let clean=Infinity,dirty=Infinity,firstDanger=null;
 for(let i=0;i<queue.length;i++){
  const node=queue[i];
  if(node.distance>Math.min(clean,dirty))continue;
  if(node.map===to){
   if(node.danger){if(node.distance<dirty){dirty=node.distance;firstDanger=node.danger;}}
   else clean=Math.min(clean,node.distance);
   continue;
  }
  for(const edge of edges){
   if(edge.from!==node.map||edge.to===from||
      forbidden.has(edge.to)||G.maps[edge.to]?.pvp||
      G.maps[edge.to]?.instance||G.maps[edge.to]?.ignore)continue;
   const danger=node.danger??(hazardous(edge.to)?edge.to:null);
   const key=edge.to+':'+(danger?'dirty':'clean');
   if(seen.has(key))continue;
   seen.add(key);queue.push({map:edge.to,distance:node.distance+1,danger});
  }
 }
 if(!Number.isFinite(clean))return {allowed:false,
  reason:'no-verified-nonaggressive-portal-route',hazard:firstDanger};
 if(dirty<=clean)return {allowed:false,
  reason:'shortest-route-may-enter-hostile-map',hazard:firstDanger};
 return {allowed:true,reason:'no-known-hostile-shortest-transit',hops:clean};
}
export function mapHops(graph,from,to){if(from===to)return 0;const queue=[[from,0]],seen=new Set([from]);while(queue.length){const [m,n]=queue.shift();for(const e of graph.edges.filter(e=>e.from===m)){if(e.to===to)return n+1;if(!seen.has(e.to)){seen.add(e.to);queue.push([e.to,n+1]);}}}return Infinity;}

// Only combat-relevant, deterministic gear properties belong in a learning
// identity. Heartbeat timestamps, sessions, current health and volatile buffs
// are freshness evidence, not a change to the equipment being measured.
export function semanticGear(gear){
 if(!gear||typeof gear!=='object')return null;
 const slots=Object.entries(gear.slots??{}).sort(([a],[b])=>a.localeCompare(b))
  .map(([slot,item])=>[slot,item?[
   item.name??'',item.level??0,item.stat_type??'',item.p??'',item.title??'',
   !!item.l,!!item.b
  ]:null]);
 const stats=Object.entries(gear.stats??{}).filter(([,v])=>Number.isFinite(v))
  .sort(([a],[b])=>a.localeCompare(b));
 return [gear.class??'',gear.level??0,gear.complete===true,slots,stats];
}
