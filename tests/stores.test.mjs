import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveArena } from '../lib/live-arena.mjs';

function fixtureClient() {
  const calls = [];
  const parts = [{ code: '1450', name: '鸡肉堡' }, { code: '4810', name: '中薯' }, { code: '3050', name: '中可乐' }];
  return { calls, async initialize() {}, async call(name, args) {
    calls.push({ name, args: structuredClone(args) });
    let data;
    if (name === 'query-nearby-stores') data = [
      { storeCode: '2000001', storeName: '营业测试餐厅', address: '测试地址', businessStatus: true, businessStartTime: '08:00', businessEndTime: '23:00' },
      { storeCode: '2000002', storeName: '闭店测试餐厅', businessStatus: false },
      { storeCode: '2000003', storeName: '未知测试餐厅' }
    ];
    if (name === 'query-meals') data = { meals: Object.fromEntries([{ code: '9900005453', name: '麦香鸡中套餐' }, ...parts].map(p => [p.code, { name: p.name, currentPrice: '10.00' }])) };
    if (name === 'query-meal-detail') data = args.code === '9900005453'
      ? { code: args.code, name: '麦香鸡中套餐', rounds: parts.map((p, i) => ({ id: i + 1, quantity: 1, minQuantity: 1, maxQuantity: 1, choices: [{ ...p, quantity: 1, isDefault: 1 }] })) }
      : { ...parts.find(p => p.code === args.code), rounds: [] };
    if (name === 'calculate-price') data = { price: args.items.some(i => i.productCode === '9900005453') ? 2800 : args.items.reduce((n, i) => n + i.quantity * 1000, 0), productList: args.items.map(i => ({ productCode: i.productCode, quantity: i.quantity })) };
    if (!data) throw new Error('Unexpected fixture call');
    return { structuredContent: { success: true, code: 200, data, datetime: 'fixture', traceId: 'fixture' } };
  } };
}
test('城市地点按位置搜索，未知营业状态不默认营业', async () => {
  const client = fixtureClient(), arena = new LiveArena('', { client });
  const result = await arena.searchStores({ city: '上海', keyword: '人民广场' });
  assert.deepEqual(client.calls[0].args, { beType: 1, searchType: 2, city: '上海', keyword: '人民广场' });
  assert.equal(result.stores.find(s => s.storeCode === '2000003').businessStatus, null);
  await assert.rejects(arena.searchStores({ city: '', keyword: 'x' }));
});
test('未经搜索的门店、闭店和未知状态不能开始即时自提', async () => {
  const client = fixtureClient(), arena = new LiveArena('', { client });
  await arena.searchStores({ city: '上海', keyword: '测试' });
  for (const storeCode of ['2000002', '2000003', '9999999']) await assert.rejects(arena.prepare('chicken', { storeCode }));
  assert.equal(client.calls.some(c => c.name === 'query-meals'), false);
});
test('双方准备、玩家报价和揭晓始终使用选定门店上下文', async () => {
  const client = fixtureClient(), arena = new LiveArena('', { client });
  await arena.searchStores({ city: '上海', keyword: '测试' });
  const prepared = await arena.prepare('chicken', { storeCode: '2000001' });
  const plan = [{ offerId: 'bundle-9900005453', variantId: 'default', quantity: 1 }];
  await arena.quote(prepared.roundId, plan);
  const reveal = await arena.reveal(prepared.roundId, plan);
  assert.equal(reveal.player.valid, true);
  assert.equal(reveal.opponentCommitment, prepared.opponentCommitment);
  for (const call of client.calls.filter(c => c.name !== 'query-nearby-stores')) assert.equal(call.args.storeCode, '2000001');
});

test('完整门店菜单可读，动态单品题按商品编码核验和揭晓', async () => {
  const client = fixtureClient(), arena = new LiveArena('', { client });
  await arena.searchStores({ city: '上海', keyword: '测试' });
  const menu = await arena.menu('2000001');
  assert.equal(menu.meals.length, 4); assert.ok(menu.meals.some(m => m.code === '4810'));
  await assert.rejects(arena.menu('2000002'), /营业/);
  const prepared = await arena.prepare('menu', { storeCode: '2000001', mealCode: '4810' });
  assert.equal(prepared.round.mealCode, '4810');
  assert.equal(prepared.round.target[0].foodId, '4810');
  const reveal = await arena.reveal(prepared.roundId, [{ offerId: 'single-4810', variantId: 'default', quantity: 1 }]);
  assert.equal(reveal.player.valid, true); assert.equal(reveal.player.quote.totalCents, 1000);
  await assert.rejects(arena.prepare('menu', { storeCode: '2000001', mealCode: '9999' }), /菜单/);
});
test('自带模型只用于当前真实对局，不覆盖其他对局的对手', async () => {
  const arena = new LiveArena('', { client: fixtureClient() });
  const plan = [{ offerId: 'bundle-9900005453', variantId: 'default', quantity: 1 }];
  const model = { choose: async ({ evaluate }) => ({ ...await evaluate(plan, null), plan, couponId: null, meta: { kind: 'llm', name: 'Visitor model' } }) };
  const prepared = await arena.prepare('chicken', { opponent: 'llm', model });
  assert.equal(prepared.opponentMeta.name, 'Visitor model');
  const next = await arena.prepare('chicken');
  assert.equal(next.opponentMeta.kind, 'strategy');
});
