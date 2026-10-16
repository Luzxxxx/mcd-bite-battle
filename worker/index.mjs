import { assets } from 'site-assets';
import { prepareVisitorRound, revealVisitorRound } from '../lib/visitor-arena.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function bodyOf(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('请使用 JSON 请求');
  const reader = request.body?.getReader();
  let size = 0, chunks = [];
  if (reader) try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 32768) throw new Error('请求内容过大'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes) || '{}');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin');
        if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '请从本站发起对战' }, 403);
        if (url.pathname === '/api/status' && request.method === 'GET') return json({ byokEnabled: !!env.ARENA_TICKET_KEY, tokenConfigured: false, liveEnabled: false, deepseek: { configured: false } });
        if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405);
        if (url.pathname.startsWith('/api/live/')) return json({ error: '真实门店核价请使用本机版，并配置自己的 MCP Token' }, 400);
        const body = await bodyOf(request);
        const subject = request.headers.get('oai-authenticated-user-id') || '';
        if (url.pathname === '/api/model/prepare') return json(await prepareVisitorRound({ challenge: body.challenge, profile: body.profile, key: env.ARENA_TICKET_KEY, subject, additionalHosts: (env.MODEL_API_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean) }));
        if (url.pathname === '/api/model/reveal') return json(await revealVisitorRound({ ticket: body.ticket, plan: body.plan, couponId: body.couponId, key: env.ARENA_TICKET_KEY, subject }));
        return json({ error: '接口不存在' }, 404);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: '请求方法不支持' }, 405);
      const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
      if (!asset) return json({ error: '文件不存在' }, 404);
      return new Response(request.method === 'HEAD' ? null : asset.content, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'" } });
    } catch (error) { return json({ error: error instanceof SyntaxError ? '请求格式无效' : error.message || '请求未完成，请重试' }, 400); }
  }
};
