import { randomUUID } from 'node:crypto';
import { McpClient } from './mcp-client.mjs';
import { bagOf, compareBags, expandPlan } from '../web/engine.mjs';
import { normalizePlan } from '../web/challenge.mjs';
import { DeepSeekOpponent } from './model-opponent.mjs';
import { sealPlan } from './commitment.mjs';

const CASES = { chicken: { code: '9900005453', name: '麦香鸡' }, bigmac: { code: '9900005466', name: '巨无霸' }, fish: { code: '9900005460', name: '麦香鱼' } };
const CONTEXT = { storeCode: '1450713', orderType: 1, beType: 1 };
const STORE_NAME = '麦当劳上海黄浦华旭国际大厦餐厅';
function unwrap(result) {
  const content = result.structuredContent;
  if (content?.code === 600057) throw new Error('测试门店可能已关闭或不在营业时间，请在营业时间重试（600057）');
  if (!content || content.success !== true || content.code !== 200 || !content.data) throw new Error(`官方业务查询未成功（${content?.code ?? '未知'}），请重新加载本局`);
  return content;
}
export function defaultModification(modification) {
  const values = [];
  for (const group of modification?.items ?? []) for (const value of group.values ?? []) {
    const quantity = value.selectedQuantity ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error('无法确认默认特制份数');
    if (quantity > 0) {
      if (typeof value.selectedKey !== 'string') throw new Error('默认特制缺少选项标识');
      values.push({ code: value.code, key: value.selectedKey, quantity });
    } else if (value.unselectedKey) values.push({ code: value.code, key: value.unselectedKey, quantity: 0 });
  }
  return values.length ? { values } : undefined;
}
export function defaultSignature(modification) {
  return JSON.stringify((defaultModification(modification)?.values ?? []).map(v => [v.code, v.key, v.quantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function canonical(choice) {
  return { foodId: choice.code, quantity: choice.quantity ?? 1, customizations: { default: defaultSignature(choice.modification) } };
}
export function selections(detail) {
  return (detail.rounds ?? []).map(round => {
    const declared = round.choices.filter(c => c.isDefault === 1);
    // Some menus mark the default choice explicitly but report quantity=0
    // while a seasonal alternative has quantity=1. Select the declared default
    // explicitly, only for a single-choice round, then verify its actual quote.
    const choices = declared.length === 1 && round.quantity === 1 && round.minQuantity === 1 && round.maxQuantity === 1
      ? [{ ...declared[0], quantity: 1 }]
      : declared.filter(c => c.quantity > 0);
    const sum = choices.reduce((n, c) => n + c.quantity, 0);
    if (sum !== round.quantity || sum < round.minQuantity || sum > round.maxQuantity) throw new Error('套餐默认选项或份数无法核验');
    return { round, choices };
  });
}
function nativeItem(detail, selected) {
  const item = { productCode: detail.code, quantity: 1 };
  if (detail.rounds?.length) item.roundList = (selected ?? selections(detail)).map(({ round, choices }) => ({ round: String(round.id), comboItemList: choices.map(choice => ({ code: choice.code, quantity: choice.quantity, ...(defaultModification(choice.modification) ? { modification: defaultModification(choice.modification) } : {}) })) }));
  else if (defaultModification(detail.modification)) item.modification = defaultModification(detail.modification);
  return item;
}
function priceReference(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('菜单参考价无法识别');
  return Math.round(Number(value) * 100);
}
function foodMeta(detail) {
  const name = detail.name;
  const icon = /薯条/.test(name) ? 'fries' : /薯饼/.test(name) ? 'hashbrown' : /鸡块/.test(name) ? 'nuggets' : /鸡翅/.test(name) ? 'wings' : /热香饼/.test(name) ? 'pancakes' : /新地|冰淇淋/.test(name) ? 'sundae' : /咖啡|拿铁|美式/.test(name) ? 'coffee' : /可乐|雪碧|茶|饮|汁|奶昔/.test(name) ? 'drink' : /麦满分|早餐堡/.test(name) ? 'muffin' : 'burger';
  return { id: detail.code, name, short: name, icon, kind: /无糖/.test(name) ? 'zero' : /牛|巨无霸/.test(name) ? 'beef' : 'chicken' };
}
export function receiptMatches(items, productList) {
  if (!Array.isArray(productList)) return false;
  const expected = new Map(), received = new Map();
  for (const item of items) expected.set(item.productCode, (expected.get(item.productCode) ?? 0) + item.quantity);
  for (const item of productList) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return false;
    received.set(item.productCode, (received.get(item.productCode) ?? 0) + item.quantity);
  }
  return expected.size === received.size && [...expected].every(([code, quantity]) => received.get(code) === quantity);
}
export async function resolveSingle(leaf, menuData, getDetail) {
  if (menuData.meals[leaf.code]) return { item: nativeItem(leaf), referenceCents: priceReference(menuData.meals[leaf.code].currentPrice), parentCode: leaf.code };
  // A cup-size leaf can be selectable inside a menu-level drink product while
  // being silently ignored as a direct productCode. Match a declared child code
  // and its full default modification signature, never a similar display name.
  const candidates = Object.entries(menuData.meals).filter(([, value]) => /可乐|饮料|饮品|雪碧|咖啡|拿铁|美式|果汁|茶|奶昔|新地|冰淇淋/.test(value.name));
  for (const [code] of candidates) {
    const parent = await getDetail(code);
    if (parent.rounds?.length !== 1) continue;
    const round = parent.rounds[0];
    if (round.quantity !== 1 || round.minQuantity !== 1 || round.maxQuantity !== 1) continue;
    const choice = round.choices.find(c => c.code === leaf.code && defaultSignature(c.modification) === defaultSignature(leaf.modification));
    if (choice) return { item: nativeItem(parent, [{ round, choices: [{ ...choice, quantity: 1 }] }]), referenceCents: null, parentCode: parent.code };
  }
  throw new Error('这份套餐子项没有找到可核验的菜单级单点规格');
}
export class LiveArena {
  #rounds = new Map();
  #client;
  #stores = new Map();
  #model;
  constructor(token, { client, model } = {}) { this.#client = client ?? new McpClient(token); this.#model = model; }
  async searchStores({ city, keyword }) {
    if (typeof city !== 'string' || !city.trim() || city.length > 40 || typeof keyword !== 'string' || !keyword.trim() || keyword.length > 80) throw new Error('请填写城市与地点关键词');
    const result = unwrap(await this.#client.call('query-nearby-stores', { beType: 1, searchType: 2, city: city.trim(), keyword: keyword.trim() }));
    if (!Array.isArray(result.data)) throw new Error('门店列表格式暂不支持');
    const stores = result.data.slice(0, 30).flatMap(store => {
      if (typeof store.storeCode !== 'string' || !/^\d{4,12}$/.test(store.storeCode) || typeof store.storeName !== 'string') return [];
      const item = { storeCode: store.storeCode, storeName: store.storeName, address: typeof store.address === 'string' ? store.address : '', businessStatus: typeof store.businessStatus === 'boolean' ? store.businessStatus : null, hours: [store.businessStartTime, store.businessEndTime].filter(v => typeof v === 'string').join('–'), city: city.trim() };
      this.#stores.set(item.storeCode, { ...item, expiresAt: Date.now() + 5 * 60 * 1000 });
      return [item];
    });
    if (this.#stores.size > 300) for (const [code, store] of this.#stores) if (store.expiresAt < Date.now()) this.#stores.delete(code);
    return { stores: stores.sort((a, b) => Number(b.businessStatus === true) - Number(a.businessStatus === true)), checkedAt: result.datetime };
  }
  #store(storeCode) {
    if (typeof storeCode !== 'string' || !/^\d{4,12}$/.test(storeCode)) throw new Error('门店编号无效');
    const selectedStore = this.#stores.get(storeCode);
    if (storeCode !== CONTEXT.storeCode && (!selectedStore || selectedStore.expiresAt < Date.now())) throw new Error('门店搜索结果已过期，请重新搜索并选择门店');
    if (selectedStore && selectedStore.businessStatus !== true) throw new Error('所选门店当前未确认营业，请换一家营业门店');
    return selectedStore;
  }
  async menu(storeCode) {
    this.#store(storeCode);
    await this.#client.initialize();
    const result = unwrap(await this.#client.call('query-meals', { ...CONTEXT, storeCode }));
    const categoryMap = new Map();
    for (const category of result.data.categories ?? []) for (const meal of category.meals ?? []) {
      const code = String(meal.code);
      if (!categoryMap.has(code)) categoryMap.set(code, []);
      if (typeof category.name === 'string') categoryMap.get(code).push(category.name);
    }
    const meals = Object.entries(result.data.meals ?? {}).filter(([code, value]) => /^\d{3,16}$/.test(code) && typeof value.name === 'string').map(([code, value]) => ({ code, name: value.name, categories: categoryMap.get(code) ?? ['其他'], referenceCents: priceReference(value.currentPrice) }));
    return { meals, categories: [...new Set(meals.flatMap(m => m.categories))], checkedAt: result.datetime };
  }
  async prepare(caseId, { storeCode = CONTEXT.storeCode, mealCode, opponent = 'strategy', model } = {}) {
    if (!CASES[caseId] && !(caseId === 'menu' && typeof mealCode === 'string' && /^\d{3,16}$/.test(mealCode))) throw new Error('请选择受支持的真实同餐挑战');
    if (!['strategy', 'llm'].includes(opponent)) throw new Error('请选择支持的对手');
    const selectedStore = this.#store(storeCode);
    const context = { storeCode, orderType: 1, beType: 1 };
    const storeName = selectedStore?.storeName ?? STORE_NAME;
    for (const [id, state] of this.#rounds) if (Date.now() > state.expiresAt) this.#rounds.delete(id);
    if (this.#rounds.size >= 20) throw new Error('已开启较多挑战，请先完成当前对局');
    await this.#client.initialize();
    const menu = unwrap(await this.#client.call('query-meals', context));
    const mealMap = menu.data.meals;
    const selectedCase = CASES[caseId] ?? { code: mealCode, name: mealMap?.[mealCode]?.name };
    if (!mealMap?.[selectedCase.code]) throw new Error('当前时段菜单没有这份套餐，请换一题或稍后再试');
    const cache = new Map();
    const detail = async code => {
      if (!cache.has(code)) cache.set(code, this.#client.call('query-meal-detail', { ...context, code }).then(unwrap).then(r => r.data));
      return cache.get(code);
    };
    const set = await detail(selectedCase.code), selected = selections(set);
    const parts = selected.length ? selected.flatMap(r => r.choices) : [{ ...set, quantity: 1 }];
    const leafDetails = await Promise.all(parts.map(c => detail(c.code)));
    for (let i = 0; i < parts.length; i++) {
      if (leafDetails[i].rounds?.length || leafDetails[i].code !== parts[i].code || defaultSignature(leafDetails[i].modification) !== defaultSignature(parts[i].modification)) throw new Error('套餐子项与单点无法按默认特制准确对应，本局暂不支持');
    }
    const target = parts.map(canonical);
    const native = new Map(), offers = [];
    const foodList = leafDetails.map(foodMeta);
    const addOffer = (d, selectedRounds, price, type, tag) => {
      const id = `${type}-${d.code}`, variantId = 'default';
      const items = d.rounds?.length ? selectedRounds.flatMap(r => r.choices.map(canonical)) : [canonical({ ...d, quantity: 1 })];
      const variant = { id: variantId, name: d.rounds?.length ? '默认标准搭配' : '默认标准特制', priceCents: price, items };
      offers.push({ id, name: d.name, type, tag, icon: type === 'bundle' ? 'meal' : foodMeta(d).icon, variants: [variant] });
      native.set(`${id}/${variantId}`, nativeItem(d, selectedRounds));
      return id;
    };
    const singleMappings = await Promise.all(leafDetails.map(d => resolveSingle(d, menu.data, detail)));
    const singlePlan = leafDetails.map((d, i) => {
      const id = addOffer(d, [], singleMappings[i].referenceCents ?? 0, 'single', '单点');
      native.set(`${id}/default`, singleMappings[i].item);
      return { offerId: id, variantId: 'default', quantity: parts[i].quantity };
    });
    // Some directly priceable leaf SKUs (notably a cup size) only appear in the
    // official detail choices, not in the top-level menu map. Confirm those by
    // an individual official quote rather than inventing a reference price.
    const unlisted = leafDetails.map((d, i) => ({ d, mapping: singleMappings[i] })).filter(({ mapping }) => mapping.referenceCents === null);
    const individualResults = await Promise.allSettled(unlisted.map(async ({ d, mapping }) => {
      const r = unwrap(await this.#client.call('calculate-price', { ...context, needTableware: false, items: [mapping.item] }));
      if (!Number.isSafeInteger(r.data.price) || r.data.price < 0 || !receiptMatches([mapping.item], r.data.productList)) throw new Error('套餐子项的单点可计价性无法确认');
      offers.find(o => o.id === `single-${d.code}`).variants[0].priceCents = r.data.price;
    }));
    for (const r of individualResults) if (r.status === 'rejected') throw r.reason;
    const setId = addOffer(set, selected, priceReference(mealMap[set.code].currentPrice), 'bundle', '套餐');
    const setPlan = [{ offerId: setId, variantId: 'default', quantity: 1 }];
    // Only add a pair if every selected child is an exact subset of this target,
    // including its default modification signature. No name-only matching.
    const pairCode = '9900013304';
    if (mealMap[pairCode] && pairCode !== set.code) try {
      const pair = await detail(pairCode), wanted = bagOf(target);
      const pairRounds = (pair.rounds ?? []).map(round => {
        if (round.quantity !== 1 || round.minQuantity !== 1 || round.maxQuantity !== 1) return null;
        const choice = round.choices.find(c => wanted.has(JSON.stringify([c.code, { default: defaultSignature(c.modification) }])));
        return choice ? { round, choices: [{ ...choice, quantity: 1 }] } : null;
      });
      if (pairRounds.length && pairRounds.every(Boolean)) {
        const pairItems = pairRounds.flatMap(r => r.choices.map(canonical));
        if (!compareBags(pairItems, target).extra.length) {
          const item = nativeItem(pair, pairRounds);
          const quoted = unwrap(await this.#client.call('calculate-price', { ...context, needTableware: false, items: [item] }));
          if (!Number.isSafeInteger(quoted.data.price) || quoted.data.price < 0 || !receiptMatches([item], quoted.data.productList)) throw new Error('随心配所选搭配无法完整核价');
          addOffer(pair, pairRounds, quoted.data.price, 'bundle', '随心配');
        }
      }
    } catch { /* Optional pair availability must not invalidate the verified main meal. */ }
    const publicCatalog = { foods: foodList, offers, coupons: [] };
    const round = { id: `live-${caseId}`, caseId, ...(caseId === 'menu' ? { mealCode } : {}), number: '实', label: '真实同餐', title: `${selectedCase.name}，怎么点更划算？`, kicker: '官方整单核价', description: `${storeName} · 到店自取 · 默认标准特制`, target, budgetCents: Math.max(5000, priceReference(mealMap[set.code].currentPrice) * 3), couponIds: [], opponent: 'set', hint: '先比较完整餐品与单点；如果有随心配，再试试搭配剩余单品。最终价格以整单官方核价为准。', recommended: offers.filter(o => o.type === 'bundle').map(o => o.id).concat(singlePlan.map(l => l.offerId)), storeName, storeCode, storeCity: selectedStore?.city ?? '上海' };
    const state = { round, context, catalog: publicCatalog, native, createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 };
    if (opponent === 'llm') {
      state.opponent = await (model ?? this.#model ?? new DeepSeekOpponent()).choose({ round, catalog: publicCatalog, source: 'official', evaluate: async (plan, couponId) => { if (couponId) throw new Error('本局不使用券'); return this.#quote(state, plan); } });
    } else {
      const options = await Promise.allSettled([singlePlan, setPlan].map(plan => this.#quote(state, plan)));
      const verified = options.flatMap((response, index) => response.status === 'fulfilled' && response.value.valid ? [{ ...response.value, plan: [singlePlan, setPlan][index], couponId: null }] : []);
      if (verified.length !== 2) throw new Error('未能同时核验套餐与单点报价，本局不计胜负；请重新开启');
      verified.sort((a, b) => a.quote.totalCents - b.quote.totalCents);
      state.opponent = { ...verified[0], meta: { kind: 'strategy', name: '套餐派', summary: '比较完整套餐与全单点，不搜索混搭。' } };
    }
    Object.assign(state, sealPlan(state.opponent.plan, state.opponent.couponId));
    state.expiresAt = Date.now() + 15 * 60 * 1000;
    const roundId = randomUUID(); this.#rounds.set(roundId, state);
    return { roundId, round, catalog: publicCatalog, opponentMeta: state.opponent.meta, opponentCommitment: state.commitment, source: 'official', preparedAt: new Date().toISOString() };
  }
  #get(id) {
    const round = this.#rounds.get(id);
    if (!round || Date.now() > round.expiresAt) throw new Error('本局已过期或服务已重启，请重新开启真实挑战');
    return round;
  }
  async #quote(state, plan) {
    plan = normalizePlan(plan);
    const expanded = expandPlan(plan, state.catalog), comparison = compareBags(expanded.items, state.round.target);
    if (!comparison.equal) return { valid: false, quote: null, comparison, overBudget: false, error: '餐袋尚未一致，先调整餐品与份数' };
    const items = plan.map(line => {
      const original = state.native.get(`${line.offerId}/${line.variantId}`);
      if (!original) throw new Error('当前菜单无法对应这份选配');
      return { ...structuredClone(original), quantity: line.quantity };
    });
    const result = unwrap(await this.#client.call('calculate-price', { ...state.context, needTableware: false, items }));
    const data = result.data;
    if (!Number.isSafeInteger(data.price) || data.price < 0) throw new Error('官方价格缺失或单位无法确认，不能判胜');
    if (!receiptMatches(items, data.productList)) throw new Error('官方计价商品清单与请求不一致，本次不计胜负');
    const quote = { ...expanded, totalCents: data.price, subtotalCents: data.originalPrice ?? data.price, discountCents: data.discount ?? 0, coupon: null, source: 'official', traceId: result.traceId, quotedAt: result.datetime, currency: 'CNY' };
    const overBudget = quote.totalCents > state.round.budgetCents;
    return { valid: !overBudget, comparison, quote, overBudget, error: null };
  }
  async quote(id, plan) { return this.#quote(this.#get(id), plan); }
  async reveal(id, plan) {
    const state = this.#get(id);
    const outcomes = await Promise.allSettled([this.#quote(state, plan), this.#quote(state, state.opponent.plan)]);
    for (const result of outcomes) if (result.status === 'rejected') throw result.reason;
    const player = outcomes[0].value, opponent = outcomes[1].value;
    if (!player.valid || !opponent.valid) throw new Error('双方没有同时通过核价，暂不判胜');
    return { player, opponent: { ...opponent, plan: state.opponent.plan, couponId: null, meta: state.opponent.meta }, opponentMeta: state.opponent.meta, opponentCommitment: state.commitment, opponentNonce: state.nonce };
  }
}
