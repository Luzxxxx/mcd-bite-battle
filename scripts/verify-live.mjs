import { mkdir, writeFile } from 'node:fs/promises';
import { McpClient, redact } from '../lib/mcp-client.mjs';
import { resolveSingle, receiptMatches } from '../lib/live-arena.mjs';

const root = new URL('../work/live/', import.meta.url);
const client = new McpClient();
const context = { storeCode: '1450713', orderType: 1, beType: 1 };
let menuData;
const details = new Map();
function unwrap(result) {
  const s = result.structuredContent;
  if (!s || s.success !== true || !s.data) throw new Error(`无法核验业务结果：${s?.code ?? 'unknown'}`);
  return s;
}
async function detail(code) {
  if (!details.has(code)) details.set(code, (async () => {
    const result = await client.call('query-meal-detail', { ...context, code });
    await writeFile(new URL(`detail-${code}.json`, root), redact(JSON.stringify(result, null, 2)));
    return unwrap(result).data;
  })());
  return details.get(code);
}
function defaultModification(value) {
  const values = [];
  for (const group of value?.items ?? []) for (const item of group.values ?? []) {
    const selected = Number(item.selectedQuantity ?? 0);
    if (selected > 0) values.push({ code: item.code, key: item.selectedKey, quantity: selected });
    else if (item.unselectedKey) values.push({ code: item.code, key: item.unselectedKey, quantity: 0 });
  }
  return values.length ? { values } : undefined;
}
function signature(modification) {
  return JSON.stringify((defaultModification(modification)?.values ?? []).map(v => [v.code, v.key, v.quantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function defaultSelections(d) {
  return (d.rounds ?? []).map(round => {
    const selected = round.choices.filter(c => c.isDefault === 1 && c.quantity > 0);
    if (selected.reduce((sum, c) => sum + c.quantity, 0) !== round.quantity) throw new Error('套餐默认选项数量无法确认');
    return { round, selected };
  });
}
function asItem(d) {
  const item = { productCode: d.code, quantity: 1 };
  if (d.rounds?.length) item.roundList = defaultSelections(d).map(({ round, selected }) => ({ round: String(round.id), comboItemList: selected.map(c => ({ code: c.code, quantity: c.quantity, ...(defaultModification(c.modification) ? { modification: defaultModification(c.modification) } : {}) })) }));
  else if (defaultModification(d.modification)) item.modification = defaultModification(d.modification);
  return item;
}
async function verifyCase(code) {
  const set = await detail(code), selected = defaultSelections(set).flatMap(({ selected }) => selected);
  const singles = await Promise.all(selected.map(c => detail(c.code)));
  const same = selected.every((c, i) => c.code === singles[i].code && signature(c.modification) === signature(singles[i].modification));
  if (!same) throw new Error(`套餐 ${code} 的子项与单点默认特制不一致，跳过比较`);
  const mappings = await Promise.all(singles.map(d => resolveSingle(d, menuData, detail)));
  const singleItems = mappings.map((mapping, i) => ({ ...mapping.item, quantity: selected[i].quantity }));
  const requests = [{ ...context, needTableware: false, items: [asItem(set)] }, { ...context, needTableware: false, items: singleItems }];
  const replies = await Promise.allSettled(requests.map(args => client.call('calculate-price', args)));
  const results = replies.map(reply => { if (reply.status !== 'fulfilled') throw reply.reason; return unwrap(reply.value); });
  for (const r of results) if (!Number.isSafeInteger(r.data.price) || r.data.price < 0) throw new Error('计价未返回整数分');
  if (!results.every((r, i) => receiptMatches(requests[i].items, r.data.productList))) throw new Error('返回计价商品与请求不一致，不能证明同餐可比');
  const record = { name: set.name, setCode: code, contents: selected.map((c, i) => ({ code: c.code, name: c.name, quantity: c.quantity, defaultModificationSignature: signature(singles[i].modification) })), canonicalEqual: same, receiptVerified: true, singleSkuMappings: mappings.map((m,i) => ({ leafCode: singles[i].code, menuProductCode: m.parentCode })), context: { ...context, channel: '到店自取', coupon: 'none', withOrder: false, defaultCustomizations: true }, setCents: results[0].data.price, singlesCents: results[1].data.price, savingCents: results[1].data.price - results[0].data.price, traces: results.map(r => r.traceId), checkedAt: results.map(r => r.datetime), setQuote: results[0].data, singlesQuote: results[1].data, requests };
  await writeFile(new URL(`case-${code}.json`, root), redact(JSON.stringify(record, null, 2)));
  return record;
}
await mkdir(root, { recursive: true });
try {
  await client.initialize();
  menuData = unwrap(await client.call('query-meals', context)).data;
  const replies = await Promise.allSettled(['9900005453', '9900005466', '9900005460'].map(verifyCase));
  const cases = [];
  for (let i = 0; i < replies.length; i++) {
    const result = replies[i];
    if (result.status === 'fulfilled') { cases.push(result.value); const { name, contents, canonicalEqual, setCents, singlesCents, savingCents, traces, checkedAt } = result.value; console.log(JSON.stringify({ name, contents: contents.map(c => ({ code: c.code, name: c.name, quantity: c.quantity })), canonicalEqual, setCents, singlesCents, savingCents, traces, checkedAt })); }
    else console.log(JSON.stringify({ caseIndex: i, error: redact(result.reason.message) }));
  }
  await writeFile(new URL('verified-cases.json', root), redact(JSON.stringify(cases, null, 2)));
  if (cases.length !== 3) process.exitCode = 1;
} catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
