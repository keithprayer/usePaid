import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, MINT, defaults } from '../scripts/snapshot.mjs';

function fresh(time = '2026-10-12T10:00:00Z') {
  return { mint: MINT, generatedAt: time,
    market: { ok: true, main: { priceUsd: '0.01', pairAddress: 'pool', liquidity: { usd: 50000 }, priceChange: { h24: -25 } }, pairs: [] },
    sources: [{ id: 'docs', ok: true, url: 'https://usepaid.app/docs', hash: 'v1' }],
  };
}
const chart = { ok: true, data: [] };

test('retains history and detects policy changes while deduplicating ongoing thresholds', () => {
  const first = buildSnapshot(fresh(), chart);
  assert.equal(first.activeAlerts.length, 2);
  assert.equal(first.events.filter(e => e.type === 'threshold').length, 2);
  const next = fresh('2026-10-12T10:15:00Z'); next.sources[0].hash = 'v2';
  const second = buildSnapshot(next, chart, first);
  assert.equal(second.history.length, 2);
  assert.equal(second.events.filter(e => e.type === 'document').length, 1);
  assert.equal(second.events.filter(e => e.type === 'threshold').length, 2);
});

test('failed sources never produce a market sample, erase the last document baseline, or resolve thresholds', () => {
  const first = buildSnapshot(fresh(), chart);
  const failed = fresh('2026-10-12T10:15:00Z');
  failed.market = { ok: false, main: null, pairs: [], error: 'HTTP 503' };
  failed.sources = [{ id: 'docs', ok: false, error: 'HTTP 429' }];
  const outage = buildSnapshot(failed, { ok: false }, first);
  assert.equal(outage.history.length, 1);
  assert.equal(outage.baselines.docs, 'v1');
  assert.equal(outage.monitor.thresholdEvaluation, 'unavailable');
  assert.equal(outage.activeAlerts.length, 2);
  const recovery = buildSnapshot(fresh('2026-10-12T10:30:00Z'), chart, outage);
  assert.equal(recovery.events.filter(e => e.type === 'threshold').length, 2);
  assert.equal(recovery.events.filter(e => e.title === '数据源恢复').length, 3);
});

test('bounds state and refuses another token', () => {
  const config = { ...defaults, historyLimit: 1, eventLimit: 1 };
  const first = buildSnapshot(fresh(), chart, {}, config);
  const second = buildSnapshot(fresh('2026-10-12T10:15:00Z'), chart, first, config);
  assert.equal(second.history.length, 1);
  assert.equal(second.events.length, 1);
  assert.throws(() => buildSnapshot({ ...fresh(), mint: 'wrong' }, chart), /mint mismatch/);
  assert.throws(() => buildSnapshot(fresh(), chart, { mint: 'wrong' }), /mint mismatch/);
});
