import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalog, rounds } from '../web/data.mjs';
import { evaluatePlan } from '../web/engine.mjs';
import { descriptorFor } from '../web/challenge.mjs';
import { DeepSeekOpponent } from '../lib/model-opponent.mjs';
import { TrainingArena } from '../lib/training-arena.mjs';
import { sealPlan } from '../lib/commitment.mjs';

const plan = [{ offerId: 'chicken-fries', variantId: 'default', quantity: 1 }, { offerId: 'single-cola-m', variantId: 'default', quantity: 1 }];
const args = { plan, couponId: null };
const tool = (name, value = args, id = 'tool-1') => ({ id, type: 'function', function: { name, arguments: JSON.stringify(value) } });
const reply = calls => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] }), { status: 200 });
const choose = model => model.choose({ round: rounds[0], catalog, source: 'training', evaluate: async (p, c) => evaluatePlan(p, c, rounds[0], catalog) });

test('模型必须通过受限工具核价，再提交已核验方案；密钥只在鉴权头', async () => {
  const requests = [];
  const model = new DeepSeekOpponent({ apiKey: 'fixture-secret', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
    assert.equal(options.body.includes('fixture-secret'), false);
    requests.push(JSON.parse(options.body));
    return requests.length === 1 ? reply([tool('quote_plan')]) : reply([tool('submit_plan')]);
  } });
  const result = await choose(model);
  assert.equal(result.quote.totalCents, 2590);
  assert.equal(result.meta.kind, 'llm'); assert.equal(result.meta.quoteCount, 1);
  assert.equal(requests[1].messages.at(-1).role, 'tool');
  assert.equal(requests[1].messages.at(-1).content.includes('2590'), true);
});
test('模型未知交易工具不会执行任何报价', async () => {
  let evaluated = false;
  const model = new DeepSeekOpponent({ apiKey: 'fixture', fetchImpl: async () => reply([tool('create_order')]) });
  await assert.rejects(model.choose({ round: rounds[0], catalog, source: 'official', evaluate: async () => { evaluated = true; } }), /未允许/);
  assert.equal(evaluated, false);
});
test('未报价直接提交不能开始对局，即使模型反复坚持也有调用上限', async () => {
  let requests = 0;
  const model = new DeepSeekOpponent({ apiKey: 'fixture', fetchImpl: async () => { requests++; return reply([tool('submit_plan')]); } });
  await assert.rejects(choose(model), /未在本局/);
  assert.equal(requests, 5);
});
test('第四次报价在执行前被拒绝', async () => {
  let evaluated = 0;
  const model = new DeepSeekOpponent({ apiKey: 'fixture', fetchImpl: async () => reply([1, 2, 3, 4].map(i => tool('quote_plan', args, `q-${i}`))) });
  await assert.rejects(model.choose({ round: rounds[0], catalog, source: 'training', evaluate: async () => { evaluated++; return evaluatePlan(plan, null, rounds[0], catalog); } }), /3次/);
  assert.equal(evaluated, 3);
});
test('错误餐袋不能提交，HTTP 错误不回显服务商响应或密钥', async () => {
  const wrong = { plan: plan.slice(0, 1), couponId: null };
  let count = 0;
  const model = new DeepSeekOpponent({ apiKey: 'fixture', fetchImpl: async () => ++count === 1 ? reply([tool('quote_plan', wrong)]) : reply([tool('submit_plan', wrong)]) });
  await assert.rejects(choose(model));
  const denied = new DeepSeekOpponent({ apiKey: 'do-not-echo', fetchImpl: async () => new Response('do-not-echo', { status: 401 }) });
  await assert.rejects(choose(denied), error => error.message.includes('401') && !error.message.includes('do-not-echo'));
});
test('承诺绑定完整计划、券和随机数，修改方案无法复用承诺', () => {
  const seal = sealPlan(plan, null);
  const digest = (p, couponId) => createHash('sha256').update(JSON.stringify({ plan: p, couponId, nonce: seal.nonce })).digest('hex');
  assert.equal(digest(plan, null), seal.commitment);
  assert.notEqual(digest(plan.slice(0, 1), null), seal.commitment);
  assert.notEqual(digest(plan, 'other-coupon'), seal.commitment);
});
test('训练模型在选餐前封存，揭晓验证相同原方案，非法玩家餐袋不能判胜', async () => {
  const arena = new TrainingArena({ model: { choose: async () => ({ ...evaluatePlan(plan, null, rounds[0], catalog), ...args, meta: { kind: 'llm', name: 'Fixture' } }) } });
  const prepared = await arena.prepare(descriptorFor(rounds[0]));
  assert.equal('opponent' in prepared, false); assert.equal('plan' in prepared, false);
  const revealed = arena.reveal(prepared.roundId, plan, null);
  const expected = createHash('sha256').update(JSON.stringify({ plan: revealed.opponent.plan, couponId: revealed.opponent.couponId, nonce: revealed.opponentNonce })).digest('hex');
  assert.equal(expected, prepared.opponentCommitment);
  assert.equal(revealed.player.quote.totalCents, revealed.opponent.quote.totalCents);
  assert.throws(() => arena.reveal(prepared.roundId, plan.slice(0, 1), null), /不判胜/);
});
