// Fail-closed audit of the exact Worker static-asset directory before upload.
// This is a local build guard, not proof of Cloudflare Access policy in production.
import {readdir,readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';

const SAFE_EXT=/\.(?:html|css|js|mjs|json|txt|svg|png|jpe?g|webp|gif|ico)$/i;
const TEXT_EXT=/\.(?:html|css|js|mjs|json|txt|svg)$/i;
const BLOCKED_NAME=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.git|.*\.(?:pem|key|p12|pfx|map|zip|sqlite|db)|.*(?:private[-_]?signed[-_]?release|private[-_]?key|credentials|secret).*|profile\.json)$/i;
const SECRET_MARKERS=[
 /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
 /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,})\b/,
 /["'](?:CONFIG_SIGNING_JWK|GITHUB_TOKEN|INGEST_TOKEN)["']\s*:\s*["'][^"']{16,}["']/,
 /"kty"\s*:\s*"EC"[\s\S]{0,500}"d"\s*:\s*"[A-Za-z0-9_-]{43}"/
];
export async function auditPublicAssets(directory){
 const root=resolve(directory),issues=[];
 async function walk(current){
  for(const entry of await readdir(current,{withFileTypes:true})){
   const path=resolve(current,entry.name);
   const name=relative(root,path).split(sep).join('/');
   if(entry.name==='.gitignore')continue;
   if(entry.isSymbolicLink()){issues.push(name+': symbolic links forbidden');continue;}
   const stat=await lstat(path);
   if(stat.isDirectory()){await walk(path);continue;}
   if(!stat.isFile()||!SAFE_EXT.test(name)||BLOCKED_NAME.test(name)){
    issues.push(name+': non-public file path or extension');continue;
   }
   if(stat.size>4_000_000){issues.push(name+': oversized public asset');continue;}
   if(!TEXT_EXT.test(name))continue;
   const source=await readFile(path,'utf8');
   if(SECRET_MARKERS.some(re=>re.test(source)))
    issues.push(name+': secret/private-key material pattern');
  }
 }
 await walk(root);
 return issues;
}
const isCLI=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCLI){
 const root=fileURLToPath(new URL('../public/',import.meta.url));
 const issues=await auditPublicAssets(root);
 if(issues.length)throw Error('Cloudflare static-asset security gate rejected: '+issues.join('; '));
 console.log('Cloudflare static-asset security gate PASS (no disallowed files or secret patterns).');
}
