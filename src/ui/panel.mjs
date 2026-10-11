import {VERSION} from '../version.mjs';
import {inspectMiningJournal} from '../core/journal-audit.mjs';
export function createPanel(bot,api){
  if(bot.p.headless||!bot.cfg.general.ui)return {render(){},remove(){}};
  const doc=bot.p.parent.document;if(!doc?.body)return {render(){},remove(){}};
  const node=doc.createElement('section');node.id='albot-panel-'+bot.me.name;
  node.style.cssText='position:fixed;right:8px;top:45px;z-index:9999;background:#10211e;color:#eef8f4;border:1px solid #69ae90;padding:10px;font:13px sans-serif;max-width:300px';
  const title=doc.createElement('strong');title.textContent='ALBot '+VERSION+' · '+bot.me.name;const status=doc.createElement('p');node.append(title,status);
  for(const [label,action] of [['Start',()=>api.start()],['Pause',()=>api.pause()],['STOP',()=>api.stop()],...(bot.cfg.general.testLogging?[['Testordner wählen',()=>api.chooseLogDirectory()]]:[]),['Testlog speichern',()=>api.exportTestReport()]]){const b=doc.createElement('button');b.textContent=label;if(label==='Testordner wählen'&&!api.logCapabilities().directory){b.textContent='Ordnerauswahl nicht verfügbar';b.disabled=true;b.title='Testlog speichern verwenden. Den Desktop als Downloadziel im Browser einstellen.';}else b.onclick=action;node.append(b);}
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
  if(bot.cfg.general.testLogging){
   const check=doc.createElement('button');check.textContent='Mining-Journal prüfen';
   const acknowledge=doc.createElement('button');acknowledge.textContent='Nach Prüfung manuell freigeben';acknowledge.disabled=true;
   const auditText=doc.createElement('pre');auditText.style.cssText='white-space:pre-wrap;max-width:280px;word-break:break-word';
   let reviewed=false;
   check.onclick=()=>{
    const result=inspectMiningJournal(bot);
    reviewed=!!result.eligible;
    acknowledge.disabled=!reviewed;
    auditText.textContent='Journal: '+(result.kind??'keines')+'\nInventar identisch: '+result.inventoryEqual+'\nGold identisch: '+result.goldEqual+'\n'+result.reason+'\n'+(reviewed?'Keine Mining-Erfolgsbestätigung; Freigabe ausschließlich nach eigener Prüfung.':'Freigabe gesperrt');
   };
   acknowledge.onclick=()=>{
    const result=inspectMiningJournal(bot);
    if(!reviewed||!result.eligible){reviewed=false;acknowledge.disabled=true;auditText.textContent='Freigabe gesperrt: Zustand verändert oder nicht geeignet';return;}
    if(bot.p.parent.confirm?.('ACHTUNG: Der Mining-Erfolg ist UNGEKLÄRT. Nur fortfahren, wenn du den aktuellen Bestand selbst mit dem Vorherzustand abgeglichen hast. Das Journal wird manuell bestätigt und nicht erneut ausgeführt.')){
     try{api.acknowledgeInventory();reviewed=false;acknowledge.disabled=true;auditText.textContent='Journal nach manueller Bestätigung freigegeben. Keine automatische Mining-Wiederholung.';}catch(e){auditText.textContent='Keine Freigabe: '+e.message;}
    }
   };
   node.append(check,acknowledge,auditText);
  }
  if(bot.cfg.general.testLogging&&!api.logCapabilities().directory){const hint=doc.createElement('p');hint.textContent='Logs per „Testlog speichern“ herunterladen. Speicherort in den Browser-Downloads wählen.';node.append(hint);}
  doc.body.append(node);return {render(){const text=bot.me.role+' · '+(bot.running?'Aktiv':'Angehalten')+' · '+bot.reason;if(status.textContent!==text)status.textContent=text;},remove(){node.remove();}};
}
