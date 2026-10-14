export function assessServerHop(server,history,now,policy){if(!server||!Number.isFinite(server.at)||server.at>now||now-server.at>60000)return {allowed:false,reason:'Registry fehlt/veraltet'};if(server.online!==true)return {allowed:false,reason:'Server nicht als online bestätigt'};const mode=server.mode;if(!['NORMAL','PVP','HARDCORE','TEST','DUNGEON'].includes(mode))return {allowed:false,reason:'Servermodus unbekannt'};if(mode!=='NORMAL'||/pvp/i.test(String(server.realm??''))||/pvp/i.test(String(server.name??'')))return {allowed:false,reason:'PvP-/Sondermodus gesperrt'};const window=history.filter(t=>now-t<3600000);if(window.length>=3||window.length&&now-Math.max(...window)<policy.cooldown)return {allowed:false,reason:'Wechselfenster/Cooldown ausgeschöpft'};return {allowed:true,reason:'Frische Registry, erlaubter Modus und Wechselbudget'};}

export function assessHomeSpawn({realm,home,enteredAt,now,pressure,checkMs=90000,threshold=.65}={}){
 if(realm!==home)return {state:'away',reason:'Nicht auf Heimrealm'};
 if(!Number.isFinite(enteredAt)||enteredAt<=0||now-enteredAt<Math.max(60000,checkMs))
  return {state:'checking',reason:'Spawnbeobachtung läuft'};
 if(!Number.isFinite(pressure)||pressure<0||pressure>1)
  return {state:'checking',reason:'Kein belastbarer Druckwert'};
 return pressure>=threshold?
  {state:'crowded',reason:'Anhaltend blockierter oder überfüllter Farmspawn'}:
  {state:'settled',reason:'Heimspawn mit vertretbarem Farmdruck'};
}
export function chooseHomeFallback(registry,current,home,prior,allowed){
 const options=registry.filter(s=>s.realm!==home&&s.realm!==current&&!/pvp/i.test(String(s.realm??''))&&allowed(s.realm)&&
   s.online&&s.mode==='NORMAL'&&Number.isFinite(s.players)&&s.players>=0);
 return options.sort((a,b)=>Number(b.realm===prior)-Number(a.realm===prior)||
   a.players-b.players||a.realm.localeCompare(b.realm))[0]?.realm??null;
}
