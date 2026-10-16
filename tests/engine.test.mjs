import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, rounds } from '../web/data.mjs';
import { compareBags, quoteDemo, evaluatePlan, chooseOpponent, verdict, searchEquivalentPlans, itemKey } from '../web/engine.mjs';
const line = (offerId, variantId = 'default', quantity = 1) => ({ offerId, variantId, quantity });

test('同样一袋餐，混搭可以战胜只比较完整套餐的入门对手', () => {
  const plan = [line('chicken-fries'), line('single-cola-m')];
  const player = evaluatePlan(plan, null, rounds[0]);
  const opponent = chooseOpponent(rounds[0]);
  assert.equal(player.valid, true); assert.equal(player.quote.totalCents, 2590);
  assert.equal(opponent.quote.totalCents, 2990);
  assert.deepEqual(verdict(player, opponent), { status: 'win', label: '这局，你更会点。', differenceCents: 400 });
});
test('把中薯换成小薯即使更便宜也不能判胜', () => {
  const evaluation = evaluatePlan([line('chicken-set', 'small')], null, rounds[0]);
  assert.equal(evaluation.valid, false);
  assert.equal(evaluation.comparison.missing[0].foodId, 'fries-m');
  assert.equal(evaluation.comparison.extra[0].foodId, 'fries-s');
  assert.equal(verdict(evaluation, chooseOpponent(rounds[0])).status, 'invalid');
});
test('无糖与普通可乐不能视为等价', () => {
  const evaluation = evaluatePlan([line('chicken-set', 'cola')], null, rounds[1]);
  assert.equal(evaluation.valid, false);
  assert.equal(evaluation.comparison.missing[0].foodId, 'zero-m');
});
test('额外加购与重复数量均被标为餐袋不一致', () => {
  for (const extra of [line('single-pie'), line('single-cola-m')]) {
    const result = evaluatePlan([line('chicken-set', 'cola'), extra], null, rounds[0]);
    assert.equal(result.valid, false); assert.equal(result.comparison.extra.length, 1);
  }
});
test('真实定制要求参与等价判断，属性顺序不影响等价', () => {
  const a = { foodId: 'burger', quantity: 1, customizations: { sauce: false, ice: 'less' } };
  const b = { foodId: 'burger', quantity: 1, customizations: { ice: 'less', sauce: false } };
  assert.equal(itemKey(a), itemKey(b)); assert.equal(compareBags([a], [b]).equal, true);
  assert.equal(compareBags([a], [{ ...b, customizations: { ice: 'less', sauce: true } }]).equal, false);
});
test('拆分的重复份数与合并份数能正确比较', () => {
  const a = { foodId: 'same', quantity: 1 };
  assert.equal(compareBags([a, a], [{ ...a, quantity: 2 }]).equal, true);
  assert.equal(compareBags([a], [{ ...a, quantity: 2 }]).equal, false);
});
test('未达到券门槛、券适用商品不符、非本局券都拒绝', () => {
  assert.throws(() => quoteDemo([line('chicken-fries'), line('single-zero-m')], 'set-500', rounds[1].couponIds), /门槛/);
  assert.throws(() => quoteDemo([line('chicken-drink', 'zero'), line('single-fries-m')], 'set-500', rounds[1].couponIds), /没有/);
  assert.throws(() => quoteDemo([line('chicken-set', 'zero')], 'set-500', []), /本局/);
});
test('同条件用券得到平局，未用券的合法方案可以输', () => {
  const ai = chooseOpponent(rounds[1]);
  const tie = evaluatePlan([line('chicken-set', 'zero')], 'set-500', rounds[1]);
  assert.equal(tie.valid, true); assert.equal(tie.quote.totalCents, 2490); assert.equal(verdict(tie, ai).status, 'tie');
  const loss = evaluatePlan([line('chicken-fries'), line('single-zero-m')], null, rounds[1]);
  assert.equal(verdict(loss, ai).status, 'loss');
});
test('超预算不能参与有效对决', () => {
  const result = evaluatePlan([line('single-chicken'), line('single-fries-m'), line('single-cola-m')], null, rounds[0]);
  assert.equal(result.comparison.equal, true); assert.equal(result.overBudget, true); assert.equal(result.valid, false);
});
test('金额保持整数分，优惠与总价守恒', () => {
  const result = quoteDemo([line('beef-fries'), line('single-zero-m')], 'mix-400', rounds[2].couponIds);
  assert.equal(result.totalCents, 2690); assert.equal(result.subtotalCents - result.discountCents, result.totalCents);
  assert.equal(Number.isInteger(result.totalCents), true);
});
test('对手对有限候选的搜索均通过同餐校验', () => {
  for (const round of rounds) {
    const result = searchEquivalentPlans(round.target, catalog, 128);
    assert.ok(result.plans.length > 1);
    for (const plan of result.plans) assert.equal(compareBags(quoteDemo(plan).items, round.target).equal, true);
    const opponent = chooseOpponent(round);
    assert.equal(evaluatePlan(opponent.plan, opponent.couponId, round).valid, true);
  }
});
test('未知 SKU、未知选项、负数和小数数量不能通过', () => {
  for (const plan of [[line('missing')], [line('chicken-set', 'missing')], [line('single-chicken','default',-1)], [line('single-chicken','default',0.5)]]) assert.equal(evaluatePlan(plan, null, rounds[0]).valid, false);
});
