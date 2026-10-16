import { mkdir, writeFile } from 'node:fs/promises';
import { TrainingArena } from '../lib/training-arena.mjs';
import { LiveArena } from '../lib/live-arena.mjs';
import { modelConfiguration } from '../lib/model-opponent.mjs';
import { rounds } from '../web/data.mjs';
import { descriptorFor } from '../web/challenge.mjs';
import { redact } from '../lib/mcp-client.mjs';

const report = { checkedAt: new Date().toISOString(), trainingModel: null, official: null };
const plan = [{ offerId: 'chicken-fries', variantId: 'default', quantity: 1 }, { offerId: 'single-cola-m', variantId: 'default', quantity: 1 }];
if (modelConfiguration().configured && !process.argv.includes('--skip-training')) {
  try {
    const arena = new TrainingArena();
    const prepared = await arena.prepare(descriptorFor(rounds[0]));
    const result = arena.reveal(prepared.roundId, plan, null);
    report.trainingModel = { status: 'passed', source: 'real DeepSeek API + fictional training prices', model: result.opponentMeta.model, quoteCount: result.opponentMeta.quoteCount, playerCents: result.player.quote.totalCents, opponentCents: result.opponent.quote.totalCents, valid: result.player.valid && result.opponent.valid, commitment: prepared.opponentCommitment === result.opponentCommitment, opponentPlan: result.opponent.plan };
  } catch (error) { report.trainingModel = { status: 'failed', error: redact(error.message) }; }
} else report.trainingModel = { status: process.argv.includes('--skip-training') ? 'covered-by-browser-run' : 'not-configured' };
if (process.env.MCD_MCP_TOKEN) {
  const arena = new LiveArena(process.env.MCD_MCP_TOKEN);
  const searches = [];
  let completed = false;
  let modelPreparations = 0;
  for (const keyword of ['人民广场', '上海火车站', '陆家嘴']) {
    try {
      const result = await arena.searchStores({ city: '上海', keyword });
      searches.push({ keyword, stores: result.stores, checkedAt: result.checkedAt });
      const open = result.stores.filter(s => s.businessStatus === true).slice(0, 2);
      for (const store of open) {
        try {
          const opponentKind = modelConfiguration().configured && modelPreparations === 0 ? 'llm' : 'strategy';
          if (opponentKind === 'llm') modelPreparations++;
          const prepared = await arena.prepare('chicken', { storeCode: store.storeCode, opponent: opponentKind });
          const set = prepared.catalog.offers.find(o => o.id === 'bundle-9900005453');
          const pair = prepared.catalog.offers.find(o => o.id === 'bundle-9900013304');
          const fries = prepared.catalog.offers.find(o => o.id === 'single-4810');
          const playerPlan = pair && fries ? [pair, fries].map(o => ({ offerId: o.id, variantId: o.variants[0].id, quantity: 1 })) : [{ offerId: set.id, variantId: set.variants[0].id, quantity: 1 }];
          const revealed = await arena.reveal(prepared.roundId, playerPlan);
          report.official = { status: 'passed', storeCode: store.storeCode, storeName: store.storeName, source: 'official', opponent: prepared.opponentMeta, valid: revealed.player.valid && revealed.opponent.valid, playerCents: revealed.player.quote.totalCents, opponentCents: revealed.opponent.quote.totalCents, canonicalEqual: revealed.player.comparison.equal && revealed.opponent.comparison.equal, receiptVerified: true, traces: [revealed.player.quote.traceId, revealed.opponent.quote.traceId], quotedAt: [revealed.player.quote.quotedAt, revealed.opponent.quote.quotedAt] };
          completed = true; break;
        } catch (error) { searches.at(-1).prepareError = redact(error.message); }
      }
      if (completed) break;
    } catch (error) { searches.push({ keyword, error: redact(error.message) }); }
  }
  if (!report.official) report.official = { status: 'unavailable', reason: '未找到当前可完成该同餐题的营业门店；不记作成功核价', searches };
} else report.official = { status: 'not-configured' };
const directory = new URL('../work/validation/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('live-v02.json', directory), redact(JSON.stringify(report, null, 2)));
console.log(JSON.stringify(report, null, 2));
if (report.trainingModel.status === 'failed') process.exitCode = 1;
