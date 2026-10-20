// Read-only Adventure Land observations for the private telemetry bridge.
// No network calls, tokens, persistence, bank mutation or sale authority here.
// A bank pack is evidence for that observed map only; never account completeness.
const telemetryItemId=value=>typeof value==='string'&&/^[a-zA-Z0-9_]{1,100}$/.test(value);
const telemetryMapId=value=>typeof value==='string'&&/^[a-zA-Z0-9_]{1,80}$/.test(value);
const telemetryRealmId=value=>typeof value==='string'&&/^[a-zA-Z0-9_]{1,60}$/.test(value);
const telemetrySafeInt=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const telemetryUnknownRate=0; // EXP/h and Gold/h require separate trusted measured evidence.
function telemetryInventorySlots(items,limit,exact=null){
 if(!Array.isArray(items)||items.length>limit||
    exact!==null&&items.length!==exact)return null;
 const out=[];
 for(let slot=0;slot<items.length;slot++){
  const entry=items[slot];
  if(entry===null||entry===undefined){out.push(null);continue;}
  const q=entry?.q??1,level=entry?.level??0;
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||
     !telemetryItemId(entry.name)||!telemetrySafeInt(q,1,10000000)||!telemetrySafeInt(level,0,99))
   return null;
  out.push({name:entry.name,q,level});
 }
 return out;
}
export function observedCharacterTelemetry(character,realm){
 if(!character||typeof character!=='object'||!telemetryItemId(character.name)||
    !telemetryRealmId(realm)||!telemetryMapId(character.map)||
    !telemetrySafeInt(character.level,1,999))return null;
 const inventory=telemetryInventorySlots(character.items,50);
 if(!inventory)return null;
 const hp=character.hp,mp=character.mp,
  maxHp=character.max_hp??character.maxHp,
  maxMp=character.max_mp??character.maxMp,
  x=character.real_x??character.x,y=character.real_y??character.y;
 if(![hp,mp,maxHp,maxMp,x,y].every(Number.isFinite)||
    [hp,mp,maxHp,maxMp].some(value=>value<0))return null;
 return {version:1,kind:'character',data:{
  name:character.name,realm,map:character.map,level:character.level,
  hp,mp,maxHp,maxMp,x,y,inventory,
  expPerHour:telemetryUnknownRate,goldPerHour:telemetryUnknownRate,ratesMeasured:false
 }};
}
export function observedBankTelemetry(character,realm,definitions){
 if(!character||!telemetryRealmId(realm)||!['bank','bank_b','bank_u'].includes(character.map)||
    !character.bank||typeof character.bank!=='object'||
    !definitions||typeof definitions!=='object')return [];
 const out=[];
 const packs=Object.keys(character.bank).filter(key=>/^items\d{1,2}$/.test(key));
 if(packs.length>48)return [];
 packs.sort((a,b)=>Number(a.slice(5))-Number(b.slice(5)));
 for(const pack of packs){
  const map=definitions[pack]?.[0]??(/^items[0-7]$/.test(pack)?'bank':null);
  if(map!==character.map)continue;
  const slots=telemetryInventorySlots(character.bank[pack],42,42);
  if(!slots)continue;
  out.push({version:1,kind:'bank',data:{pack,map,realm,slots}});
  if(out.length===24)break;
 }
 return out;
}
