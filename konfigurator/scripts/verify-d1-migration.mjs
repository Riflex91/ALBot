// Offline, deterministic guard for the ONLY permitted manual D1 migration.
// Never accesses Cloudflare or any secret. Use before remote D1 changes.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const CANONICAL_SIGNED_HIGHWATER_DDL=`CREATE TABLE IF NOT EXISTS signed_config_highwater (
 target TEXT PRIMARY KEY NOT NULL,
 key_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence > 0),
 sha256 TEXT NOT NULL,
 release_sha TEXT NOT NULL,
 updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);`;

export function verifySignedHighwaterMigration({migration,schema,wrangler}){
 if([migration,schema,wrangler].some(s=>typeof s!=='string'))
  throw Error('Migration source missing');
 const statements=migration.replace(/--[^\n]*/g,'').trim();
 if(statements!==CANONICAL_SIGNED_HIGHWATER_DDL)
  throw Error('D1 migration contains unexpected or destructive SQL');
 if(!schema.includes(CANONICAL_SIGNED_HIGHWATER_DDL))
  throw Error('D1 migration differs from committed canonical schema');
 // Only the existing named D1 binding matters. The separate Static
 // Assets binding also uses "binding", so never scan the whole TOML file.
 const sections=wrangler.split('[[d1_databases]]');
 if(sections.length!==2)
  throw Error('Cloudflare D1 target or DB binding drifted');
 const d1=sections[1].split(/\n(?=\[)/)[0];
 const fields=d1.split('\n').map(x=>x.trim())
  .filter(x=>x.length>0&&!x.startsWith('#')).sort();
 const expected=[
  'binding = "DB"',
  'database_name = "albot-konfigurator"',
  'database_id = "880c96b9-f6c5-4167-bfe2-6d6d0c55edf2"'
 ].sort();
 if(fields.length!==expected.length||
  fields.some((x,index)=>x!==expected[index]))
  throw Error('Cloudflare D1 target or DB binding drifted');
 return {checked:true,database:'albot-konfigurator',
  table:'signed_config_highwater',scope:'additive-only',applied:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=new URL('../',import.meta.url);
  const migration=readFileSync(new URL('migrations/001_signed_config_highwater.sql',root),'utf8');
  const schema=readFileSync(new URL('schema.sql',root),'utf8');
  const wrangler=readFileSync(new URL('wrangler.toml',root),'utf8');
  const result=verifySignedHighwaterMigration({migration,schema,wrangler});
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){
  process.stderr.write('Signed publication migration preflight failed: '+
   String(error.message).slice(0,180)+'\n');
  process.exitCode=1;
 }
}
