import {VERSION} from './version.mjs';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {parseData,validateSchema,validateProfile,addMissingDefaults} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from './config/live-a.mjs';
import {chooseRule,variantCount,protectedItem,distance,samePlace} from './core/policy.mjs';
import {Executor} from './core/executor.mjs';
import {createPorts} from './runtime/ports.mjs';
import {createMovement} from './core/movement.mjs';
import {createTransport} from './party/transport.mjs';
import {createLogistics} from './items/logistics.mjs';
import {createSkills} from './combat/skills.mjs';
import {createFarmer} from './combat/farmer.mjs';
import {createPanel} from './ui/panel.mjs';
export function install(root){
  root.ALBot?.dispose?.();
  const p=createPorts(root),now=()=>Date.now();
  function validate(value){
    const errors=validateSchema(LIVE_DESCRIPTOR.schema,value);if(errors.length)return errors;
    const full=addMissingDefaults(DESCRIPTOR.schema,value);
    errors.push(...validateProfile(DESCRIPTOR,full));
    if(value.characters.filter(c=>c.enabled&&c.role==='farmer'&&c.group===value.party.group).length>value.party.maxFarmers)errors.push('Mehr aktive Farmer als maxFarmers.');
    if(value.characters.some(c=>c.enabled&&c.group!==value.party.group))errors.push('Live A benötigt eine gemeinsame Gruppenkennung.');
    if(value.characters.filter(c=>c.enabled&&c.role==='merchant').length>1)errors.push('Live A verwendet genau einen zuständigen Merchant.');
    const merchant=value.characters.find(c=>c.enabled&&c.role==='merchant');if(merchant&&value.merchant.enabled&&value.party.merchant!==merchant.name)errors.push('Zuständigen Merchant unter Gruppe & Skills auswählen.');
    if(value.party.leader&&!value.characters.some(c=>c.enabled&&c.name===value.party.leader&&c.role==='farmer'))errors.push('Leader muss aktiver Farmer sein.');
    if(value.items.some(r=>r.enabled&&r.action==='send'&&(!r.recipient||!value.characters.some(c=>c.enabled&&c.name===r.recipient))))errors.push('Lieferempfänger muss aktiv konfiguriert sein.');
    return errors;
  }
  let cfg;try{cfg=parseData(JSON.stringify(root.ALBotConfig));const errors=validate(cfg);if(errors.length)throw Error(errors.join('; '));}catch(e){p.log('Konfiguration ungültig: '+e.message);root.ALBot={version:VERSION,status:()=>({state:'invalid',reason:e.message})};return;}
  const me=cfg.characters.find(c=>c.name===p.c?.name&&c.enabled);
  if(!me){p.log('Eigenen Namen zuerst in der Werkstatt aktivieren.');root.ALBot={version:VERSION,status:()=>({state:'unconfigured'})};return;}
  const team=cfg.characters.filter(c=>c.enabled&&c.group===me.group),farmers=team.filter(c=>c.role==='farmer').map(c=>c.name).sort();
  const key='albot:live-a:'+me.name+':checkpoint';let timer=null,generation=0,disposed=false,lastEconomy=0,lastPlanning=0,lastHeartbeat=0,reportText='',reportTime=0,panel;
  const stored=p.read(key),journal=stored?.journal??null;
  const bot={p,cfg,me,session:me.name+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8),running:false,reason:'Bereit für Live A',target:null,teamNames:team.map(c=>c.name),farmers,leader:cfg.party.leader||farmers[0]||me.name,journal,inventoryBlocked:!!journal,
    report(message){if(message!==reportText||now()-reportTime>10000){reportText=message;reportTime=now();p.log(message);}},
    free(){return p.c.items?.filter(i=>!i).length??0;},count(name){return (p.c.items??[]).reduce((n,i)=>n+(i?.name===name?(i.q??1):0),0);},
    entity(id){if(id===me.name)return p.c;const e=p.entities[id]??Object.values(p.entities).find(e=>e.name===id);return e?{...e,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}:null;},
    monsters(){return Object.entries(p.entities).filter(([,e])=>e.type==='monster'&&!e.dead&&!e.rip&&e.hp>0).map(([id,e])=>({...e,id:e.id??id,map:e.map??p.c.map,in:e.in??p.c.in??p.c.map}));},
    allies(){return bot.teamNames.map(n=>bot.entity(n)).filter(e=>e&&samePlace(p.c,e));},
    targets(){return me.farmTargets.length?me.farmTargets:cfg.farming.targets;},
    allowed(e){if(!e||e.type!=='monster'||e.dead||e.rip||e.hp<=0||e.invincible||!samePlace(p.c,e)||!bot.targets().includes(e.mtype))return false;if(cfg.farming.avoidOthers&&e.target&&!bot.teamNames.includes(e.target))return false;const threats=Object.values(p.entities).filter(x=>x.type==='monster'&&x.hp>0&&bot.teamNames.includes(x.target)).length;return !!e.target||threats<cfg.farming.maxAggro;},
    rule(i){return chooseRule(cfg.items,i,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:me.role==='merchant'?'supply':'farm'});},
    consumable(i){if(protectedItem(i))return false;const r=bot.rule(i);return !r||(r.action==='consume'&&variantCount(p.c.items,i)>r.keep+r.teamReserve);},
    canConsumeImplicit(name){if(bot.inventoryBlocked||bot.logistics?.reserved)return false;const first=p.c.items.find(i=>i?.name===name);return !!first&&bot.consumable(first);},
    beginValue(j){if(bot.journal)throw Error('Andere Inventaraktion offen');bot.journal={...j,at:now()};if(!p.write(key,{journal:bot.journal})){bot.inventoryBlocked=true;throw Error('Checkpoint konnte nicht gespeichert werden');}},
    endValue(result){if(result==='confirmed'){bot.journal=null;p.write(key,{journal:null});}else {bot.inventoryBlocked=true;bot.reason='Inventaraktion ungeklärt: Bestand prüfen';if(cfg.general.pauseOnUnknown&&bot.running)bot.pause(bot.reason);}},
    measure(){return {hpRatio:p.c.hp/p.c.max_hp,mpRatio:p.c.mp/p.c.max_mp,freeSlots:bot.free(),gold:p.c.gold,enemyCount:bot.monsters().filter(e=>distance(p.c,e)<p.c.range).length,map:p.c.map,rip:!!p.c.rip,task:me.role==='merchant'?'supply':'farm',count:bot.count};}
  };
  const exec=new Executor({now,active:()=>bot.running,limit:cfg.general.maxPending,onError:(key,e)=>bot.report(key+': '+(e?.reason??e?.message??e))});bot.exec=exec;
  bot.movement=createMovement(bot);bot.transport=createTransport(bot);bot.logistics=createLogistics(bot);bot.skills=createSkills(bot);bot.farmer=createFarmer(bot);
  const cleanup=[];
  const inviteAllowed=name=>bot.running&&cfg.party.enabled&&name===bot.leader&&bot.teamNames.includes(name)&&!p.c.party;
  cleanup.push(p.hook('on_party_invite',name=>{if(inviteAllowed(name))exec.run('party',['party'],()=>inviteAllowed(name),()=>p.call('accept_party_invite',name),{delay:3000});}));
  cleanup.push(p.hook('on_party_request',name=>{if(bot.running&&cfg.party.enabled&&me.name===bot.leader&&farmers.includes(name))exec.run('party',['party'],()=>bot.running,()=>p.call('accept_party_request',name),{delay:3000});}));
  function publish(){try{p.call('set_message',(bot.running?'ALBot ':'PAUSE ')+bot.reason.slice(0,50));}catch{}panel?.render();}
  function halt(reason){bot.running=false;generation++;clearTimeout(timer);timer=null;bot.movement.stop();exec.invalidate();bot.logistics.close();bot.target=null;bot.reason=reason;publish();bot.report(reason);}
  bot.pause=(reason='Pause')=>halt(reason);
  function tick(gen){if(disposed||!bot.running||gen!==generation)return;try{
    if(!p.c||!p.G){bot.reason='Spielzustand fehlt';return;}
    exec.poll();bot.movement.poll();
    if(!bot.running)return;
    if(now()-lastHeartbeat>=2000){lastHeartbeat=now();bot.transport.heartbeat();}
    const economyDue=now()-lastEconomy>=cfg.general.economyTickMs;if(economyDue)lastEconomy=now();bot.logistics.poll(economyDue);
    if(!bot.running)return;
    bot.farmer.tick();
    if(now()-lastPlanning>=cfg.general.planningTickMs){lastPlanning=now();bot.logistics.travel();if(cfg.party.enabled&&me.name===bot.leader)for(const name of farmers){const e=bot.entity(name);if(name!==me.name&&(!e||e.party!==p.c.party||!p.c.party))exec.run('invite:'+name,['party'],()=>bot.running,()=>p.call('send_party_invite',name),{delay:10000});}}
    publish();
  }catch(e){bot.pause('Fehler: '+(e.message??e));bot.report(bot.reason);}finally{if(bot.running&&gen===generation)timer=root.setTimeout(()=>tick(gen),cfg.general.combatTickMs);}}
  const api={version:VERSION,schemaId:LIVE_DESCRIPTOR.schemaId,
    start(){
      if(disposed)return false;if(bot.running)return true;
      const deny=reason=>{bot.reason=reason;publish();bot.report(reason);return false;};
      if(me.class!=='auto'&&me.class!==p.c.ctype)return deny('Konfigurierte Klasse stimmt nicht');
      if(me.region+me.server!==p.realm())return deny('Falscher Realm: erwartet '+me.region+me.server);
      if(cfg.general.transport==='ipc'&&!p.ipc)return deny('Lokale IPC nicht verfügbar');
      if(bot.inventoryBlocked&&cfg.general.pauseOnUnknown)return deny('Offene Inventaraktion zuerst abgleichen');
      bot.running=true;bot.reason='Start';generation++;tick(generation);return bot.running;
    },
    pause:()=>halt('Pause'),stop:()=>halt('STOP'),
    status:()=>({version:VERSION,profile:cfg.general.name,running:bot.running,environment:p.headless?'headless':'browser',ipc:p.ipc,name:me.name,role:me.role,reason:bot.reason,target:bot.target?.id??null,pending:exec.pending.size,inventoryBlocked:bot.inventoryBlocked,journal:bot.journal?structuredClone(bot.journal):null}),
    acknowledgeInventory(){if(bot.running)throw Error('Zuerst pausieren und tatsächlichen Bestand prüfen');if(!p.write(key,{journal:null}))throw Error('Speichern fehlgeschlagen');bot.journal=null;bot.inventoryBlocked=false;bot.reason='Inventar manuell abgeglichen';publish();},
    dispose(){if(disposed)return;halt('Entladen');disposed=true;bot.transport.close();cleanup.splice(0).forEach(f=>f());panel?.remove();}
  };
  root.ALBot=api;panel=createPanel(bot,api);cleanup.push(p.hook('on_destroy',()=>api.dispose()));
  if(JSON.stringify(cfg).length<16000)p.write(key+':config',cfg);
  p.log(VERSION+' · '+(p.headless?'Headless':'Browser')+' · '+me.role+' · Live A noch ausstehend');publish();if(cfg.general.autostart)api.start();return api;
}
