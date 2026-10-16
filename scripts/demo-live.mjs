import { mkdir, writeFile } from 'node:fs/promises';
import { LiveArena } from '../lib/live-arena.mjs';
import { redact } from '../lib/mcp-client.mjs';

// A repeatable example of an exact-bag challenge, without creating an order.
try {
  const arena = new LiveArena(process.env.MCD_MCP_TOKEN);
  const prepared = await arena.prepare('chicken');
  const pair = prepared.catalog.offers.find(o => o.id === 'bundle-9900013304');
  const fries = prepared.catalog.offers.find(o => o.id === 'single-4810');
  if (!pair || !fries) throw new Error('当前菜单没有本示例的随心配与中薯；请使用网页中的其他合法方案。');
  const plan = [pair, fries].map(offer => ({ offerId: offer.id, variantId: offer.variants[0].id, quantity: 1 }));
  const result = await arena.reveal(prepared.roundId, plan);
  const proof = {
    checkedAt: new Date().toISOString(), context: { storeCode: '1450713', channel: '到店自取', coupon: 'none', defaultCustomizations: true },
    target: prepared.round.target.map(item => ({ code: item.foodId, quantity: item.quantity })),
    playerPlan: plan, opponentPlan: result.opponent.plan,
    valid: result.player.valid && result.opponent.valid,
    canonicalEqual: result.player.comparison.equal && result.opponent.comparison.equal,
    receiptVerified: true,
    playerCents: result.player.quote.totalCents, opponentCents: result.opponent.quote.totalCents,
    savingCents: result.opponent.quote.totalCents - result.player.quote.totalCents,
    traces: [result.player.quote.traceId, result.opponent.quote.traceId],
    quotedAt: [result.player.quote.quotedAt, result.opponent.quote.quotedAt],
    commitmentUnchanged: prepared.opponentCommitment === result.opponentCommitment,
    source: 'official', withOrder: false
  };
  const directory = new URL('../work/live/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('demo-live-result.json', directory), redact(JSON.stringify(proof, null, 2)));
  console.log(JSON.stringify(proof, null, 2));
} catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
