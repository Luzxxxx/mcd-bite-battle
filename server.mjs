import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LiveArena } from './lib/live-arena.mjs';
import { redact } from './lib/mcp-client.mjs';
import { TrainingArena } from './lib/training-arena.mjs';
import { modelConfiguration } from './lib/model-opponent.mjs';
import { newTicketKey, prepareVisitorRound, revealVisitorRound, visitorOpponent } from './lib/visitor-arena.mjs';

const root = fileURLToPath(new URL('./web/', import.meta.url));
const port = Number(process.env.PORT || 4318);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
let arena;
const trainingArena = new TrainingArena();
const ticketKey = process.env.ARENA_TICKET_KEY || newTicketKey();
const additionalHosts = (process.env.MODEL_API_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
let preparing = false;
async function prepareOnce(action) {
  if (preparing) throw new Error('正在准备一局对战，请等待完成后再试');
  preparing = true;
  try { return await action(); } finally { preparing = false; }
}
function sendJson(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(value)); }
async function bodyOf(request) { let text = ''; for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 32768) throw new Error('请求内容过大'); } return JSON.parse(text || '{}'); }
const server = createServer(async (request, response) => {
  try {
    const host = request.headers.host ?? '';
    if (!new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(host)) return sendJson(response, 403, { error: '仅允许本机访问' });
    if (request.headers.origin && !new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]).has(request.headers.origin)) return sendJson(response, 403, { error: '不允许跨站调用本机接入' });
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/status' && request.method === 'GET') return sendJson(response, 200, { tokenConfigured: !!process.env.MCD_MCP_TOKEN?.trim(), liveEnabled: true, byokEnabled: true, deepseek: modelConfiguration() });
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'POST') return sendJson(response, 405, { error: '请求方法不支持' });
      const body = await bodyOf(request);
      if (url.pathname === '/api/model/prepare') return sendJson(response, 200, await prepareOnce(() => body.profile ? prepareVisitorRound({ ...body, key: ticketKey, additionalHosts }) : trainingArena.prepare(body.challenge)));
      if (url.pathname === '/api/model/reveal') return sendJson(response, 200, body.ticket ? await revealVisitorRound({ ...body, key: ticketKey }) : trainingArena.reveal(body.roundId, body.plan, body.couponId));
      if (!process.env.MCD_MCP_TOKEN?.trim()) return sendJson(response, 400, { error: '本机尚未配置 MCD_MCP_TOKEN' });
      arena ??= new LiveArena(process.env.MCD_MCP_TOKEN);
      const routes = { '/api/live/stores': () => arena.searchStores(body), '/api/live/menu': () => arena.menu(body.storeCode), '/api/live/prepare': () => prepareOnce(() => arena.prepare(body.caseId, { storeCode: body.storeCode, mealCode: body.mealCode, opponent: body.opponent, model: body.profile ? visitorOpponent(body.profile, { additionalHosts }) : undefined })), '/api/live/quote': () => arena.quote(body.roundId, body.plan), '/api/live/reveal': () => arena.reveal(body.roundId, body.plan) };
      if (!routes[url.pathname]) return sendJson(response, 404, { error: '接口不存在' });
      return sendJson(response, 200, await routes[url.pathname]());
    }
    if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: '请求方法不支持' });
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(resolve(root) + sep) || path.includes('\0')) return sendJson(response, 403, { error: '路径不可访问' });
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT') sendJson(response, 404, { error: '文件不存在' });
    else sendJson(response, 400, { error: redact(error.message) });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}\nToken configured: ${!!process.env.MCD_MCP_TOKEN?.trim()}\nRead-only live MCP endpoints available locally.`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
