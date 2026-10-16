import { validateModelProfile } from '../web/model-services.mjs';
import { resolveDescriptor, normalizePlan } from '../web/challenge.mjs';
import { evaluatePlan } from '../web/engine.mjs';
import { ChatModelOpponent } from './model-opponent.mjs';

const PURPOSE = new TextEncoder().encode('mcd-bite-battle/visitor-training/v1');
const encode = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
export const newTicketKey = () => encode(crypto.getRandomValues(new Uint8Array(32)));
async function encryptionKey(secret) {
  if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error('对局服务尚未配置完成，请稍后再试');
  return crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function commit(plan, couponId, nonce) {
  const bytes = new TextEncoder().encode(JSON.stringify({ plan, couponId, nonce }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function visitorOpponent(profile, { additionalHosts = [], fetchImpl } = {}) {
  const normalized = validateModelProfile(profile, additionalHosts);
  return new ChatModelOpponent({ ...normalized, fetchImpl });
}
export async function prepareVisitorRound({ challenge, profile, key, subject = '', additionalHosts = [], fetchImpl }) {
  const resolved = resolveDescriptor(challenge);
  if (resolved.live) throw new Error('网页自带 API 对战目前使用训练餐袋，真实门店核价请用本机版');
  const cipher = await encryptionKey(key);
  const roundCatalog = resolved.catalog;
  const opponent = await visitorOpponent(profile, { additionalHosts, fetchImpl }).choose({ round: resolved.round, catalog: roundCatalog, source: 'training', evaluate: async (plan, couponId) => evaluatePlan(plan, couponId, resolved.round, roundCatalog) });
  const nonce = encode(crypto.getRandomValues(new Uint8Array(24)));
  const commitment = await commit(opponent.plan, opponent.couponId, nonce);
  const descriptor = { ...resolved.descriptor }; delete descriptor.benchmark;
  const payload = { v: 1, descriptor, plan: opponent.plan, couponId: opponent.couponId, meta: opponent.meta, nonce, commitment, subject, expiresAt: Date.now() + 15 * 60 * 1000 };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: PURPOSE }, cipher, new TextEncoder().encode(JSON.stringify(payload))));
  const bytes = new Uint8Array(iv.length + encrypted.length); bytes.set(iv); bytes.set(encrypted, iv.length);
  return { ticket: encode(bytes), round: resolved.round, opponentMeta: opponent.meta, opponentCommitment: commitment, source: 'training' };
}
export async function revealVisitorRound({ ticket, plan, couponId, key, subject = '' }) {
  let state;
  try {
    if (typeof ticket !== 'string' || ticket.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(ticket)) throw new Error('Invalid ticket');
    const bytes = decode(ticket);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: PURPOSE }, await encryptionKey(key), bytes.slice(12));
    state = JSON.parse(new TextDecoder().decode(decrypted));
    if (state.v !== 1 || state.subject !== subject || !Number.isSafeInteger(state.expiresAt) || state.expiresAt < Date.now()) throw new Error('Invalid session');
  } catch { throw new Error('本局已过期、访问身份变化或票据无效，请重新邀请 AI'); }
  const { round, catalog } = resolveDescriptor(state.descriptor);
  const player = evaluatePlan(normalizePlan(plan), couponId ?? null, round, catalog);
  const opponent = evaluatePlan(state.plan, state.couponId, round, catalog);
  if (!player.valid || !opponent.valid) throw new Error('双方没有同时通过同餐与预算校验，本局不判胜');
  return { player, opponent: { ...opponent, plan: state.plan, couponId: state.couponId, meta: state.meta }, opponentMeta: state.meta, opponentNonce: state.nonce, opponentCommitment: state.commitment };
}
