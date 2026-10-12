import { createHash } from 'node:crypto';

export const MINT = '98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
export const defaults = { intervalMinutes: 15, staleAfterMinutes: 45, liquidityBelowUsd: 100000, drop24hPercent: 20, historyLimit: 2880, eventLimit: 300 };

export function buildSnapshot(fresh, chart, previous = {}, config = defaults, runUrl = null) {
  if (fresh.mint !== MINT) throw new Error('Snapshot mint mismatch');
  if (previous.mint && previous.mint !== MINT) throw new Error('Previous snapshot mint mismatch');
  const settings = { ...defaults, ...config };
  const at = fresh.generatedAt;
  const history = [...(previous.history || [])];
  const events = [...(previous.events || [])];
  const baselines = { ...(previous.baselines || {}) };
  const sourceStates = { ...(previous.sourceStates || {}) };
  const addEvent = (type, title, detail) => events.unshift({
    id: createHash('sha256').update([at, type, title, detail].join('|')).digest('hex').slice(0, 20),
    at, type, title, detail, runUrl,
  });
  for (const source of [{ id: 'market', ...fresh.market }, ...fresh.sources, { id: 'chart', ...chart }, ...(fresh.protocol ? [{id:'protocol',...fresh.protocol.analytics},{id:'protocolVolume',...fresh.protocol.volume}] : []), ...(fresh.social?.sources||[]).filter(s=>s.id!=='x'||fresh.social.xConnected).map(s=>({...s,id:'social-'+s.id}))]) {
    const before = sourceStates[source.id];
    if (!source.ok && before !== false) addEvent('source', '数据源读取失败', `${source.id}: ${source.error || '没有可用数据'}`);
    if (source.ok && before === false) addEvent('source', '数据源恢复', source.id);
    sourceStates[source.id] = !!source.ok;
    // Analytics changes with every trade; monitor policy/person pages instead.
    if (source.ok && source.hash && source.id !== 'analytics') {
      if (baselines[source.id] && baselines[source.id] !== source.hash) addEvent('document', '公开页面内容变化', `${source.id}: ${source.url}；需要人工复核。`);
      baselines[source.id] = source.hash;
    }
  }
  const security = fresh.sources.find(s => s.id === 'security');
  if (security?.ok && security.data?.authorityFieldsPresent) {
    const value = JSON.stringify([security.data.mintAuthority, security.data.freezeAuthority]);
    if (baselines.authority && baselines.authority !== value) addEvent('security', '代币权限报告变化', '第三方增发/冻结权限报告发生变化，需链上复核。');
    baselines.authority = value;
  }
  const activeAlerts = [];
  const p = fresh.market.ok ? fresh.market.main : null;
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  if (p && finite(p.priceUsd)) {
    if (!history.some(point => point.time === at)) history.push({ time: at, price: Number(p.priceUsd), liquidity: p.liquidity?.usd ?? null, volume24h: p.volume?.h24 ?? null, pool: p.pairAddress });
    if (finite(p.liquidity?.usd) && p.liquidity.usd < settings.liquidityBelowUsd) activeAlerts.push({ key: 'liquidity', title: '主池流动性低于后台阈值', detail: `$${p.liquidity.usd} < $${settings.liquidityBelowUsd}`, at });
    if (finite(p.priceChange?.h24) && p.priceChange.h24 <= -settings.drop24hPercent) activeAlerts.push({ key: 'drop', title: '24h 跌幅达到后台阈值', detail: `${p.priceChange.h24}% ≤ -${settings.drop24hPercent}%`, at });
  }
  const priorKeys = new Set((previous.activeAlerts || []).map(alert => alert.key));
  for (const alert of activeAlerts) if (!priorKeys.has(alert.key)) addEvent('threshold', alert.title, alert.detail);
  // An outage is not a recovery; retain the threshold baseline until measured again.
  const thresholdBaseline = p ? activeAlerts : (previous.activeAlerts || []);
  return {
    version: 3, ...fresh, candles: chart,
    history: history.slice(-settings.historyLimit), events: events.slice(0, settings.eventLimit),
    baselines, sourceStates, activeAlerts: thresholdBaseline,
    monitor: { ...settings, runUrl, mode: 'github-actions', thresholdEvaluation: p ? 'evaluated' : 'unavailable' },
  };
}

export function emptySnapshot() {
  return { version: 3, mint: MINT, generatedAt: null, market: { ok: false, main: null, pairs: [], error: '尚未完成首次采集' }, sources: [], candles: { ok: false, data: [], error: '尚未采集' }, history: [], events: [], activeAlerts: [], monitor: { ...defaults, mode: 'github-actions', thresholdEvaluation: 'unavailable' } };
}
