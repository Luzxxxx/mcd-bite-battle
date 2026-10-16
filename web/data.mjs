// Fictional training fixtures. These are not official McDonald's prices or promotions.
export const LEGACY_DATA_VERSION = 'training-2026-10-15-v1';
export const DATA_VERSION = 'training-2026-10-16-v2';
export const foods = [
  { id: 'chicken', name: '麦香鸡', short: '鸡肉堡', icon: 'burger', kind: 'chicken' },
  { id: 'beef', name: '双层牛肉堡', short: '牛肉堡', icon: 'burger', kind: 'beef' },
  { id: 'fries-m', name: '薯条（中）', short: '中薯条', icon: 'fries', size: '中' },
  { id: 'fries-s', name: '薯条（小）', short: '小薯条', icon: 'fries', size: '小' },
  { id: 'cola-m', name: '可乐（中）', short: '中可乐', icon: 'drink', size: '中' },
  { id: 'zero-m', name: '无糖可乐（中）', short: '中无糖', icon: 'drink', size: '中', kind: 'zero' },
  { id: 'cola-s', name: '可乐（小）', short: '小可乐', icon: 'drink', size: '小' },
  { id: 'coffee', name: '美式咖啡', short: '美式', icon: 'coffee' },
  { id: 'pie', name: '香甜派', short: '香甜派', icon: 'pie' }
];
const part = (foodId, quantity = 1, customizations = {}) => ({ foodId, quantity, customizations });
const v = (id, name, priceCents, items) => ({ id, name, priceCents, items });
const single = (id, price) => ({ id: `single-${id}`, name: foods.find(f => f.id === id).name, type: 'single', tag: '单点', icon: foods.find(f => f.id === id).icon, variants: [v('default', '标准份', price, [part(id)])] });
export const offers = [
  single('chicken', 1650), single('beef', 2050), single('fries-m', 1500), single('fries-s', 1200),
  single('cola-m', 900), single('zero-m', 900), single('cola-s', 700), single('coffee', 1300), single('pie', 800),
  { id: 'chicken-set', name: '经典鸡肉堡三件套', type: 'bundle', tag: '三件套', icon: 'meal', variants: [
    v('cola', '中薯 + 中可乐', 2990, [part('chicken'), part('fries-m'), part('cola-m')]),
    v('zero', '中薯 + 中无糖', 2990, [part('chicken'), part('fries-m'), part('zero-m')]),
    v('small', '小薯 + 中可乐', 2790, [part('chicken'), part('fries-s'), part('cola-m')])
  ] },
  { id: 'beef-set', name: '双层牛肉堡三件套', type: 'bundle', tag: '三件套', icon: 'meal', variants: [
    v('cola', '中薯 + 中可乐', 3290, [part('beef'), part('fries-m'), part('cola-m')]),
    v('zero', '中薯 + 中无糖', 3290, [part('beef'), part('fries-m'), part('zero-m')])
  ] },
  { id: 'chicken-drink', name: '鸡肉堡饮品双拼', type: 'bundle', tag: '双拼', icon: 'pair', variants: [
    v('cola', '鸡肉堡 + 中可乐', 1990, [part('chicken'), part('cola-m')]),
    v('zero', '鸡肉堡 + 中无糖', 1990, [part('chicken'), part('zero-m')])
  ] },
  { id: 'chicken-fries', name: '鸡肉堡薯条双拼', type: 'bundle', tag: '双拼', icon: 'pair', variants: [
    v('default', '鸡肉堡 + 中薯', 1690, [part('chicken'), part('fries-m')])
  ] },
  { id: 'beef-fries', name: '牛肉堡薯条双拼', type: 'bundle', tag: '双拼', icon: 'pair', variants: [
    v('default', '牛肉堡 + 中薯', 2190, [part('beef'), part('fries-m')])
  ] },
  { id: 'coffee-pie', name: '咖啡与派双拼', type: 'bundle', tag: '下午茶', icon: 'coffee', variants: [
    v('default', '美式 + 香甜派', 1590, [part('coffee'), part('pie')])
  ] }
];
export const coupons = [
  { id: 'set-500', name: '三件套省 ¥5', description: '含鸡肉堡 / 牛肉堡三件套，满 ¥28 减 ¥5。', minCents: 2800, discountCents: 500, requireOfferIds: ['chicken-set', 'beef-set'] },
  { id: 'mix-400', name: '牛肉双拼省 ¥4', description: '含牛肉堡薯条双拼，整单满 ¥28 减 ¥4。', minCents: 2800, discountCents: 400, requireOfferIds: ['beef-fries'] },
  { id: 'single-600', name: '纯单点省 ¥6', description: '全部为单点商品，满 ¥35 减 ¥6。', minCents: 3500, discountCents: 600, onlySingles: true }
];
export const rounds = [
  { id: 'warmup', number: '01', label: '热身局', title: '鸡肉堡这一餐，怎么点？', kicker: '套餐重组', target: [part('chicken'), part('fries-m'), part('cola-m')], budgetCents: 3500, couponIds: [], opponent: 'set', hint: '试试双拼加单品。', description: '鸡肉堡、中薯、中可乐，一样都不能少。', recommended: ['chicken-set', 'chicken-fries', 'chicken-drink', 'single-chicken', 'single-fries-m', 'single-cola-m'], tag: '找出套餐派的盲区' },
  { id: 'coupon', number: '02', label: '进阶局', title: '这张券怎么用？', kicker: '优惠应战', target: [part('chicken'), part('fries-m'), part('zero-m')], budgetCents: 3500, couponIds: ['set-500', 'single-600'], opponent: 'coupon', hint: '留意适用商品和满减门槛，饮料要无糖。', description: '鸡肉堡、中薯、中无糖。', recommended: ['chicken-set', 'chicken-fries', 'chicken-drink', 'single-chicken', 'single-fries-m', 'single-zero-m'], tag: '杯型、口味都算数' },
  { id: 'final', number: '03', label: '挑战局', title: '试试混搭。', kicker: '组合对决', target: [part('beef'), part('fries-m'), part('zero-m')], budgetCents: 3500, couponIds: ['set-500', 'mix-400', 'single-600'], opponent: 'search', hint: '牛肉双拼加中无糖，再看看能用哪张券。', description: '牛肉堡、中薯、中无糖。', recommended: ['beef-set', 'beef-fries', 'single-beef', 'single-fries-m', 'single-zero-m', 'single-cola-m'], tag: '挑战精算派' }
];
export const opponents = {
  set: { name: '套餐派', title: '入门策略对手', line: '我选整套餐，你试试混搭？', explanation: '比较整套餐和全单点，暂不混搭。' },
  coupon: { name: '用券派', title: '进阶策略对手', line: '我会用券，记得选无糖。', explanation: '比较套餐、单点，再试本局可用券。' },
  search: { name: '精算派', title: '组合搜索对手', line: '这次我也会混搭。', explanation: '最多比较 128 种相同餐品的组合和可用券。' }
};
export const categories = [
  { id: 'burger', name: '汉堡' }, { id: 'side', name: '小食' }, { id: 'drink', name: '饮品' },
  { id: 'breakfast', name: '早餐' }, { id: 'dessert', name: '甜品' }, { id: 'coffee', name: '咖啡' }
];
const foodCategory = food => food.icon === 'burger' ? 'burger' : food.icon === 'fries' ? 'side' : food.icon === 'drink' ? 'drink' : food.icon === 'coffee' ? 'coffee' : 'dessert';
for (const food of foods) food.category = foodCategory(food);
for (const offer of offers) offer.category = foods.find(f => f.id === offer.variants[0].items[0].foodId)?.category ?? 'other';
export const legacyCatalog = structuredClone({ foods, offers, coupons, categories });
foods.push(
  { id: 'nuggets', name: '香酥鸡块（6块）', short: '六块鸡块', icon: 'nuggets', category: 'side' },
  { id: 'wings', name: '香辣鸡翅（2块）', short: '两块鸡翅', icon: 'wings', category: 'side' },
  { id: 'fish', name: '鱼排堡', short: '鱼排堡', icon: 'burger', kind: 'fish', category: 'burger' },
  { id: 'muffin', name: '猪柳蛋早餐堡', short: '早餐堡', icon: 'muffin', category: 'breakfast' },
  { id: 'hashbrown', name: '薯饼', short: '薯饼', icon: 'hashbrown', category: 'breakfast' },
  { id: 'pancakes', name: '热香饼', short: '热香饼', icon: 'pancakes', category: 'breakfast' },
  { id: 'sundae', name: '草莓新地', short: '草莓新地', icon: 'sundae', category: 'dessert' },
  { id: 'shake', name: '香草奶昔（中）', short: '中杯奶昔', icon: 'drink', kind: 'shake', category: 'dessert' },
  { id: 'tea', name: '柠檬茶（中）', short: '中柠檬茶', icon: 'drink', kind: 'tea', category: 'drink' },
  { id: 'orange', name: '橙汁（中）', short: '中橙汁', icon: 'drink', kind: 'orange', category: 'drink' },
  { id: 'latte', name: '拿铁（中）', short: '中拿铁', icon: 'coffee', category: 'coffee' }
);
const bundle = (id, name, priceCents, ids, category, tag = '组合') => ({ id, name, type: 'bundle', tag, category, icon: 'meal', variants: [v('default', '标准搭配', priceCents, ids.map(id => part(id)))] });
offers.push(
  ...[['nuggets',1300],['wings',1400],['fish',1800],['muffin',1600],['hashbrown',700],['pancakes',1200],['sundae',900],['shake',1200],['tea',1000],['orange',1000],['latte',1600]].map(([id,price]) => ({ ...single(id, price), category: foods.find(f => f.id === id).category })),
  bundle('nuggets-set','鸡块薯乐三件套',2990,['nuggets','fries-m','cola-m'],'side','小食餐'),
  bundle('nuggets-fries','鸡块薯条双拼',1890,['nuggets','fries-m'],'side','双拼'),
  bundle('wings-set','鸡翅柠檬茶三件套',3290,['wings','fries-m','tea'],'side','小食餐'),
  bundle('wings-fries','鸡翅薯条双拼',2190,['wings','fries-m'],'side','双拼'),
  bundle('breakfast-set','早餐堡咖啡三件套',3290,['muffin','hashbrown','coffee'],'breakfast','早餐'),
  bundle('muffin-hash','早餐堡与薯饼',1790,['muffin','hashbrown'],'breakfast','早餐双拼'),
  bundle('pancakes-set','香饼橙汁早餐',2490,['pancakes','hashbrown','orange'],'breakfast','早餐'),
  bundle('pancakes-orange','热香饼与橙汁',1790,['pancakes','orange'],'breakfast','早餐双拼'),
  bundle('latte-sundae','拿铁与新地',1990,['latte','sundae'],'dessert','下午茶'),
  bundle('fish-set','鱼排堡茶饮三件套',3290,['fish','fries-m','tea'],'burger','三件套'),
  bundle('fish-fries','鱼排堡薯条双拼',2190,['fish','fries-m'],'burger','双拼')
);
const extraRound = (id, number, label, title, ids, recommended, opponent = 'set', budgetCents = 4000) => ({ id, number, label, title, kicker: label, target: ids.map(id => part(id)), budgetCents, couponIds: [], opponent, description: ids.map(id => foods.find(f => f.id === id).name).join(' + '), hint: '试试双拼加单品，份数和规格别换。', recommended });
rounds.push(
  extraRound('breakfast','04','早餐局','早餐怎么搭？',['muffin','hashbrown','coffee'],['breakfast-set','muffin-hash','single-muffin','single-hashbrown','single-coffee']),
  extraRound('nuggets','05','小食局','鸡块这一餐，怎么搭？',['nuggets','fries-m','cola-m'],['nuggets-set','nuggets-fries','single-nuggets','single-fries-m','single-cola-m']),
  extraRound('afternoon','06','下午茶','拿铁配新地。',['latte','sundae'],['latte-sundae','single-latte','single-sundae'],'search'),
  extraRound('pancakes','07','香饼局','热香饼怎么搭？',['pancakes','hashbrown','orange'],['pancakes-set','pancakes-orange','single-pancakes','single-hashbrown','single-orange']),
  extraRound('fish','08','鱼排局','换个鱼排堡。',['fish','fries-m','tea'],['fish-set','fish-fries','single-fish','single-fries-m','single-tea'])
);
export const catalog = { foods, offers, coupons, categories };
export function catalogForVersion(version = DATA_VERSION) {
  if (version === DATA_VERSION) return catalog;
  if (version === LEGACY_DATA_VERSION) return legacyCatalog;
  throw new Error('训练题数据版本不一致，请让朋友重新生成链接');
}
