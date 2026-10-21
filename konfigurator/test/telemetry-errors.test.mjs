import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('dashboard shows API failures instead of misreporting zero characters',async()=>{
 const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(source,/telemetryErrors:\{characters:null,bank:null\}/);
 assert.match(source,/acceptTelemetryResult\('characters',chars\)/);
 assert.match(source,/acceptTelemetryResult\('bank',bank\)/);
 assert.match(source,/observation\.characters\.available\?/);
 assert.match(source,/observation\.bank\.available\?/);
 assert.match(source,/Charakterabfrage fehlgeschlagen/);
 assert.match(source,/Der ALBot-Direktsender überträgt/);
 assert.doesNotMatch(source,/if\(chars\.status==='fulfilled'\)state\.characters=/);
 assert.doesNotMatch(source,/if\(bank\.status==='fulfilled'\)state\.bank=/);
});
test('dashboard never polls the Worker more often due to diagnostic UI',async()=>{
 const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(source,/setInterval\(refreshLive,DASHBOARD_REFRESH_MS\)/);
 assert.match(source,/if\(document\.visibilityState==='hidden'\|\|refreshingLive\)return/);
});
