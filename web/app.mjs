import { catalog, foods, rounds, opponents, catalogForVersion, DATA_VERSION } from './data.mjs';
import { MODEL_SERVICES } from './model-services.mjs';
import { money, bagOf, compareBags, expandPlan, evaluatePlan, chooseOpponent, verdict } from './engine.mjs';
import { descriptorFor, resolveDescriptor, challengeURL, decodeChallenge } from './challenge.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { round: rounds[0], catalog, plan: [], couponId: null, filter: 'all', variants: {}, locked: false, revealed: false, hinted: false, mode: 'training', opponent: null, liveId: null, modelRoundId: null, opponentMeta: null, opponentCommitment: null, liveEvaluation: null, quoteVersion: 0, viewVersion: 0, menuExpanded: false, invitation: null, nearArena: false };
let toastTimer, quoteTimer;
let visitorProfile = null; // Page memory only; never included in challenge or result state.
let dialogVersion = 0, dialogRequest = null;

function foodArt(foodOrType, extra = '') {
  const food = typeof foodOrType === 'string' ? { icon: foodOrType } : foodOrType;
  const type = food.icon;
  const shadow = '<ellipse cx="80" cy="115" rx="59" ry="8" fill="#27291f" opacity=".12"/>';
  let drawing = '';
  if (type === 'burger') drawing = `${shadow}<path d="M24 88Q80 102 136 88L132 105Q80 125 28 105Z" fill="#c87b32"/><path d="M25 88Q80 99 135 88L135 97Q80 112 25 97Z" fill="#eaaa4d"/><path d="M20 78Q32 71 42 78Q54 68 67 77Q81 67 92 78Q105 68 117 78Q130 70 141 78L137 88Q126 86 117 90Q102 84 91 91Q77 86 65 91Q53 85 40 91L24 87Z" fill="#6e913d"/><path d="M24 68Q80 58 137 70L136 80Q80 90 23 80Z" fill="${food.kind === 'beef' ? '#623c28' : '#b15e28'}"/><path d="M28 66L72 57L133 66L111 80L88 72L62 80Z" fill="#f7cf52"/><path d="M25 62Q25 20 80 19Q135 20 135 62Q80 79 25 62Z" fill="#dfa149"/><path d="M29 49Q42 18 82 23Q119 23 132 50Q80 63 29 49Z" fill="#f4c16b"/><path d="M40 37L45 34M59 29L63 28M79 30L83 28M102 32L106 34M116 42L120 43M57 46L61 43M89 45L93 44" stroke="#fff0bc" stroke-width="3" stroke-linecap="round"/>`;
  else if (type === 'fries') drawing = `${shadow}<g stroke="#d89b26" stroke-width="1"><path d="M37 74L31 20L42 18L49 74Z" fill="#f6c74d"/><path d="M51 74L49 10L60 10L65 75Z" fill="#ffdc70"/><path d="M67 76L64 23L76 21L79 77Z" fill="#edb638"/><path d="M80 76L81 7L93 9L92 78Z" fill="#ffda67"/><path d="M95 77L103 17L115 19L107 80Z" fill="#f2bd3f"/><path d="M110 77L119 29L130 32L121 80Z" fill="#ffdc70"/><path d="M40 83L39 37L50 35L54 84Z" fill="#ffdb69"/><path d="M73 83L77 35L88 37L86 85Z" fill="#ffe586"/></g><path d="M28 61Q80 83 133 61L121 108Q82 126 41 108Z" fill="#bb382b"/><path d="M29 62Q80 84 132 62L128 80Q78 99 33 79Z" fill="#d4523a"/><path d="M46 87L115 87L111 95L49 95Z" fill="#f6ca59"/><path d="M50 100L107 100L105 104L51 104Z" fill="#f6ca59" opacity=".7"/>`;
  else if (type === 'drink') drawing = `${shadow}<path d="M97 17L105 1L116 4" fill="none" stroke="#e4ad43" stroke-width="7" stroke-linecap="round"/><path d="M50 25L113 25L105 109Q81 120 58 109Z" fill="${({ zero: '#34382f', orange: '#e8a22c', tea: '#bb8b47', shake: '#d3b99d' })[food.kind] ?? '#b9362c'}"/><path d="M51 28L66 30L70 111L59 108Z" fill="#ffffff24"/><path d="M50 48L111 53L110 66L53 61Z" fill="#f5e8cf"/><path d="M53 74L109 79L108 91L55 87Z" fill="#f5e8cf"/><ellipse cx="81" cy="25" rx="34" ry="8" fill="#e7e2d5"/><ellipse cx="81" cy="23" rx="29" ry="5" fill="#faf5e7"/><path d="M97 24L102 11" stroke="#d49a33" stroke-width="6"/>${food.kind === 'zero' ? '<text x="81" y="65" text-anchor="middle" font-size="9" font-family="Arial" font-weight="900" fill="#333">ZERO</text>' : ''}`;
  else if (type === 'coffee') drawing = `${shadow}<path d="M108 45Q145 39 136 72Q130 83 108 80" fill="none" stroke="#e0cbaa" stroke-width="9"/><path d="M38 35L118 35L110 102Q78 124 46 102Z" fill="#e7dbc3"/><path d="M43 58L114 58L111 85L46 85Z" fill="#416448"/><ellipse cx="78" cy="35" rx="42" ry="10" fill="#c4b598"/><ellipse cx="78" cy="34" rx="34" ry="6" fill="#5a392b"/><path d="M65 18Q54 8 65 0M84 18Q74 7 84 -2M100 17Q91 7 100 0" fill="none" stroke="#c0b69f" stroke-width="3" stroke-linecap="round"/>`;
  else if (type === 'nuggets' || type === 'wings') drawing = `${shadow}<path d="M21 77L139 77L128 108L33 108Z" fill="#e3c8a0"/>${[0,1,2,3,4,5].map((n) => `<rect x="${30 + n % 3 * 34}" y="${39 + Math.floor(n / 3) * 29}" width="${type === 'wings' ? 38 : 32}" height="27" rx="12" fill="${n % 2 ? '#d19a3c' : '#e5b75a'}" transform="rotate(${n % 2 ? -12 : 10} ${47 + n % 3 * 34} ${52 + Math.floor(n / 3) * 29})"/>`).join('')}`;
  else if (type === 'hashbrown') drawing = `${shadow}<rect x="33" y="30" width="94" height="72" rx="26" transform="rotate(-12 80 66)" fill="#d19a34"/><rect x="38" y="31" width="83" height="60" rx="22" transform="rotate(-12 80 66)" fill="#f0be57"/><path d="M52 49L61 43M76 46L83 42M96 56L106 49M57 69L66 62M80 75L88 68M100 78L109 71" stroke="#d49a37" stroke-width="4"/>`;
  else if (type === 'pancakes' || type === 'muffin') drawing = `${shadow}<ellipse cx="80" cy="100" rx="63" ry="15" fill="#e6dfce"/>${[85,71,57].map((y, n) => `<ellipse cx="80" cy="${y}" rx="48" ry="17" fill="${n === 2 ? '#edbf71' : '#ca8740'}"/>`).join('')}<path d="M64 47L85 43L101 51L79 57Z" fill="#f8dd86"/>${type === 'muffin' ? '<path d="M35 73L126 73L121 83L40 83Z" fill="#f4d361"/>' : '<path d="M94 56Q109 63 98 83" stroke="#ab6b30" stroke-width="9" stroke-linecap="round"/>'}`;
  else if (type === 'sundae') drawing = `${shadow}<path d="M44 65L116 65L106 107Q80 118 54 107Z" fill="#dfb9a3"/><path d="M42 65Q31 48 58 42Q47 27 77 23Q73 10 91 5Q87 24 104 31Q126 42 111 51Q135 67 113 75L47 75Z" fill="#f8eddb"/><path d="M53 48Q79 35 108 45M47 64Q81 52 118 62" fill="none" stroke="#c35447" stroke-width="7"/>`;
  else drawing = `${shadow}<path d="M26 55L103 23L138 77L60 110Z" fill="#d68f39"/><path d="M28 52L103 22L129 63L57 96Z" fill="#edb963"/><path d="M42 55L107 29M48 67L114 41M56 81L123 54" stroke="#ba782f" stroke-width="3" stroke-linecap="round"/><path d="M26 55L60 110L57 96L28 52Z" fill="#c47d2d"/>`;
  return `<svg class="food-art ${esc(extra)}" viewBox="0 0 160 130" aria-hidden="true">${drawing}</svg>`;
}
function findFood(id) { return state.catalog.foods.find(f => f.id === id) ?? { id, name: id, short: id, icon: 'burger' }; }
function partNames(items) { return items.map(item => `${findFood(item.foodId).short ?? findFood(item.foodId).name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join(' + '); }
function offerArt(offer, variant) {
  if (variant.items.length === 1) return foodArt(findFood(variant.items[0].foodId));
  return `<div class="meal-art">${variant.items.slice(0, 3).map(item => foodArt(findFood(item.foodId))).join('')}</div>`;
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
function cancelDialogRequest() { dialogRequest?.abort(); dialogRequest = null; }
function openDialog(title, content) { dialogVersion++; cancelDialogRequest(); closeCart(); $('dialog-content').onclick = null; $('dialog-content').onsubmit = null; $('dialog-title').textContent = title; $('dialog-content').innerHTML = content; if (!$('info-dialog').open) $('info-dialog').showModal(); }
function closeDialog() { dialogVersion++; cancelDialogRequest(); $('info-dialog').close(); }
function rules() { openDialog('怎么玩', `<div class="dialog-copy"><ol><li>看目标餐品，确认份数和规格。</li><li>用套餐、双拼或单点配齐；用券前先看条件。</li><li>锁定餐单，翻牌比价。少餐、换规格或超预算都不算赢。</li></ol><p class="note">训练价为示例。真实价格需在本机接入官方 MCP 后查询。</p></div>`); }

function renderRoundTabs() { const visible = rounds.slice(0, 3); if (rounds.slice(3).some(r => r.id === state.round.id)) visible.push(state.round); $('round-tabs').innerHTML = visible.map(round => `<button class="round-tab ${state.round.id === round.id ? 'active' : ''}" data-round="${round.id}" aria-pressed="${state.round.id === round.id}"><small>${round.number}</small>${round.label}<span>${round.kicker}</span></button>`).join('') + '<button class="round-tab more-rounds" id="more-rounds"><small>＋</small>更多题目<span>早餐 / 小食 / 甜品</span></button>' + (state.round.id === 'custom' ? '<button class="round-tab active" aria-pressed="true"><small>★</small>你的题目</button>' : state.mode === 'live' ? '<button class="round-tab active" aria-pressed="true"><small>实</small>真实同餐</button>' : ''); }
function renderBrief() {
  $('round-stamp').textContent = `ROUND ${state.round.number}`;
  $('round-title').textContent = state.round.title;
  $('round-description').textContent = state.round.description;
  $('budget-number').textContent = money(state.round.budgetCents);
  $('target-bag').innerHTML = state.round.target.map(item => `<div class="target-item">${foodArt(findFood(item.foodId))}<span>${esc(findFood(item.foodId).short ?? findFood(item.foodId).name)}</span><small>×${item.quantity}</small></div>`).join('');
  const opponent = opponentInfo();
  $('opponent-name').textContent = opponent.name;
  $('opponent-line').textContent = opponent.line;
  $('opponent-switch').textContent = state.opponentMeta?.kind === 'llm' ? '重新邀请 / 换对手 ↗' : '用自己的 AI ↗';
  $('opponent-switch').disabled = state.locked;
  $('invitation-banner').hidden = !state.invitation;
  $('invitation-banner').textContent = state.invitation ? `朋友出的题，按相同规则比价。${state.invitation.benchmark ? '翻牌后可看朋友的成绩。' : '配好餐就能翻牌。'}` : '';
}
function sortedOffers() { return [...state.catalog.offers].sort((a, b) => {
  const order = state.round.recommended ?? [];
  const aa = order.indexOf(a.id), bb = order.indexOf(b.id);
  return (aa < 0 ? 100 : aa) - (bb < 0 ? 100 : bb);
}); }
function renderOffers() {
  const recommended = state.round.recommended ?? [];
  const compact = !state.menuExpanded && recommended.length > 0;
  const candidates = sortedOffers().filter(o => !compact || recommended.includes(o.id));
  $('menu-category').innerHTML = '<option value="all">全部品类</option>' + (state.catalog.categories ?? []).map(c => `<option value="${esc(c.id)}" ${state.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  $('menu-category').parentElement.hidden = !(state.catalog.categories?.length);
  $('offer-grid').innerHTML = candidates.filter(o => (state.filter === 'all' || o.type === state.filter) && (!state.category || state.category === 'all' || o.category === state.category)).map(offer => {
    const variant = offer.variants.find(v => v.id === state.variants[offer.id]) ?? offer.variants[0];
    return `<article class="offer-card" draggable="${!state.locked}" data-offer="${esc(offer.id)}"><span class="offer-tag">${esc(offer.tag)}</span><div class="card-art">${offerArt(offer, variant)}</div><h4>${esc(offer.name)}</h4><p class="offer-description">${esc(partNames(variant.items))}</p>${offer.variants.length > 1 ? `<select aria-label="${esc(offer.name)}的搭配" data-variant="${esc(offer.id)}" ${state.locked ? 'disabled' : ''}>${offer.variants.map(v => `<option value="${esc(v.id)}" ${v.id === variant.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : ''}<div class="offer-bottom"><span class="offer-price">${money(variant.priceCents)} <small>${state.mode === 'live' ? '参考价' : '示例'}</small></span><button class="add-offer" data-add="${esc(offer.id)}" aria-label="加入${esc(offer.name)}" ${state.locked ? 'disabled' : ''}>＋</button></div></article>`;
  }).join('') || '<p class="coupon-note">没有符合筛选的餐品，试试「全部」。</p>';
  document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $('menu-expand').hidden = !recommended.length || recommended.length >= state.catalog.offers.length;
  $('menu-expand').textContent = state.menuExpanded ? '只看本局推荐 ↑' : `全部菜单 · ${state.catalog.offers.length} 种买法 ↓`;
}
function currentEvaluation() {
  if (state.mode === 'live') {
    const expanded = expandPlan(state.plan, state.catalog), comparison = compareBags(expanded.items, state.round.target);
    if (state.liveEvaluation) return state.liveEvaluation;
    return { valid: false, quote: null, comparison, overBudget: false, error: null, pending: comparison.equal };
  }
  return evaluatePlan(state.plan, state.couponId, state.round, state.catalog);
}
function renderCart() {
  const evaluation = currentEvaluation();
  $('cart-lines').innerHTML = state.plan.length ? state.plan.map((line, index) => {
    const offer = state.catalog.offers.find(o => o.id === line.offerId), variant = offer.variants.find(v => v.id === line.variantId);
    return `<div class="cart-line"><div class="cart-line-name"><b>${esc(offer.name)}</b><small>${esc(variant.name)}</small></div><div class="quantity-controls"><button data-quantity="${index}" data-delta="-1" aria-label="减少${esc(offer.name)}" ${state.locked ? 'disabled' : ''}>−</button><span>${line.quantity}</span><button data-quantity="${index}" data-delta="1" aria-label="增加${esc(offer.name)}" ${state.locked ? 'disabled' : ''}>＋</button></div><strong>${money(variant.priceCents * line.quantity)}</strong></div>`;
  }).join('') : `<div class="cart-empty"><div class="empty-bag">▱</div><p>点击餐品旁的＋，<br>或把餐品拖进来。</p><button id="first-bundle">先加一份套餐 ↗</button></div>`;
  const comparison = evaluation.comparison;
  const check = $('bag-check'); check.className = 'bag-check';
  if (evaluation.error) { check.classList.add('bad'); check.textContent = evaluation.error; }
  else if (comparison?.equal) { check.classList.add(evaluation.overBudget ? 'bad' : 'good'); check.textContent = evaluation.overBudget ? `餐袋一致，但超预算 ${money(evaluation.quote.totalCents - state.round.budgetCents)}` : evaluation.pending ? '餐品已配齐，正在核价…' : '✓ 餐袋已对齐，规格和份数一致'; }
  else if (comparison) { check.classList.toggle('bad', !!comparison.extra.length); check.innerHTML = `${comparison.missing.length ? `<span>还差：${esc(partNames(comparison.missing))}</span>` : ''}${comparison.extra.length ? `<br><span>多了：${esc(partNames(comparison.extra))}</span>` : ''}`; }
  $('coupon-area').innerHTML = state.round.couponIds.length ? `<p class="coupon-label"><span>选一张券</span><span>双方条件相同</span></p><select id="coupon-select" aria-label="选择优惠券" ${state.locked ? 'disabled' : ''}><option value="">这次不用券</option>${state.round.couponIds.map(id => { const coupon = state.catalog.coupons.find(c => c.id === id); return `<option value="${esc(id)}" ${state.couponId === id ? 'selected' : ''}>${esc(coupon.name)}</option>`; }).join('')}</select><p class="coupon-note">${esc(state.catalog.coupons.find(c => c.id === state.couponId)?.description ?? '先看用券条件。')}</p>` : '<p class="coupon-note">本局不用券。</p>';
  $('cart-price').textContent = evaluation.quote ? money(evaluation.quote.totalCents) : state.plan.length ? '待核验' : '¥0.00';
  $('discount-label').textContent = evaluation.quote?.discountCents ? `已减 ${money(evaluation.quote.discountCents)}` : state.mode === 'live' ? '对齐餐袋后整单官方核价' : '';
  $('submit-plan').disabled = state.locked || !!evaluation.pending;
  $('submit-plan').innerHTML = state.locked ? '餐单已锁定 <span>✓</span>' : '锁定餐单 <span>↗</span>';
  $('cart-clear').disabled = state.locked;
  renderDock(evaluation);
}
function render() {
  renderRoundTabs(); renderBrief(); renderOffers(); renderCart();
  document.querySelector('.menu-footnote').textContent = state.mode === 'live' ? '图片和卡面价格供参考，实付按官方整单核价。' : '示意图与示例价格，非门店报价。';
  document.querySelector('.price-row span').textContent = state.mode === 'live' ? '官方核价' : '示例合计';
}
function mutatePlan() { state.liveEvaluation = null; state.quoteVersion++; renderCart(); if (state.mode === 'live') queueLiveQuote(); }
function addOffer(id, variantId) {
  if (state.locked) return;
  if (state.plan.reduce((sum, line) => sum + line.quantity, 0) >= 8) { toast('一局最多选择 8 份商品'); return; }
  const offer = state.catalog.offers.find(o => o.id === id);
  if (!offer) return;
  const variant = offer.variants.find(v => v.id === (variantId ?? state.variants[id])) ?? offer.variants[0];
  const existing = state.plan.find(line => line.offerId === id && line.variantId === variant.id);
  if (existing) existing.quantity++; else state.plan.push({ offerId: id, variantId: variant.id, quantity: 1 });
  mutatePlan(); $('cart-lines').classList.remove('pulse-add'); requestAnimationFrame(() => $('cart-lines').classList.add('pulse-add'));
}
function selectRound(round) {
  closeCart(); state.viewVersion++;
  clearTimeout(quoteTimer); state.quoteVersion++;
  Object.assign(state, { round, catalog: catalogForVersion(round.dataVersion ?? DATA_VERSION), mode: 'training', liveId: null, modelRoundId: null, modelTicket: null, category: 'all', opponentMeta: null, opponentCommitment: null, liveEvaluation: null, plan: [], couponId: null, variants: {}, filter: 'all', locked: false, revealed: false, hinted: false, menuExpanded: false, invitation: null });
  state.opponent = chooseOpponent(round, state.catalog);
  $('data-info').innerHTML = '<span></span>演示训练场';
  $('result-section').hidden = true; document.body.classList.remove('locked'); render();
}
function bagDialog() {
  const { items } = expandPlan(state.plan, state.catalog), actual = bagOf(items), target = bagOf(state.round.target);
  const rows = [...new Set([...actual.keys(), ...target.keys()])].map(key => { const [foodId] = JSON.parse(key), food = findFood(foodId); return `<div class="dialog-bag-row">${foodArt(food)}<div><b>${esc(food.name)}</b><p class="coupon-note">按规格和默认配料核对</p></div><span>${actual.get(key) ?? 0} / ${target.get(key) ?? 0} 份</span></div>`; }).join('');
  openDialog('核对餐品', `<div class="dialog-copy"><p>已选 / 本局需要</p>${rows}<p class="note">餐品、份数、规格和配料都要一致。</p></div>`);
}
function lockPlan() {
  closeCart();
  const evaluation = currentEvaluation();
  if (!evaluation.valid) { toast(evaluation.error ?? (evaluation.overBudget ? '超预算了，换个买法试试。' : '餐品还没配齐，先核对一下。')); bagDialog(); return; }
  state.locked = true; document.body.classList.add('locked'); renderOffers(); renderCart();
  $('result-section').hidden = false;
  $('result-section').innerHTML = `<div class="result-locked"><p class="eyebrow">BOTH PLANS ARE LOCKED</p><h2>餐单已锁定。</h2><p>AI 已提前提交餐单，翻牌看结果。</p><button class="primary-button yellow-button" id="reveal-button">翻牌 <span>↗</span></button></div>`;
  $('result-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function planCard(title, evaluation, winning, sublabel) {
  return `<article class="duel-card ${winning ? 'winning' : ''}"><div class="duel-card-title">${esc(title)} <span>${esc(sublabel)}</span></div><div class="duel-price">${money(evaluation.quote.totalCents)}</div><ul>${evaluation.quote.lines.map(line => `<li>${esc(line.offer.name)} ×${line.quantity}<small>${esc(line.variant.name)}</small></li>`).join('')}</ul><div class="coupon-result">${evaluation.quote.coupon ? `使用：${esc(evaluation.quote.coupon.name)}` : '未使用优惠券'}</div></article>`;
}
async function reveal() {
  const version = state.viewVersion, button = $('reveal-button');
  button.disabled = true;
  let player = currentEvaluation(), opponent = state.opponent;
  if (state.mode === 'live' || state.modelRoundId || state.modelTicket) {
    try {
      const response = await api(state.mode === 'live' ? '/api/live/reveal' : '/api/model/reveal', { roundId: state.liveId ?? state.modelRoundId, ticket: state.modelTicket, plan: state.plan, couponId: state.couponId });
      if (version !== state.viewVersion) return;
      await verifyCommitment(response);
      if (version !== state.viewVersion) return;
      player = response.player; opponent = response.opponent; state.liveEvaluation = player; state.opponent = opponent;
    } catch (error) { if (version === state.viewVersion) { toast(error.message); if ($('reveal-button') === button) button.disabled = false; } return; }
  }
  const result = verdict(player, opponent);
  const winner = result.status === 'win' ? '你省下' : result.status === 'loss' ? '对手省下' : '双方差额';
  const difference = money(Math.abs(result.differenceCents ?? 0));
  const proof = compareBags(player.quote.items, opponent?.quote.items ?? []);
  if (!opponent || !proof.equal) { toast('对手餐品核验失败，暂不判胜。'); return; }
  state.result = result; state.revealed = true;
  $('result-section').innerHTML = `<div class="result-heading"><p class="eyebrow">ROUND ${state.round.number}</p><h2 id="result-title">${esc(result.label)}</h2><p>${winner} ${difference}。${state.hinted ? '这局用过提示。' : ''}</p></div><div class="duel-cards">${planCard('你', player, result.status !== 'loss', '你的餐单')}<div class="duel-divider">VS</div>${planCard(opponentInfo().name, opponent, result.status !== 'win', '提前提交')}</div><div class="result-proof"><b>✓ 餐品、份数和规格一致</b><br>${esc(partNames(state.round.target))}<br>${state.mode === 'live' ? '同一门店，双方已分别核价。' : '按本局示例价格计算。'}${state.opponentMeta?.kind === 'llm' ? `<br>${esc(state.opponentMeta.summary)}` : ''}${state.opponentCommitment ? '<br>✓ 对手餐单与开局时一致。' : ''}</div>${invitationResult(player)}<div class="result-actions"><button class="primary-button yellow-button" id="next-round">${state.mode === 'live' ? '再选一餐' : '下一局'} <span>↗</span></button><button class="outline-button" id="retry-round">再试一次</button>${result.status === 'loss' ? '<button class="outline-button" id="adopt-opponent">试试 AI 的买法</button>' : ''}<button class="outline-button" id="share-result">邀请朋友 ↗</button><button class="outline-button" id="save-result">保存战绩 ↗</button></div><p class="result-note">${state.mode === 'live' ? `${esc(state.round.storeName ?? '所选门店')} 本次报价，改餐单后需重算。` : '示例价格，非门店售价。'}${state.opponentMeta?.kind === 'llm' ? `对手：${esc(state.opponentMeta.model)}，最多试算 3 次。` : ''}不保证最低价。</p>`;
  $('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function retry(adopt = false) {
  if (adopt && state.opponent) { state.plan = structuredClone(state.opponent.plan); state.couponId = state.opponent.couponId; }
  state.locked = false; state.revealed = false; $('result-section').hidden = true; document.body.classList.remove('locked'); mutatePlan(); renderOffers();
  $('arena').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function saveResult() {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1160; const c = canvas.getContext('2d');
  c.fillStyle = '#f5f1e8'; c.fillRect(0, 0, 1000, 1160); c.fillStyle = '#b93729'; c.fillRect(0, 0, 1000, 170);
  c.font = 'bold 23px Arial'; c.fillStyle = '#fffdf7'; c.fillText('BITE BATTLE CLUB / ROUND ' + state.round.number, 65, 70); c.font = 'bold 44px "Microsoft YaHei", sans-serif'; c.fillText('麦麦点餐擂台', 65, 130);
  c.fillStyle = '#27291f'; c.font = 'bold 53px "Microsoft YaHei", sans-serif'; c.fillText(state.result.status === 'win' ? '这局，我更会点。' : state.result.status === 'tie' ? '和 AI 打了个平手。' : '这局 AI 更省。', 65, 280);
  c.font = '25px "Microsoft YaHei", sans-serif'; c.fillStyle = '#777b69'; c.fillText('同一袋餐，品种 / 份数 / 杯型一致', 65, 345);
  const player = currentEvaluation(); c.fillStyle = '#27291f'; c.font = 'bold 30px "Microsoft YaHei", sans-serif'; c.fillText('我的实付', 65, 465); c.fillText(opponentInfo().name.slice(0, 14), 540, 465); c.font = 'bold 75px Arial'; c.fillText(money(player.quote.totalCents), 65, 555); c.fillText(money(state.opponent.quote.totalCents), 540, 555);
  c.strokeStyle = '#d7d1c5'; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(65, 620); c.lineTo(935, 620); c.stroke(); c.setLineDash([]);
  c.font = '26px "Microsoft YaHei", sans-serif'; c.fillStyle = '#515845'; let y = 700;
  for (const item of state.round.target) { c.fillText(`${findFood(item.foodId).name} × ${item.quantity}`, 65, y); y += 48; }
  c.fillStyle = '#b93729'; c.font = 'bold 24px "Microsoft YaHei", sans-serif'; c.fillText(state.mode === 'live' ? '本次官方核价 · 修改后需重算' : '示例训练数据 · 非真实报价', 65, 1000);
  c.font = '18px "Microsoft YaHei", sans-serif'; c.fillStyle = '#777b69'; c.fillText(`独立参赛作品，非麦当劳官方产品。对手：${opponentInfo().name}。`, 65, 1050);
  c.fillText(new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' }).format(new Date()), 65, 1090);
  canvas.toBlob(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '麦麦点餐擂台-战绩卡.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('战绩卡已保存。'); });
}
function opponentInfo() {
  if (state.opponentMeta?.kind === 'llm') return { name: state.opponentMeta.name ?? '自带模型', line: '我选好了，轮到你。', explanation: `${state.opponentMeta.model} 用同一份菜单，最多试算 3 次后提交餐单。` };
  return opponents[state.round.opponent];
}
function renderDock(evaluation = currentEvaluation()) {
  const count = state.plan.reduce((sum, line) => sum + line.quantity, 0);
  $('dock-count').textContent = count;
  $('dock-price').textContent = evaluation.quote ? money(evaluation.quote.totalCents) : count ? '待核价' : '¥0.00';
  $('dock-status').textContent = !count ? '点餐品旁的＋' : evaluation.pending ? '餐品已配齐 · 核价中' : evaluation.valid ? '餐品已配齐' : evaluation.overBudget ? '超预算 · 点开调整' : evaluation.error ? '核价失败 · 点开重试' : '餐品没配齐 · 点开看看';
  $('dock-bag').setAttribute('aria-label', `查看餐袋，已选 ${count} 份商品`);
  $('dock-submit').disabled = !!evaluation.pending;
  $('dock-submit').textContent = !count ? '先选餐品 ↗' : evaluation.pending ? '官方核价中…' : evaluation.valid ? '锁定餐单 ↗' : '核对餐袋 ↗';
  $('mobile-dock').hidden = !state.nearArena || state.locked || state.revealed;
}
function closeCart() { if ($('cart-dialog').open) $('cart-dialog').close(); }
function showCart() {
  if (!matchMedia('(max-width:760px)').matches) { $('cart-home').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if ($('cart-dialog').open) return;
  $('cart-dialog-content').appendChild(document.querySelector('.player-card'));
  $('cart-dialog').showModal();
}
function applyRemote(value) {
  clearTimeout(quoteTimer); state.quoteVersion++; state.viewVersion++;
  const live = value.source === 'official';
  Object.assign(state, { mode: live ? 'live' : 'training', round: value.round, catalog: value.catalog ?? catalogForVersion(value.round.dataVersion ?? DATA_VERSION), liveId: live ? value.roundId : null, modelRoundId: live ? null : value.roundId, modelTicket: value.ticket ?? null, category: 'all', opponentMeta: value.opponentMeta, opponentCommitment: value.opponentCommitment, plan: [], couponId: null, locked: false, revealed: false, hinted: false, variants: {}, filter: 'all', menuExpanded: false, liveEvaluation: null, opponent: null });
  closeDialog(); closeCart(); $('data-info').innerHTML = `<span></span>${live ? '本机真实核价' : '演示训练场'}`;
  $('result-section').hidden = true; document.body.classList.remove('locked'); render(); $('arena').scrollIntoView({ behavior: 'smooth' });
}
async function verifyCommitment(response) {
  if (!state.opponentCommitment || response.opponentCommitment !== state.opponentCommitment || typeof response.opponentNonce !== 'string') throw new Error('对手方案承诺不一致，本局不判胜');
  const bytes = new TextEncoder().encode(JSON.stringify({ plan: response.opponent.plan, couponId: response.opponent.couponId ?? null, nonce: response.opponentNonce }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== state.opponentCommitment) throw new Error('无法验证对手的原始方案，本局不判胜');
}
async function opponentDialog() {
  openDialog('用自己的 AI', `<div class="dialog-copy"><p>AI 先选，你再来。新对局开始后会清空当前餐单。</p><form id="byok-form" class="byok-form"><label>模型服务<select id="model-service">${MODEL_SERVICES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Base URL<input id="model-base" type="url" maxlength="500" required autocomplete="off" spellcheck="false"></label><label>模型 ID<input id="model-id" maxlength="160" required autocomplete="off" spellcheck="false" placeholder="服务商提供的模型 ID"></label><label>API Key<input id="model-key" type="password" maxlength="4096" required autocomplete="off" spellcheck="false" placeholder="仅本页暂存"></label><p class="coupon-note">模型需支持工具调用。自定义接口仅限已开放的域名。</p><div class="share-actions"><button class="primary-button" id="choose-byok" type="submit">开始对战 ↗</button><button class="text-button" id="clear-model" type="button">清除配置</button></div></form><p id="model-feedback" class="coupon-note" role="status"></p><button class="choice-card" id="choose-strategy"><b>先和策略 AI 玩</b><span>无需 API，直接玩。</span></button><button class="choice-card" id="choose-model" hidden disabled><b>本机 DeepSeek</b><span id="model-status"></span></button><p class="note">请在可信页面填写。密钥仅在本页暂存，刷新或清除配置即可移除；请求经本站转发给所选服务商，不写入应用持久存储或分享链接。每次邀请最多试算 3 次，使用你的 API 额度。服务商按其政策处理请求。</p></div>`);
  const epoch = state.viewVersion, dialogEpoch = dialogVersion;
  let localModelReady = false;
  const sameDialog = () => dialogEpoch === dialogVersion && epoch === state.viewVersion && $('info-dialog').open;
  const fillService = id => { const service = MODEL_SERVICES.find(s => s.id === id); $('model-base').value = service.baseUrl; $('model-id').value = service.model; };
  $('model-service').onchange = () => fillService($('model-service').value);
  if (visitorProfile) { $('model-service').value = visitorProfile.service; $('model-base').value = visitorProfile.baseUrl; $('model-id').value = visitorProfile.model; $('model-key').value = visitorProfile.apiKey; }
  else fillService('deepseek');
  const start = async profile => {
    if (dialogRequest) return;
    const request = new AbortController(); dialogRequest = request;
    const current = () => sameDialog() && dialogRequest === request;
    $('choose-byok').disabled = true; $('choose-model').disabled = true; $('choose-strategy').disabled = true;
    $('model-feedback').textContent = 'AI 正在选餐，请稍等…';
    const invitation = state.invitation;
    try {
      const value = state.mode === 'live'
        ? await api('/api/live/prepare', { caseId: state.round.caseId, mealCode: state.round.mealCode, storeCode: state.round.storeCode, opponent: 'llm', ...(profile ? { profile } : {}) }, request.signal)
        : await api('/api/model/prepare', { challenge: descriptorFor(state.round), ...(profile ? { profile } : {}) }, request.signal);
      if (!current() || request.signal.aborted) return;
      if (profile) visitorProfile = profile;
      applyRemote(value); state.invitation = invitation; renderBrief(); toast('AI 选好了，轮到你。');
    } catch (error) { if (current() && !request.signal.aborted) $('model-feedback').textContent = error.message; }
    finally { if (current()) { dialogRequest = null; $('choose-byok').disabled = false; $('choose-model').disabled = !localModelReady; $('choose-strategy').disabled = false; } }
  };
  $('dialog-content').onsubmit = event => {
    if (event.target.id !== 'byok-form') return;
    event.preventDefault();
    start({ service: $('model-service').value, baseUrl: $('model-base').value.trim(), model: $('model-id').value.trim(), apiKey: $('model-key').value.trim() });
  };
  $('dialog-content').onclick = async event => {
    if (event.target.closest('#clear-model')) { cancelDialogRequest(); visitorProfile = null; $('model-key').value = ''; $('model-service').value = 'deepseek'; fillService('deepseek'); $('choose-byok').disabled = false; $('choose-model').disabled = !localModelReady; $('choose-strategy').disabled = false; $('model-feedback').textContent = '配置已清除，当前对局可继续。'; }
    if (event.target.closest('#choose-strategy')) {
      if (state.mode === 'live') { const invite = descriptorFor(state.round, 'live'); liveDialog(invite); }
      else { const round = state.round; const invitation = state.invitation; closeDialog(); selectRound(round); state.invitation = invitation; renderBrief(); }
    }
    if (event.target.closest('#choose-model')) start(null);
  };
  try {
    const status = await api('/api/status');
    if (!sameDialog()) return;
    localModelReady = !!status.deepseek?.configured;
    $('model-status').textContent = status.deepseek?.configured ? `${status.deepseek.model} · 使用本机 .env 配置` : '';
    $('choose-model').disabled = !localModelReady || !!dialogRequest;
    $('choose-model').hidden = !status.deepseek?.configured;
    if (!status.byokEnabled && !dialogRequest) $('model-feedback').textContent = '模型服务暂不可用，可先玩策略局。';
  } catch { if (sameDialog() && !dialogRequest) $('model-feedback').textContent = '模型接入暂不可用，请稍后再试。'; }
}
function moreRoundsDialog() {
  openDialog('选一局', `<div class="round-choice-grid">${rounds.map(round => `<button class="choice-card" data-select-round="${round.id}"><div class="round-choice-art">${round.target.map(i => foodArt(catalog.foods.find(f => f.id === i.foodId))).join('')}</div><b>${round.number} · ${esc(round.label)}</b><span>${esc(round.description)}</span></button>`).join('')}</div>`);
  $('dialog-content').onclick = event => { const button = event.target.closest('[data-select-round]'); if (button) { closeDialog(); selectRound(rounds.find(r => r.id === button.dataset.selectRound)); } };
}
function invitationResult(player) {
  const benchmark = state.invitation?.benchmark;
  if (!benchmark) return '';
  const diff = benchmark.totalCents - player.quote.totalCents;
  return `<div class="invitation-result"><b>你和朋友的成绩</b><p>邀请者：${money(benchmark.totalCents)}${benchmark.hinted ? '（用过提示）' : ''}　·　你：${money(player.quote.totalCents)}</p><p>${diff > 0 ? `这一局你少花了 ${money(diff)}。` : diff === 0 ? '你们打平了。' : `朋友少花 ${money(-diff)}，再试一次？`}</p><small>朋友的成绩已按本题规则重算。</small></div>`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const input = $('share-url'); if (input) { input.focus(); input.select(); } return false; }
}
function shareChallenge() {
  let descriptor;
  try {
    descriptor = descriptorFor(state.round, state.mode);
    if (state.mode === 'training' && state.revealed && currentEvaluation().valid) descriptor.benchmark = { plan: state.plan, couponId: state.couponId, hinted: state.hinted };
    descriptor = resolveDescriptor(descriptor).descriptor;
  } catch (error) { toast(error.message); return; }
  const url = challengeURL(descriptor, location.origin), live = state.mode === 'live';
  const text = live ? '同一份真实餐袋，邀请你重新核价挑战。' : '同一袋餐，你能比我更会点吗？';
  openDialog('邀请朋友来比一局', `<div class="dialog-copy"><p>${live ? '朋友需在本机接入 MCP，按链接中的门店与题目重新核价。' : '朋友打开链接就能玩同一道题，无需同时在线。'}${descriptor.benchmark ? '翻牌后可比双方成绩。' : ''}</p><label class="share-label" for="share-url">同题挑战链接</label><input id="share-url" class="share-url" readonly value="${esc(url)}"><div class="share-actions"><button class="primary-button" id="copy-share">复制链接 ↗</button>${navigator.share ? '<button class="outline-button" id="native-share">分享给朋友 ↗</button>' : ''}</div><p id="share-feedback" class="coupon-note" role="status"></p><p class="note">链接保留题目和规则，不含 API 密钥或 AI 餐单。朋友仍需有页面访问权限。</p></div>`);
  $('dialog-content').onclick = async event => {
    if (event.target.closest('#copy-share')) { const copied = await copyText(url); if ($('share-feedback')) $('share-feedback').textContent = copied ? '链接已复制。' : '请长按或按 Ctrl+C 复制。'; }
    if (event.target.closest('#native-share')) { try { await navigator.share({ title: '麦麦点餐擂台 · 同题挑战', text, url }); } catch (error) { if (error.name !== 'AbortError' && $('share-feedback')) $('share-feedback').textContent = '系统分享暂不可用，可以复制链接。'; } }
  };
}
function customDialog() {
  let selection = {};
  openDialog('自己出题', `<div class="dialog-copy"><p>每种最多 2 份，共选 1–5 份。AI 按相同条件选餐。</p><div class="custom-foods">${foods.map(food => `<button class="custom-food-button" data-custom-food="${food.id}">${foodArt(food)}<span>${esc(food.name)}</span></button>`).join('')}</div><p class="free-count" id="free-count">已选 0 / 5 份 · 重复点击可加减</p><label class="custom-budget">本局预算（示例元）<input type="number" id="custom-budget" min="10" max="120" step="1" value="40"></label><button class="primary-button" id="custom-confirm">开始这局 <span>↗</span></button><p id="custom-error" class="error-inline" role="status"></p></div>`);
  $('dialog-content').onclick = event => {
    const button = event.target.closest('[data-custom-food]');
    if (button) {
      const id = button.dataset.customFood, count = Object.values(selection).reduce((a, b) => a + b, 0);
      const current = selection[id] ?? 0;
      if (current === 0 && count >= 5) { $('custom-error').textContent = '最多选择 5 份；点击已选餐品可移除。'; return; }
      selection[id] = count >= 5 ? 0 : (current + 1) % 3;
      button.classList.toggle('active', selection[id] > 0); button.querySelector('b')?.remove(); if (selection[id]) button.insertAdjacentHTML('beforeend', `<b>${selection[id]}</b>`);
      $('free-count').textContent = `已选 ${Object.values(selection).reduce((a, b) => a + b, 0)} / 5 份 · 重复点击可加减`; $('custom-error').textContent = '';
    }
    if (event.target.closest('#custom-confirm')) {
      const budget = Number($('custom-budget').value);
      const target = Object.entries(selection).filter(([, n]) => n > 0).map(([foodId, quantity]) => ({ foodId, quantity, customizations: {} }));
      if (!target.length || !Number.isInteger(budget) || budget < 10 || budget > 120) { $('custom-error').textContent = '至少选一份餐品，预算填写 10–120 的整数。'; return; }
      const round = { id: 'custom', number: '★', label: '自由局', title: '你出的题', description: target.map(i=>`${foods.find(f=>f.id===i.foodId).name} ×${i.quantity}`).join(' + '), target, budgetCents: budget * 100, couponIds: [], opponent: 'search', hint: '先找能覆盖多个目标的套餐，再用单点补齐。', recommended: [] };
      if (!chooseOpponent(round, catalog)) { $('custom-error').textContent = '预算不够，调高预算或少选一些。'; return; }
      closeDialog(); selectRound(round); $('arena').scrollIntoView({ behavior: 'smooth' });
    }
  };
}
async function api(path, body, signal) {
  const timeout = AbortSignal.timeout(120000);
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('服务未返回有效数据，请刷新重试。');
  const value = await response.json(); if (!response.ok) throw new Error(value.error ?? '请求未完成，请稍后重试'); return value;
}
async function queueLiveQuote() {
  clearTimeout(quoteTimer); const version = state.quoteVersion;
  const comparison = compareBags(expandPlan(state.plan, state.catalog).items, state.round.target);
  if (!comparison.equal) return;
  quoteTimer = setTimeout(async () => {
    try { const result = await api('/api/live/quote', { roundId: state.liveId, plan: state.plan }); if (version !== state.quoteVersion || state.mode !== 'live') return; state.liveEvaluation = result; renderCart(); }
    catch (error) { if (version !== state.quoteVersion) return; state.liveEvaluation = { valid: false, quote: null, comparison, error: error.message, overBudget: false }; renderCart(); }
  }, 400);
}
async function liveDialog(invite = null) {
  let selectedStore = null, menu = null, busy = false, selectionVersion = 0;
  const epoch = state.viewVersion;
  openDialog(invite ? '朋友的真实菜单题' : '切换模式', `<div class="dialog-copy"><p><b>示例训练</b>直接玩，也可自由出题。</p><p><b>真实同餐</b>选门店、查菜单，按官方价格对战。仅限即时自取、默认配料，不用账户券。</p>${invite ? `<div class="invitation-banner">好友挑战：${esc(invite.storeName)}。需重新查询当前菜单与报价。</div>` : ''}<button class="primary-button" id="live-check">检查本机接入 ↗</button><p id="live-feedback" class="coupon-note" role="status"></p><div id="live-controls" hidden><form id="store-form" class="store-search"><label>城市<input id="store-city" maxlength="40" value="${esc(invite?.city || '上海')}" required></label><label>商圈 / 地点<input id="store-keyword" maxlength="80" value="${esc(invite?.storeName || '人民广场')}" required></label><button class="primary-button" id="store-search" type="submit">搜索门店 ↗</button></form><div id="store-results" class="store-results" role="group" aria-label="选择即时自提门店"></div><label class="model-select-label">本局对手<select id="live-opponent"><option value="strategy">套餐派 · 策略对手</option>${visitorProfile ? `<option value="visitor">${esc(visitorProfile.model)} · 本页自带 API</option>` : ''}<option value="llm" id="live-llm-option" disabled>本机 DeepSeek（尚未配置）</option></select></label><p class="coupon-note">选套餐更有搭配空间。也可先开局，再邀请自己的 AI。</p><div class="live-case-buttons">${[['chicken','麦香鸡同餐'],['bigmac','巨无霸同餐'],['fish','麦香鱼同餐'],...(invite?.caseId === 'menu' ? [['menu','好友的菜单题目']] : [])].map(([id,name]) => `<button class="outline-button live-case" data-live-case="${id}" ${id === 'menu' ? `data-meal-code="${esc(invite.mealCode)}"` : ''} disabled>${name}</button>`).join('')}</div><button class="choice-card live-case" id="live-menu-open" disabled><b>查看本店菜单 ↗</b><span>按当前供应选餐</span></button><div id="live-menu-controls" hidden><label class="category-label">菜单分类<select id="live-menu-category"></select></label><div id="live-menu-list" class="live-menu-list"></div></div><p id="live-prepare-feedback" class="coupon-note" role="status"></p></div></div>`);
  const dialogEpoch = dialogVersion;
  const active = () => dialogEpoch === dialogVersion && epoch === state.viewVersion && $('info-dialog').open;
  const feedback = message => { if (active()) $('live-feedback').textContent = message; };
  const refresh = () => { if (!active()) return; document.querySelectorAll('.live-case').forEach(b => b.disabled = busy || !selectedStore); $('store-search').disabled = busy; document.querySelectorAll('[name="selected-store"]').forEach(b => b.disabled = busy || b.dataset.closed === 'true'); };
  const resetMenu = () => { selectionVersion++; menu = null; if ($('live-menu-controls')) $('live-menu-controls').hidden = true; };
  const drawMenu = () => {
    const category = $('live-menu-category').value;
    $('live-menu-list').innerHTML = menu.meals.filter(m => !category || m.categories.includes(category)).map(m => `<button class="menu-choice live-case" data-live-case="menu" data-meal-code="${esc(m.code)}"><span><b>${esc(m.name)}</b><small>${esc(m.categories.join(' / '))}</small></span><span>${money(m.referenceCents)}<small>参考价 · 开局 ↗</small></span></button>`).join('');
    refresh();
  };
  $('live-menu-category').onchange = drawMenu;
  $('dialog-content').onsubmit = async event => {
    if (event.target.id !== 'store-form') return;
    event.preventDefault(); selectedStore = null; resetMenu(); busy = true; refresh(); feedback('正在查门店…');
    try {
      const result = await api('/api/live/stores', { city: $('store-city').value.trim(), keyword: $('store-keyword').value.trim() });
      if (!active()) return;
      $('store-results').innerHTML = result.stores.map(store => `<label class="store-option ${store.businessStatus !== true ? 'unavailable' : ''}"><input type="radio" name="selected-store" value="${esc(store.storeCode)}" data-closed="${store.businessStatus !== true}" ${store.businessStatus !== true ? 'disabled' : ''}><span><b>${esc(store.storeName)}</b><small>${esc(store.address)}</small><small>${store.businessStatus === true ? '● 营业中' : store.businessStatus === false ? '○ 当前暂停营业' : '○ 状态待确认'}${store.hours ? ` · ${esc(store.hours)}` : ''}</small></span></label>`).join('');
      selectedStore = result.stores.find(s => s.businessStatus === true && s.storeCode === invite?.storeCode) ?? result.stores.find(s => s.businessStatus === true) ?? null;
      if (selectedStore) $('store-results').querySelector(`input[value="${selectedStore.storeCode}"]`).checked = true;
      $('store-results').onchange = event => { selectedStore = result.stores.find(s => s.storeCode === event.target.value && s.businessStatus === true) ?? null; resetMenu(); refresh(); };
      feedback(selectedStore ? `营业门店 · ${result.checkedAt ?? '刚刚'}` : '没有查到营业门店，换个地点试试。');
    } catch (error) { feedback(error.message); }
    finally { busy = false; refresh(); }
  };
  $('dialog-content').onclick = async event => {
    if (event.target.closest('#live-check')) {
      $('live-check').disabled = true; feedback('正在检查…');
      try {
        const status = await api('/api/status');
        if (!status.liveEnabled) throw new Error('真实核价请用本机版。');
        if (!status.tokenConfigured) throw new Error('本机尚未配置麦当劳 Token，请填写 .env 后重启。');
        if (!active()) return;
        $('live-controls').hidden = false; feedback('已连接，可以搜索门店。');
        if (status.deepseek?.configured) { $('live-llm-option').disabled = false; $('live-llm-option').textContent = `本机 DeepSeek · ${status.deepseek.model}`; }
      } catch (error) { feedback(error.message); if (active()) $('live-check').disabled = false; }
      return;
    }
    if (busy || !selectedStore) return;
    if (event.target.closest('#live-menu-open')) {
      busy = true; refresh(); const version = selectionVersion; feedback('正在查菜单…');
      try {
        const result = await api('/api/live/menu', { storeCode: selectedStore.storeCode });
        if (!active() || version !== selectionVersion) return;
        menu = result; $('live-menu-category').innerHTML = '<option value="">全部分类</option>' + menu.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        $('live-menu-controls').hidden = false; drawMenu(); feedback(`当前 ${menu.meals.length} 个菜单条目，含不同规格。选一项开局。`);
      } catch (error) { feedback(error.message); }
      finally { busy = false; refresh(); }
      return;
    }
    const button = event.target.closest('[data-live-case]');
    if (!button) return;
    busy = true; refresh(); const opponent = $('live-opponent').value;
    $('live-prepare-feedback').textContent = '正在核价，准备对局…';
    try {
      const value = await api('/api/live/prepare', { caseId: button.dataset.liveCase, mealCode: button.dataset.mealCode, storeCode: selectedStore.storeCode, opponent: opponent === 'visitor' ? 'llm' : opponent, ...(opponent === 'visitor' ? { profile: visitorProfile } : {}) });
      if (!active()) return;
      state.invitation = null; applyRemote(value); toast('准备好了，开始选餐。');
    } catch (error) { if (active()) $('live-prepare-feedback').textContent = error.message; }
    finally { busy = false; refresh(); }
  };
}

$('hero-food').innerHTML = foodArt({ icon: 'burger' }) + foodArt({ icon: 'fries' }) + foodArt({ icon: 'drink' });
$('rules-open').addEventListener('click', rules); $('dialog-close').addEventListener('click', closeDialog);
$('info-dialog').addEventListener('close', () => { if (!$('info-dialog').open) { dialogVersion++; cancelDialogRequest(); $('dialog-content').replaceChildren(); $('dialog-content').onclick = null; $('dialog-content').onsubmit = null; } });
$('info-dialog').addEventListener('click', event => { if (event.target === $('info-dialog')) { const rect = $('info-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
$('round-tabs').addEventListener('click', event => { const button = event.target.closest('[data-round]'); if (button) selectRound(rounds.find(round => round.id === button.dataset.round)); if (event.target.closest('#more-rounds')) moreRoundsDialog(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderOffers(); }));
$('offer-grid').addEventListener('click', event => { const button = event.target.closest('[data-add]'); if (button) addOffer(button.dataset.add); });
$('offer-grid').addEventListener('change', event => { if (event.target.dataset.variant) { state.variants[event.target.dataset.variant] = event.target.value; renderOffers(); } });
$('offer-grid').addEventListener('dragstart', event => { const card = event.target.closest('[data-offer]'); if (!card || state.locked) return event.preventDefault(); event.dataTransfer.setData('application/json', JSON.stringify({ offerId: card.dataset.offer, variantId: state.variants[card.dataset.offer] })); event.dataTransfer.effectAllowed = 'copy'; });
document.querySelector('.player-card').addEventListener('dragover', event => { if (!state.locked) { event.preventDefault(); document.querySelector('.player-card').classList.add('drop-active'); } });
document.querySelector('.player-card').addEventListener('dragleave', event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('drop-active'); });
document.querySelector('.player-card').addEventListener('drop', event => { event.preventDefault(); event.currentTarget.classList.remove('drop-active'); try { const value = JSON.parse(event.dataTransfer.getData('application/json')); addOffer(value.offerId, value.variantId); } catch { toast('拖入的内容不是本局餐品。'); } });
$('cart-lines').addEventListener('click', event => {
  if (state.locked) return;
  const button = event.target.closest('[data-quantity]');
  if (button) { const index = Number(button.dataset.quantity), delta = Number(button.dataset.delta); if (delta > 0 && state.plan.reduce((s,l)=>s+l.quantity,0) >= 8) return toast('一局最多选择 8 份商品'); state.plan[index].quantity += delta; if (state.plan[index].quantity < 1) state.plan.splice(index,1); mutatePlan(); }
  if (event.target.closest('#first-bundle')) { const offer = sortedOffers().find(o => o.type === 'bundle'); if (offer) addOffer(offer.id); }
});
$('cart-clear').addEventListener('click', () => { if (!state.locked) { state.plan = []; state.couponId = null; mutatePlan(); } });
$('coupon-area').addEventListener('change', event => { if (event.target.id === 'coupon-select' && !state.locked) { state.couponId = event.target.value || null; mutatePlan(); } });
$('submit-plan').addEventListener('click', lockPlan); $('bag-inspect').addEventListener('click', bagDialog);
$('menu-expand').addEventListener('click', () => { state.menuExpanded = !state.menuExpanded; if (!state.menuExpanded) { state.category = 'all'; state.filter = 'all'; } renderOffers(); });
$('dock-bag').addEventListener('click', showCart);
$('dock-submit').addEventListener('click', () => { if (!state.plan.length) $('offer-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); else if (currentEvaluation().valid) lockPlan(); else showCart(); });
$('cart-dialog-close').addEventListener('click', closeCart);
$('cart-dialog').addEventListener('close', () => { const card = $('cart-dialog-content').querySelector('.player-card'); if (card) $('cart-home').appendChild(card); });
$('cart-dialog').addEventListener('click', event => { if (event.target === $('cart-dialog')) { const r = $('cart-dialog').getBoundingClientRect(); if (event.clientY < r.top || event.clientX < r.left || event.clientX > r.right || event.clientY > r.bottom) closeCart(); } });
matchMedia('(max-width:760px)').addEventListener('change', event => { if (!event.matches) closeCart(); });
$('share-challenge').addEventListener('click', shareChallenge);
$('opponent-switch').addEventListener('click', opponentDialog);
$('hint-button').addEventListener('click', () => { state.hinted = true; openDialog('提示', `<p class="hint-inline">${esc(state.round.hint)}</p><p class="coupon-note">本局记为使用过提示。</p>`); });
$('opponent-info').addEventListener('click', () => { const opponent = opponentInfo(); openDialog('对手说明', `<div class="dialog-copy"><p><b>${esc(opponent.name)}</b>：${esc(opponent.explanation)}</p><p>对手在你选餐前出招。实付相同算平局，结果不保证最低价。</p>${state.mode === 'live' ? '<p class="note">翻牌时双方会重新核价。</p>' : ''}</div>`); });
$('result-section').addEventListener('click', event => {
  if (event.target.closest('#reveal-button')) reveal();
  if (event.target.closest('#retry-round')) retry();
  if (event.target.closest('#adopt-opponent')) retry(true);
  if (event.target.closest('#save-result')) saveResult();
  if (event.target.closest('#share-result')) shareChallenge();
  if (event.target.closest('#next-round')) { if (state.mode === 'live') liveDialog(); else { const next = (rounds.findIndex(r => r.id === state.round.id) + 1) % rounds.length; selectRound(rounds[next]); $('arena').scrollIntoView({ behavior: 'smooth' }); } }
});
$('menu-category').addEventListener('change', event => { state.category = event.target.value; state.menuExpanded = true; renderOffers(); });
$('custom-open').addEventListener('click', customDialog); $('data-info').addEventListener('click', () => liveDialog());
selectRound(rounds[0]);
new IntersectionObserver(entries => { state.nearArena = entries[0].isIntersecting; renderDock(); }, { threshold: 0 }).observe($('arena'));
function loadSharedChallenge() {
  try {
    const invitation = decodeChallenge(location.hash);
    if (!invitation) return;
    if (invitation.live) { liveDialog(invitation.descriptor); return; }
    selectRound(invitation.round); state.invitation = invitation; renderBrief();
    requestAnimationFrame(() => $('arena').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch (error) { openDialog('链接暂时打不开', `<div class="dialog-copy"><p>${esc(error.message)}</p><p>先玩一道现有题目吧。</p></div>`); }
}
addEventListener('hashchange', loadSharedChallenge);
loadSharedChallenge();
