import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { default: worker } = await import(new URL('../dist/server/index.js', import.meta.url));

const origin = 'https://example.test';
const env = {};
const call = (path, init) => worker.fetch(new Request(origin + path, init), env);
let assets = 0;
for (const file of await readdir('web')) {
  const response = await call('/' + file);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), await readFile('web/' + file, 'utf8'));
  assets++;
}
assert.equal((await call('/')).status, 200);
assert.equal(await (await call('/', { method: 'HEAD' })).text(), '');
const status = await (await call('/api/status')).json();
assert.equal(status.liveEnabled, false);
assert.equal(status.byokEnabled, false);
const json = { 'Content-Type': 'application/json', Origin: origin };
assert.equal((await call('/api/live/menu', { method: 'POST', headers: json, body: '{}' })).status, 400);
assert.equal((await call('/api/model/prepare', { method: 'POST', headers: { ...json, Origin: 'https://other.test' }, body: '{}' })).status, 403);
assert.equal((await call('/api/model/prepare', { method: 'POST', headers: json, body: '{' })).status, 400);
assert.equal((await call('/missing')).status, 404);
assert.equal((await call('/.env')).status, 404);
console.log(JSON.stringify({ workerFetch: 'passed', embeddedAssets: assets, crossOriginBlocked: true, invalidInputHandled: true, liveModeDisabled: true, noTicketKeyDisablesByok: true }, null, 2));
