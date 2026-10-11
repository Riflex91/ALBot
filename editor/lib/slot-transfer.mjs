// Transfer preparation for the official Adventure Land VS Code sync folder.
// This module has no network or account access and never claims remote success.
export function planSlotFiles(config,mappingText){
 const names=(config?.characters??[]).filter(c=>c?.enabled).map(c=>c.name);
 if(!names.length)throw Error('Keine aktiven Charaktere konfiguriert.');
 if(new Set(names).size!==names.length)throw Error('Charakternamen müssen eindeutig sein.');
 const seen=new Set(),files=new Map(),rows=[];
 for(const raw of String(mappingText??'').split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const match=/^([^=]+)=([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_]{1,32})$/.exec(line);
  if(!match)throw Error('CODE-Zuordnung ungültig: '+line);
  const name=match[1].trim(),codeName=match[2],slot=match[3];
  if(!names.includes(name)||seen.has(name))throw Error('Unbekannter/doppelter Charakter: '+name);
  if(slot==='0'||/^\d+$/.test(slot)&&(+slot<1||+slot>99))throw Error('Kein zulässiger benannter Slot: '+slot);
  seen.add(name);
  const filename=codeName+'.'+slot+'.js';
  if(!files.has(filename))files.set(filename,{filename,characters:[]});
  files.get(filename).characters.push(name);
  rows.push({character:name,codeName,slot,filename});
 }
 const missing=names.filter(name=>!seen.has(name));
 if(missing.length)throw Error('CODE-Zuordnung fehlt für: '+missing.join(', '));
 return {files:[...files.values()],assignments:rows};
}
export async function updateLocalSyncFiles(folder,files,code){
 if(!folder||typeof folder.getFileHandle!=='function')throw Error('Kein CODE-Ordner ausgewählt.');
 if(!files?.length||typeof code!=='string'||!code.trim())throw Error('Kein gültiger CODE-Export.');
 const jobs=[];
 // Verify every source is already present before writing a single byte.
 for(const file of files){
  const filename=file.filename;
  if(!/^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_]{1,32}\.js$/.test(filename))throw Error('Ungültiger CODE-Dateiname: '+filename);
  let handle;
  try{handle=await folder.getFileHandle(filename,{create:false});}
  catch{throw Error('CODE-Datei fehlt im synchronisierten Ordner: '+filename+'. Erst mit der offiziellen VS-Code-Erweiterung vom Server laden.');}
  const previous=await (await handle.getFile()).text();
  jobs.push({filename,handle,previous});
 }
 const results=[];
 for(const job of jobs){
  if(job.previous===code){results.push({filename:job.filename,state:'identical'});continue;}
  const backupName=job.filename+'.'+new Date().toISOString().replace(/[:.]/g,'-')+'.backup.txt';
  const backup=await folder.getFileHandle(backupName,{create:true});
  const backupWriter=await backup.createWritable();await backupWriter.write(job.previous);await backupWriter.close();
  if(await (await backup.getFile()).text()!==job.previous)throw Error('CODE-Backup fehlgeschlagen: '+job.filename);
  const writer=await job.handle.createWritable();
  await writer.write(code);await writer.close();
  if(await (await job.handle.getFile()).text()!==code)throw Error('Lokale CODE-Schreibprüfung fehlgeschlagen: '+job.filename);
  results.push({filename:job.filename,state:'local-verified',backup:backupName});
 }
 return results; // NOT proof of remote sync, game slot, or running CODE.
}
