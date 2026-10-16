import { DATA_VERSION, LEGACY_DATA_VERSION, rounds, catalogForVersion } from './data.mjs';
import { chooseOpponent, evaluatePlan } from './engine.mjs';

export const SHARE_ORIGIN = 'http://127.0.0.1:4318';
const CASES = new Set(['chicken', 'bigmac', 'fish', 'menu']);
export function normalizePlan(plan) {
  if (!Array.isArray(plan) || !plan.length || plan.length > 8) throw new Error('方案须包含 1–8 行商品');
  let count = 0;
  const result = plan.map(line => {
    if (!line || typeof line.offerId !== 'string' || typeof line.variantId !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 8) throw new Error('方案商品或份数无效');
    count += line.quantity;
    return { offerId: line.offerId, variantId: line.variantId, quantity: line.quantity };
  });
  if (count > 8) throw new Error('每局最多购买 8 份商品');
  return result;
}
export function descriptorFor(round, mode = 'training') {
  if (mode === 'live') return { v: 1, type: 'live', caseId: round.caseId ?? round.id.replace('live-', ''), ...(round.mealCode ? { mealCode: round.mealCode } : {}), storeCode: round.storeCode, storeName: round.storeName, city: round.storeCity ?? '' };
  const data = round.dataVersion ?? DATA_VERSION;
  return round.id === 'custom'
    ? { v: 1, data, type: 'training', id: 'custom', target: round.target.map(({ foodId, quantity }) => ({ foodId, quantity })), budgetCents: round.budgetCents }
    : { v: 1, data, type: 'training', id: round.id };
}
export function resolveDescriptor(value) {
  if (!value || value.v !== 1) throw new Error('这个挑战链接的版本暂不支持');
  if (value.type === 'live') {
    if (!CASES.has(value.caseId) || !/^\d{4,12}$/.test(value.storeCode ?? '') || typeof value.storeName !== 'string' || value.storeName.length > 100 || typeof value.city !== 'string' || value.city.length > 40) throw new Error('真实挑战的门店或题目无效');
    if (value.caseId === 'menu' && !/^\d{3,16}$/.test(value.mealCode ?? '')) throw new Error('菜单题目编码无效');
    return { descriptor: { v: 1, type: 'live', caseId: value.caseId, ...(value.caseId === 'menu' ? { mealCode: value.mealCode } : {}), storeCode: value.storeCode, storeName: value.storeName, city: value.city }, live: true };
  }
  if (value.type !== 'training') throw new Error('挑战类型无效');
  const catalog = catalogForVersion(value.data), foods = catalog.foods;
  let round = (value.data === LEGACY_DATA_VERSION ? rounds.slice(0, 3) : rounds).find(r => r.id === value.id);
  if (value.id === 'custom') {
    if (!Array.isArray(value.target) || !value.target.length || value.target.length > 5 || !Number.isInteger(value.budgetCents) || value.budgetCents < 1000 || value.budgetCents > 12000 || value.budgetCents % 100) throw new Error('自定义挑战内容或预算无效');
    const seen = new Set(); let count = 0;
    const target = value.target.map(item => {
      if (!foods.some(f => f.id === item.foodId) || seen.has(item.foodId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2) throw new Error('自定义餐品与份数无效');
      seen.add(item.foodId); count += item.quantity;
      return { foodId: item.foodId, quantity: item.quantity, customizations: {} };
    });
    if (count > 5) throw new Error('自定义餐袋最多 5 份');
    round = { id: 'custom', number: '★', label: '自由局', title: '朋友出的题', description: '同样的餐品和预算，比比谁更省。', target, budgetCents: value.budgetCents, couponIds: [], opponent: 'search', hint: '先搭套餐，再用单点补齐。', recommended: [] };
    if (!chooseOpponent(round, catalog)) throw new Error('这个预算在当前训练菜单中无法完成');
  }
  if (!round) throw new Error('找不到这道训练题');
  round = { ...round, dataVersion: value.data };
  let benchmark = null;
  if (value.benchmark) {
    const plan = normalizePlan(value.benchmark.plan), couponId = value.benchmark.couponId ?? null;
    const evaluation = evaluatePlan(plan, couponId, round, catalog);
    if (!evaluation.valid) throw new Error('邀请者的餐袋或用券条件无法验证');
    benchmark = { plan, couponId, totalCents: evaluation.quote.totalCents, hinted: value.benchmark.hinted === true };
  }
  const descriptor = descriptorFor(round);
  if (benchmark) descriptor.benchmark = { plan: benchmark.plan, couponId: benchmark.couponId, hinted: benchmark.hinted };
  return { descriptor, round: structuredClone(round), catalog, benchmark, live: false };
}
export function encodeChallenge(value) {
  const { descriptor } = resolveDescriptor(value);
  const bytes = new TextEncoder().encode(JSON.stringify(descriptor));
  if (bytes.length > 6000) throw new Error('题目过长，请减少餐品后分享');
  return btoa(Array.from(bytes, c => String.fromCharCode(c)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function decodeChallenge(hash) {
  if (!hash.startsWith('#challenge=')) return null;
  const encoded = hash.slice(11);
  if (!encoded || encoded.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('挑战链接格式无效');
  try {
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    return resolveDescriptor(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch (error) { throw new Error(`无法打开挑战：${error.message}`); }
}
export function challengeURL(value, origin = SHARE_ORIGIN) { return `${origin.replace(/\/$/, '')}/#challenge=${encodeChallenge(value)}`; }
