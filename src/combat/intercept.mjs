// A bounded lead point, never an unbounded quadratic extrapolation.
// a≈0, stationary entities and missing motion data all have finite fallbacks.
export function boundedInterceptPoint(character,target,{range=0,horizon=1.2}={}){
 const x=target?.real_x??target?.x,y=target?.real_y??target?.y;
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const base={x,y};
 if(!target.moving||!Number.isFinite(target.going_x)||!Number.isFinite(target.going_y)||
    !Number.isFinite(target.speed)||target.speed<=0||!Number.isFinite(character?.speed)||
    character.speed<=0||!Number.isFinite(horizon)||horizon<0||horizon>2)return base;
 const cx=character.real_x??character.x,cy=character.real_y??character.y;
 if(!Number.isFinite(cx)||!Number.isFinite(cy))return base;
 const dx=target.going_x-x,dy=target.going_y-y,len=Math.hypot(dx,dy);
 if(len<.001)return base;
 const time=Math.min(horizon,Math.max(0,Math.hypot(x-cx,y-cy)-Math.max(0,range))/character.speed);
 const step=Math.min(len,target.speed*time,60);
 return {x:x+dx/len*step,y:y+dy/len*step};
}
