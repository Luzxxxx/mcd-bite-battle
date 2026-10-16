import test from 'node:test';
import assert from 'node:assert/strict';
import { rounds, DATA_VERSION } from '../web/data.mjs';
import { descriptorFor, encodeChallenge, decodeChallenge, resolveDescriptor, challengeURL } from '../web/challenge.mjs';

const plan = [{ offerId: 'chicken-fries', variantId: 'default', quantity: 1 }, { offerId: 'single-cola-m', variantId: 'default', quantity: 1 }];
test('同题链接往返保留规则，邀请者金额由合法方案重新计算', () => {
  const descriptor = { ...descriptorFor(rounds[0]), benchmark: { plan, couponId: null, totalCents: 1 } };
  const invitation = decodeChallenge(`#challenge=${encodeChallenge(descriptor)}`);
  assert.deepEqual(invitation.round.target, rounds[0].target);
  assert.equal(invitation.benchmark.totalCents, 2590);
  assert.equal(JSON.stringify(invitation.descriptor).includes('totalCents'), false);
  assert.ok(challengeURL(descriptor, 'https://example.test').startsWith('https://example.test/#challenge='));
});
test('链接不能用少一份餐、换规格或非法券伪造低价成绩', () => {
  for (const benchmark of [{ plan: plan.slice(0, 1), couponId: null }, { plan: [{ offerId: 'chicken-set', variantId: 'small', quantity: 1 }], couponId: null }, { plan, couponId: 'set-500' }]) assert.throws(() => resolveDescriptor({ ...descriptorFor(rounds[0]), benchmark }), /无法验证/);
});
test('拒绝错版本、超长、乱码和未知自由题食品，普通页面锚点不影响玩法', () => {
  assert.equal(decodeChallenge('#arena'), null);
  assert.throws(() => resolveDescriptor({ ...descriptorFor(rounds[0]), data: 'old-version' }));
  assert.throws(() => decodeChallenge('#challenge=' + 'x'.repeat(9000)));
  assert.throws(() => decodeChallenge('#challenge=%3Cscript%3E'));
  assert.throws(() => resolveDescriptor({ v: 1, data: DATA_VERSION, type: 'training', id: 'custom', target: [{ foodId: '<script>', quantity: 1 }], budgetCents: 4000 }));
});
test('自由题可复现，重复食品与超过五份不能绕过限制', () => {
  const input = { v: 1, data: DATA_VERSION, type: 'training', id: 'custom', target: [{ foodId: 'coffee', quantity: 1 }, { foodId: 'pie', quantity: 1 }], budgetCents: 4000 };
  assert.deepEqual(decodeChallenge('#challenge=' + encodeChallenge(input)).round.target.map(i => i.foodId), ['coffee', 'pie']);
  assert.throws(() => resolveDescriptor({ ...input, target: [{ foodId: 'pie', quantity: 1 }, { foodId: 'pie', quantity: 1 }] }));
  assert.throws(() => resolveDescriptor({ ...input, target: [{ foodId: 'coffee', quantity: 2 }, { foodId: 'pie', quantity: 2 }, { foodId: 'chicken', quantity: 2 }] }));
});
test('真实邀请不包含历史报价、密钥或模型答案', () => {
  const input = { v: 1, type: 'live', caseId: 'chicken', storeCode: '1450713', storeName: '上海测试餐厅', city: '上海', apiKey: 'never-share', priceCents: 1, opponentPlan: plan };
  const value = decodeChallenge('#challenge=' + encodeChallenge(input));
  assert.equal(value.live, true);
  assert.equal(value.descriptor.storeCode, '1450713');
  assert.equal(JSON.stringify(value).includes('never-share'), false);
  assert.equal('priceCents' in value.descriptor, false);
});
