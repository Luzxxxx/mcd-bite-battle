import { catalog as defaultCatalog } from './data.mjs';

export const money = cents => `¥${(cents / 100).toFixed(2)}`;
function positiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error(`${label}须为 1–12 的整数`);
  return value;
}
function sortedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('定制要求格式无效');
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    if (!['string', 'number', 'boolean'].includes(typeof v)) throw new Error('定制要求必须为简单值');
    return [k, v];
  }));
}
export function itemKey(item) {
  if (typeof item.foodId !== 'string' || !item.foodId) throw new Error('餐品标识无效');
  return JSON.stringify([item.foodId, sortedObject(item.customizations ?? {})]);
}
export function bagOf(items) {
  if (!Array.isArray(items)) throw new Error('餐品清单须为数组');
  const map = new Map();
  for (const item of items) {
    const key = itemKey(item);
    map.set(key, (map.get(key) ?? 0) + positiveInt(item.quantity ?? 1, '份数'));
  }
  return map;
}
export function compareBags(actualItems, targetItems) {
  const actual = bagOf(actualItems), target = bagOf(targetItems);
  const missing = [], extra = [];
  for (const key of new Set([...actual.keys(), ...target.keys()])) {
    const diff = (actual.get(key) ?? 0) - (target.get(key) ?? 0);
    const [foodId, customizations] = JSON.parse(key);
    if (diff < 0) missing.push({ foodId, customizations, quantity: -diff });
    if (diff > 0) extra.push({ foodId, customizations, quantity: diff });
  }
  return { equal: !missing.length && !extra.length, missing, extra };
}
export function expandPlan(plan, catalog = defaultCatalog) {
  if (!Array.isArray(plan) || plan.length > 12) throw new Error('买法清单无效或超过 12 行');
  const items = [], lines = [];
  for (const line of plan) {
    const offer = catalog.offers.find(o => o.id === line.offerId);
    if (!offer) throw new Error('清单包含当前菜单没有的买法');
    const variant = offer.variants.find(v => v.id === line.variantId);
    if (!variant) throw new Error('套餐选配不在允许范围内');
    const quantity = positiveInt(line.quantity ?? 1, '商品份数');
    if (!Number.isSafeInteger(variant.priceCents) || variant.priceCents < 0) throw new Error('价格未核验');
    for (const item of variant.items) items.push({ ...item, quantity: positiveInt(item.quantity ?? 1, '组成份数') * quantity });
    lines.push({ offer, variant, quantity, cents: variant.priceCents * quantity });
  }
  return { items, lines };
}
export function quoteDemo(plan, couponId = null, allowedCouponIds = [], catalog = defaultCatalog) {
  const { items, lines } = expandPlan(plan, catalog);
  const subtotalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  let discountCents = 0, coupon = null;
  if (couponId) {
    coupon = catalog.coupons.find(c => c.id === couponId);
    if (!coupon || !allowedCouponIds.includes(couponId)) throw new Error('这张券不在本局可用范围内');
    if (subtotalCents < coupon.minCents) throw new Error(`未达到 ${money(coupon.minCents)} 的用券门槛`);
    if (coupon.requireOfferIds && !lines.some(l => coupon.requireOfferIds.includes(l.offer.id))) throw new Error('餐单没有这张券要求的套餐 / 双拼');
    if (coupon.onlySingles && lines.some(l => l.offer.type !== 'single')) throw new Error('这张券仅限全部为单点商品的餐单');
    discountCents = Math.min(subtotalCents, coupon.discountCents);
  }
  return { items, lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents, coupon, source: 'training', currency: 'CNY' };
}
export function evaluatePlan(plan, couponId, round, catalog = defaultCatalog) {
  try {
    const quote = quoteDemo(plan, couponId, round.couponIds, catalog);
    const comparison = compareBags(quote.items, round.target);
    const overBudget = quote.totalCents > round.budgetCents;
    return { valid: comparison.equal && !overBudget, quote, comparison, overBudget, error: null };
  } catch (error) { return { valid: false, error: error.message, quote: null, comparison: null, overBudget: false }; }
}
export function bestQuoteForPlan(plan, round, catalog = defaultCatalog) {
  const candidates = [null, ...round.couponIds].map(couponId => {
    try { return { plan, couponId, quote: quoteDemo(plan, couponId, round.couponIds, catalog) }; } catch { return null; }
  }).filter(Boolean);
  return candidates.sort((a, b) => a.quote.totalCents - b.quote.totalCents)[0];
}
export function searchEquivalentPlans(target, catalog = defaultCatalog, limit = 128) {
  const wanted = bagOf(target), variants = [];
  for (const offer of catalog.offers) for (const variant of offer.variants) {
    const bag = bagOf(variant.items);
    if ([...bag].every(([key, n]) => n <= (wanted.get(key) ?? 0))) variants.push({ offerId: offer.id, variantId: variant.id, bag });
  }
  const found = [];
  let visits = 0;
  function visit(remaining, start, lines) {
    if (found.length >= limit || ++visits > 20000) return;
    if ([...remaining.values()].every(n => n === 0)) {
      const merged = new Map();
      for (const line of lines) {
        const key = `${line.offerId}/${line.variantId}`;
        if (merged.has(key)) merged.get(key).quantity++;
        else merged.set(key, { offerId: line.offerId, variantId: line.variantId, quantity: 1 });
      }
      found.push([...merged.values()]); return;
    }
    if (lines.length >= 8) return;
    for (let i = start; i < variants.length; i++) {
      const candidate = variants[i];
      if (![...candidate.bag].every(([key, n]) => n <= (remaining.get(key) ?? 0))) continue;
      const next = new Map(remaining);
      for (const [key, n] of candidate.bag) next.set(key, next.get(key) - n);
      visit(next, i, [...lines, candidate]);
      if (found.length >= limit) return;
    }
  }
  visit(wanted, 0, []);
  return { plans: found, visits, limit, complete: found.length < limit && visits <= 20000 };
}
export function chooseOpponent(round, catalog = defaultCatalog) {
  const search = searchEquivalentPlans(round.target, catalog, 128);
  let plans = search.plans;
  if (round.opponent !== 'search') plans = plans.filter(plan => plan.length === 1 || plan.every(line => catalog.offers.find(o => o.id === line.offerId).type === 'single'));
  const options = plans.map(plan => round.opponent === 'set'
    ? { plan, couponId: null, quote: quoteDemo(plan, null, round.couponIds, catalog) }
    : bestQuoteForPlan(plan, round, catalog)).filter(Boolean).filter(c => c.quote.totalCents <= round.budgetCents);
  options.sort((a, b) => a.quote.totalCents - b.quote.totalCents || a.plan.length - b.plan.length);
  if (!options.length) return null;
  return { ...options[0], candidatesCompared: options.length, searchComplete: search.complete, strategy: round.opponent };
}
export function verdict(playerEvaluation, opponent) {
  if (!playerEvaluation.valid) return { status: 'invalid', label: '先把餐单核对好' };
  if (!opponent) return { status: 'unverified', label: '对手暂无可核验方案' };
  const differenceCents = opponent.quote.totalCents - playerEvaluation.quote.totalCents;
  return { status: differenceCents > 0 ? 'win' : differenceCents === 0 ? 'tie' : 'loss', differenceCents, label: differenceCents > 0 ? '这局，你更会点。' : differenceCents === 0 ? '平局。' : '这局 AI 更省。' };
}
