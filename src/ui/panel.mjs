import {VERSION} from '../version.mjs';
export function createPanel(bot,api){
  if(bot.p.headless||!bot.cfg.general.ui)return {render(){},remove(){}};
  const doc=bot.p.parent.document;if(!doc?.body)return {render(){},remove(){}};
  const node=doc.createElement('section');node.id='albot-panel-'+bot.me.name;
  node.style.cssText='position:fixed;right:8px;top:45px;z-index:9999;background:#10211e;color:#eef8f4;border:1px solid #69ae90;padding:10px;font:13px sans-serif;max-width:300px';
  // A dedicated drag handle avoids stealing clicks from Start/Pause/STOP or
  // requiring native browser chrome. Store each character's own viewport
  // position; a resized window clamps the previous coordinates on reload.
  const title=doc.createElement('strong');title.textContent='ALBot '+VERSION+' · '+bot.me.name+' · Verschieben';
  title.style.cssText='display:block;cursor:move;user-select:none;touch-action:none;padding:4px 2px 9px';
  const status=doc.createElement('p');node.append(title,status);
  const positionKey='albot:ui:position:'+bot.me.name;
  const viewport=()=>({width:doc.documentElement?.clientWidth??doc.defaultView?.innerWidth??1024,
    height:doc.documentElement?.clientHeight??doc.defaultView?.innerHeight??768});
  const clamp=(x,y)=>{const v=viewport(),w=Math.max(160,node.offsetWidth??280),h=Math.max(60,node.offsetHeight??150);
    return {x:Math.max(0,Math.min(Math.max(0,v.width-w),x)),y:Math.max(0,Math.min(Math.max(0,v.height-h),y))};};
  const position=(x,y)=>{const p=clamp(x,y);node.style.left=p.x+'px';node.style.top=p.y+'px';node.style.right='auto';return p;};
  let drag=null;
  const onMove=event=>{if(!drag)return;const next=position(drag.x+(event.clientX-drag.clientX),drag.y+(event.clientY-drag.clientY));
    drag.last=next;event.preventDefault?.();};
  const onUp=event=>{if(!drag)return;if(event?.pointerId!=null&&drag.id!=null&&event.pointerId!==drag.id)return;
    const last=drag.last;drag=null;if(last)bot.p.write?.(positionKey,last);};
  const startDrag=event=>{if(event.button!=null&&event.button!==0)return;
    const rect=node.getBoundingClientRect(),at=position(rect.left,rect.top);
    drag={id:event.pointerId,x:at.x,y:at.y,clientX:event.clientX,clientY:event.clientY,last:at};
    event.preventDefault?.();};
  title.addEventListener('pointerdown',startDrag);
  doc.addEventListener('pointermove',onMove);doc.addEventListener('pointerup',onUp);
  doc.addEventListener('pointercancel',onUp);

  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()],...(bot.cfg.general.testLogging&&api.logCapabilities().directory?[['Testordner wählen',()=>api.chooseLogDirectory()]]:[]),['Testlog speichern',()=>api.exportTestReport()]]){const b=doc.createElement('button');b.textContent=label;b.onclick=action;node.append(b);}
  if(bot.cfg.general.testLogging){
   const button=doc.createElement('button');button.textContent='Party/Kampf prüfen + speichern';
   button.title='Liest Party, Heartbeats und Kampfstatistik; lädt einen kleinen JSON-Bericht herunter. Keine Spielaktion.';
   const result=doc.createElement('pre');
   result.style.cssText='white-space:pre-wrap;word-break:break-word;max-width:280px;max-height:150px;overflow:auto;font:12px monospace';
   button.onclick=()=>{
    try{
     const d=api.teamCheck(),file=api.exportTeamCheck();
     const peers=d.peers.filter(p=>p.fresh).map(p=>p.name).join(', ')||'keine';
     result.textContent='Party: '+(d.gameParty??'keine')+'\nAuswahl: '+d.selectedFarmers.join(', ')+'\nLeader: '+d.teamLeader+'\nFrische Peers: '+peers+'\nAngriffe: '+d.combat.attacksStarted+'\n'+(file?'Bericht: '+file:'Download fehlgeschlagen – Testlog speichern verwenden');
    }catch(e){result.textContent='Teamtest fehlgeschlagen: '+(e.message??e);}
   };
   node.append(button,result);
  }
  if(bot.cfg.general.testLogging&&!api.logCapabilities().directory){const hint=doc.createElement('p');hint.textContent='Logs per „Testlog speichern“ herunterladen. Speicherort in den Browser-Downloads wählen.';node.append(hint);}
  doc.body.append(node);const saved=bot.p.read?.(positionKey);
  if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))position(saved.x,saved.y);
  return {render(){const text=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;if(status.textContent!==text)status.textContent=text;},remove(){drag=null;title.removeEventListener('pointerdown',startDrag);doc.removeEventListener('pointermove',onMove);doc.removeEventListener('pointerup',onUp);doc.removeEventListener('pointercancel',onUp);node.remove();}};
}
