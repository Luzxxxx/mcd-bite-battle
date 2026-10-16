import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = 'http://127.0.0.1:' + port;
const env = { ...process.env, PORT: String(port) };
for (const name of ['MCD_MCP_TOKEN', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'ARENA_TICKET_KEY', 'MODEL_API_ALLOWED_HOSTS']) delete env[name];
const child = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
let startup = '';
child.stdout.on('data', value => { startup += value; });
child.stderr.on('data', value => { startup += value; });
let launchError;
child.on('error', error => { launchError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error('Server exited before readiness: ' + startup);
    try { ready = (await fetch(origin + '/api/status', { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Server did not become ready');
  const status = await (await fetch(origin + '/api/status')).json();
  assert.equal(status.tokenConfigured, false);
  assert.equal(status.deepseek.configured, false);
  assert.equal(status.byokEnabled, true);
  let assets = 0;
  for (const file of await readdir('web')) {
    const response = await fetch(origin + '/' + file);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), await readFile('web/' + file, 'utf8'));
    assets++;
  }
  const index = await fetch(origin);
  assert.equal(index.status, 200);
  assert.ok(index.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.equal((await fetch(origin, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(origin, { headers: { Origin: 'https://example.test' } })).status, 403);
  assert.equal((await fetch(origin + '/.env')).status, 404);
  assert.equal((await fetch(origin + '/missing-file')).status, 404);
  assert.equal((await fetch(origin + '/api/live/menu', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}' })).status, 400);
  console.log(JSON.stringify({ cleanStartup: 'passed without env or installed packages', staticAssets: assets, secretFileNotServed: true, crossOriginBlocked: true, missingMcpHandled: true }, null, 2));
} finally {
  if (child.exitCode === null && !launchError) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
