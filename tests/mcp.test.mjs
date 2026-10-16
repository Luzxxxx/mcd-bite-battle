import test from 'node:test';
import assert from 'node:assert/strict';
import { McpClient, parseMcpResponse } from '../lib/mcp-client.mjs';
import { defaultSignature, defaultModification, receiptMatches, resolveSingle, selections } from '../lib/live-arena.mjs';

test('MCP 能解析 JSON 和 SSE 返回，不把说明文本当数据', () => {
  const response = { jsonrpc: '2.0', id: 1, result: { value: 42 } };
  assert.deepEqual(parseMcpResponse(JSON.stringify(response)), response);
  assert.deepEqual(parseMcpResponse(`event: message\r\ndata: ${JSON.stringify(response)}\r\n\r\n`), response);
  assert.equal(parseMcpResponse('仅有文字说明'), null);
});
test('交易与领券工具在发出网络请求前被拒绝', async () => {
  const client = new McpClient('test-placeholder-never-sent');
  for (const tool of ['create-order', 'auto-bind-coupons', 'mall-create-order', 'draw-lottery', 'cancel-order']) await assert.rejects(client.call(tool, {}), /仅允许/);
});
test('没有 Token 时直接给出本机配置提示', () => { assert.throws(() => new McpClient(''), /未配置/); });
test('默认特制保留选中和需显式传入的未选中状态', () => {
  const mod = { items: [{ values: [{ code: 'sauce', selectedQuantity: 1, selectedKey: 'on', unselectedKey: 'off' }, { code: 'onion', selectedQuantity: 0, selectedKey: 'on', unselectedKey: 'off' }] }] };
  assert.deepEqual(defaultModification(mod), { values: [{ code: 'sauce', key: 'on', quantity: 1 }, { code: 'onion', key: 'off', quantity: 0 }] });
  const changed = structuredClone(mod); changed.items[0].values[1].selectedQuantity = 1;
  assert.notEqual(defaultSignature(mod), defaultSignature(changed));
});
test('默认特制没有必要标识时拒绝凭空构造', () => {
  assert.throws(() => defaultModification({ items: [{ values: [{ code: 'unknown', selectedQuantity: 1 }] }] }), /缺少/);
});
test('计价 HTTP 成功但漏掉一个商品时不能认定同餐', () => {
  const requested = [{ productCode: 'burger', quantity: 1 }, { productCode: 'drink-child', quantity: 1 }];
  assert.equal(receiptMatches(requested, [{ productCode: 'burger', quantity: 1 }]), false);
  assert.equal(receiptMatches(requested, [{ productCode: 'burger', quantity: 1 }, { productCode: 'drink-child', quantity: 1 }]), true);
  assert.equal(receiptMatches(requested, [{ productCode: 'burger', quantity: 1 }, { productCode: 'drink-child', quantity: 2 }]), false);
});
test('杯型子项只能通过官方父商品的明确选项映射，不能按名称近似', async () => {
  const leaf = { code: 'medium-cola', name: '可乐中杯', rounds: [] };
  const parent = { code: 'drink-parent', name: '可乐', rounds: [{ id: 1, quantity: 1, minQuantity: 1, maxQuantity: 1, choices: [{ code: 'small-cola', name: '可乐小杯' }, { code: 'medium-cola', name: '可乐中杯' }] }] };
  const menu = { meals: { 'drink-parent': { name: '可乐', currentPrice: '9.5' } } };
  const mapping = await resolveSingle(leaf, menu, async () => parent);
  assert.equal(mapping.item.productCode, 'drink-parent');
  assert.equal(mapping.item.roundList[0].comboItemList[0].code, 'medium-cola');
  await assert.rejects(resolveSingle({ ...leaf, code: 'other-cola' }, menu, async () => parent), /没有找到/);
});

test('单选轮明确指定官方默认选项，不把当前带数量的其他选项误认为默认', () => {
  const round = { id: 1, quantity: 1, minQuantity: 1, maxQuantity: 1, choices: [{ code: 'default-hot', isDefault: 1, quantity: 0 }, { code: 'other-cold', isDefault: 0, quantity: 1 }] };
  const result = selections({ rounds: [round] });
  assert.equal(result[0].choices[0].code, 'default-hot'); assert.equal(result[0].choices[0].quantity, 1);
  assert.throws(() => selections({ rounds: [{ ...round, choices: round.choices.map(c => ({ ...c, isDefault: 0 })) }] }), /默认/);
  assert.throws(() => selections({ rounds: [{ ...round, quantity: 2, minQuantity: 2, maxQuantity: 2 }] }), /默认/);
});
