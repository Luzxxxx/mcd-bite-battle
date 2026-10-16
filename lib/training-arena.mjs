import { randomUUID } from 'node:crypto';
import { resolveDescriptor, normalizePlan } from '../web/challenge.mjs';
import { evaluatePlan } from '../web/engine.mjs';
import { DeepSeekOpponent } from './model-opponent.mjs';
import { sealPlan } from './commitment.mjs';

export class TrainingArena {
  #rounds = new Map(); #model;
  constructor({ model } = {}) { this.#model = model; }
  async prepare(descriptor) {
    const { round, live, catalog } = resolveDescriptor(descriptor);
    if (live) throw new Error('请选择训练题');
    for (const [id, state] of this.#rounds) if (state.expiresAt < Date.now()) this.#rounds.delete(id);
    if (this.#rounds.size >= 20) throw new Error('已开启较多对局，请稍后再试');
    const model = this.#model ?? new DeepSeekOpponent();
    const opponent = await model.choose({ round, catalog, source: 'training', evaluate: async (plan, couponId) => evaluatePlan(plan, couponId, round, catalog) });
    const seal = sealPlan(opponent.plan, opponent.couponId);
    const roundId = randomUUID();
    this.#rounds.set(roundId, { round, catalog, opponent, ...seal, expiresAt: Date.now() + 15 * 60 * 1000 });
    return { roundId, round, opponentMeta: opponent.meta, opponentCommitment: seal.commitment, source: 'training' };
  }
  reveal(id, plan, couponId) {
    const state = this.#rounds.get(id);
    if (!state || state.expiresAt < Date.now()) throw new Error('大模型对局已过期或服务重启，请重新邀请对手');
    const player = evaluatePlan(normalizePlan(plan), couponId ?? null, state.round, state.catalog);
    const opponent = evaluatePlan(state.opponent.plan, state.opponent.couponId, state.round, state.catalog);
    if (!player.valid || !opponent.valid) throw new Error('双方没有同时通过同餐与预算校验，本局不判胜');
    return { player, opponent: { ...opponent, plan: state.opponent.plan, couponId: state.opponent.couponId, meta: state.opponent.meta }, opponentMeta: state.opponent.meta, opponentCommitment: state.commitment, opponentNonce: state.nonce };
  }
}
