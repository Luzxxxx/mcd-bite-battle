import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalog, rounds, LEGACY_DATA_VERSION, DATA_VERSION } from '../web/data.mjs';
import { chooseOpponent, evaluatePlan } from '../web/engine.mjs';
import { descriptorFor, resolveDescriptor, encodeChallenge, decodeChallenge } from '../web/challenge.mjs';
import { validateModelProfile } from '../web/model-services.mjs';
import { newTicketKey, prepareVisitorRound, revealVisitorRound } from '../lib/visitor-arena.mjs';

const plan = [{ offerId: 'chicken-fries', variantId: 'default', quantity: 1 }, { offerId: 'single-cola-m', variantId: 'default', quantity: 1 }];
const profile = { service: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'fixture-model', apiKey: 'fixture-visitor-secret' };
const challenge = descriptorFor(rounds[0]);
const toolResponse = name => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'tool', type: 'function', function: { name, arguments: JSON.stringify({ plan, couponId: null }) } }] } }] }));
const modelFetch = async (url, options) => {
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  assert.equal(options.redirect, 'error');
  assert.equal(options.body.includes('fixture-visitor-secret'), false);
  const request = JSON.parse(options.body);
  return toolResponse(request.messages.some(m => m.role === 'tool') ? 'submit_plan' : 'quote_plan');
};
test('模型接口严格验证服务、域名和 HTTPS，不接受任意代理地址', () => {
  assert.equal(validateModelProfile(profile).endpoint, 'https://api.deepseek.com/chat/completions');
  assert.equal(validateModelProfile({ ...profile, baseUrl: 'https://api.deepseek.com/v1/chat/completions' }).endpoint, 'https://api.deepseek.com/v1/chat/completions');
  for (const baseUrl of ['http://api.deepseek.com', 'https://127.0.0.1', 'https://api.deepseek.com.evil.test', 'https://user:pass@api.deepseek.com', 'https://api.deepseek.com?key=secret', 'https://api.deepseek.com:444']) assert.throws(() => validateModelProfile({ ...profile, baseUrl }));
  assert.throws(() => validateModelProfile({ ...profile, apiKey: 'key\nsecret' }));
  assert.throws(() => validateModelProfile({ ...profile, model: 'model with spaces' }));
  assert.equal(validateModelProfile({ ...profile, service: 'custom', baseUrl: 'https://models.example.test/v1' }, ['models.example.test']).endpoint, 'https://models.example.test/v1/chat/completions');
});
test('服务商专属参数只发送给匹配的服务', () => {
  assert.equal(validateModelProfile(profile).disableThinking, true);
  assert.equal(validateModelProfile({ ...profile, service: 'custom' }).disableThinking, true);
  const qwen = validateModelProfile({ ...profile, service: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' });
  assert.equal(qwen.disableThinking, false); assert.equal(qwen.endpoint, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
});
test('票据跨请求揭晓原方案，不返回密钥；承诺可独立核对', async () => {
  const key = newTicketKey();
  const prepared = await prepareVisitorRound({ challenge, profile, key, subject: 'visitor-a', fetchImpl: modelFetch });
  assert.equal(JSON.stringify(prepared).includes(profile.apiKey), false);
  assert.equal('plan' in prepared, false);
  const reveal = await revealVisitorRound({ ticket: prepared.ticket, plan, couponId: null, key, subject: 'visitor-a' });
  assert.equal(reveal.player.quote.totalCents, 2590);
  assert.deepEqual(reveal.opponent.plan, plan);
  assert.equal(createHash('sha256').update(JSON.stringify({ plan, couponId: null, nonce: reveal.opponentNonce })).digest('hex'), prepared.opponentCommitment);
  const encrypted = Buffer.from(prepared.ticket, 'base64url');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: encrypted.subarray(0, 12), additionalData: new TextEncoder().encode('mcd-bite-battle/visitor-training/v1') }, await crypto.subtle.importKey('raw', Buffer.from(key, 'base64url'), 'AES-GCM', false, ['decrypt']), encrypted.subarray(12));
  assert.equal(new TextDecoder().decode(plain).includes(profile.apiKey), false);
});
test('篡改、换身份、换密钥、过期票据以及不完整餐袋均拒绝判胜', async () => {
  const key = newTicketKey(), prepared = await prepareVisitorRound({ challenge, profile, key, subject: 'a', fetchImpl: modelFetch });
  const request = { ticket: prepared.ticket, plan, key, subject: 'a' };
  const bytes = Buffer.from(prepared.ticket, 'base64url'); bytes[20] ^= 1;
  await assert.rejects(revealVisitorRound({ ...request, ticket: bytes.toString('base64url') }), /票据/);
  await assert.rejects(revealVisitorRound({ ...request, subject: 'b' }), /身份/);
  await assert.rejects(revealVisitorRound({ ...request, key: newTicketKey() }), /票据/);
  await assert.rejects(revealVisitorRound({ ...request, plan: plan.slice(0, 1) }), /不判胜/);
  const originalNow = Date.now; Date.now = () => originalNow() + 16 * 60 * 1000;
  try { await assert.rejects(revealVisitorRound(request), /过期/); } finally { Date.now = originalNow; }
});
test('不同玩家的模型密钥与方案相互隔离', async () => {
  const authorizations = new Set(), key = newTicketKey();
  await Promise.all(['visitor-one-key', 'visitor-two-key'].map(apiKey => prepareVisitorRound({ challenge, profile: { ...profile, apiKey }, key, subject: apiKey, fetchImpl: async (url, options) => { authorizations.add(options.headers.Authorization); assert.equal(options.body.includes(apiKey), false); return modelFetch(url, options); } })));
  assert.deepEqual([...authorizations].sort(), ['Bearer visitor-one-key', 'Bearer visitor-two-key']);
});
test('模型失败不回显上游密钥或任意响应内容', async () => {
  await assert.rejects(prepareVisitorRound({ challenge, profile, key: newTicketKey(), fetchImpl: async () => new Response(profile.apiKey, { status: 401 }) }), error => error.message.includes('401') && !error.message.includes(profile.apiKey));
  await assert.rejects(prepareVisitorRound({ challenge, profile, key: newTicketKey(), fetchImpl: async () => new Response('x'.repeat(1_000_001)) }), /过大/);
});
test('扩展餐品六类八题均能组出预算内的完全同餐，单点可用于自由题', () => {
  assert.equal(catalog.foods.length, 20); assert.equal(catalog.offers.length, 37); assert.equal(catalog.categories.length, 6); assert.equal(rounds.length, 8);
  for (const round of rounds) { const opponent = chooseOpponent(round, catalog); assert.ok(opponent, round.id); assert.equal(evaluatePlan(opponent.plan, opponent.couponId, round, catalog).valid, true); }
  const custom = resolveDescriptor({ v: 1, data: DATA_VERSION, type: 'training', id: 'custom', target: [{ foodId: 'wings', quantity: 1 }, { foodId: 'shake', quantity: 1 }], budgetCents: 4000 });
  assert.ok(chooseOpponent(custom.round, custom.catalog));
});
test('旧邀请固定旧菜单，新餐品不能混入旧版本', () => {
  const legacy = decodeChallenge('#challenge=' + encodeChallenge({ ...challenge, data: LEGACY_DATA_VERSION, benchmark: { plan, couponId: null } }));
  assert.equal(legacy.catalog.offers.length, 15); assert.equal(legacy.benchmark.totalCents, 2590); assert.equal(descriptorFor(legacy.round).data, LEGACY_DATA_VERSION);
  assert.throws(() => resolveDescriptor({ v: 1, type: 'training', data: LEGACY_DATA_VERSION, id: 'custom', target: [{ foodId: 'wings', quantity: 1 }], budgetCents: 4000 }));
  assert.throws(() => resolveDescriptor({ ...challenge, data: LEGACY_DATA_VERSION, id: 'breakfast' }));
});
