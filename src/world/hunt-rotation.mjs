// Deterministic, per-character hunt evidence. Never infer a quest from the
// picture, the current target or a different player's status.
export function normalizedHunt(q){
 if(q===null||q===undefined)return null;
 if(typeof q.id!=='string'||!q.id||!Number.isSafeInteger(q.c)||q.c<0)return undefined;
 return {id:q.id,c:q.c};
}
export function huntForFarmer(name,localName,localStatus,peer,realm){
 if(name===localName)return normalizedHunt(localStatus);
 if(!peer||peer.running!==true||peer.rip||peer.realm!==realm||
   !Object.prototype.hasOwnProperty.call(peer,'monsterhunt'))return undefined;
 return normalizedHunt(peer.monsterhunt);
}
export function advanceHuntCycle(state,roster,hunt){
 const names=roster.filter(n=>typeof n==='string'&&n);
 const valid=state&&JSON.stringify(state.names)===JSON.stringify(names)&&
   Number.isSafeInteger(state.index)&&state.index>=0&&state.index<names.length;
 const current=valid?{...state}:{names,index:0,phase:'acquire',lastId:null};
 if(!names.length)return {state:current,objective:null,changed:false};
 if(hunt===undefined)return {state:current,objective:{owner:names[current.index],phase:'unknown'},changed:!valid};
 let next={...current};
 if(next.phase==='turnin'&&(hunt===null||hunt.c>0&&hunt.id!==next.lastId)){
  next.index=(next.index+1)%names.length;next.phase='acquire';next.lastId=null;
 }else if(hunt&&hunt.c===0){next.phase='turnin';next.lastId=hunt.id;}
 else if(hunt&&hunt.c>0){next.phase='combat';next.lastId=hunt.id;}
 const changed=JSON.stringify(next)!==JSON.stringify(state);
 return {state:next,objective:{owner:names[next.index],phase:next.phase},changed};
}
