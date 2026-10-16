import { createHash, randomBytes } from 'node:crypto';

export function sealPlan(plan, couponId = null) {
  const nonce = randomBytes(24).toString('hex');
  const commitment = createHash('sha256').update(JSON.stringify({ plan, couponId, nonce })).digest('hex');
  return { nonce, commitment };
}
