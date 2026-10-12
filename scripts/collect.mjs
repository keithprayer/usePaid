import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dashboard, candles } from '../src/server.mjs';
import { buildSnapshot } from './snapshot.mjs';

const root = new URL('../', import.meta.url);
const target = new URL('data/snapshot.json', root);
let previous = {};
try { previous = JSON.parse(await readFile(target, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const config = JSON.parse(await readFile(new URL('monitor.config.json', root), 'utf8'));
const fresh = await dashboard();
const chart = fresh.market.main?.pairAddress
  ? await candles(fresh.market.main.pairAddress)
  : { ok: false, checkedAt: new Date().toISOString(), data: [], error: '没有可用主池，未请求历史行情' };
const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
const snapshot = buildSnapshot(fresh, chart, previous, config, runUrl);
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(target, JSON.stringify(snapshot, null, 2) + '\n');
const sources = [fresh.market, ...fresh.sources, chart];
const successful = sources.filter(source => source.ok).length;
console.log(`Snapshot: ${fresh.generatedAt}; sources ${successful}/${sources.length}; history ${snapshot.history.length}; events ${snapshot.events.length}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const report = [
    '## PAID 监控采集', '',
    `- 采集时间：${fresh.generatedAt}`, `- 成功数据源：${successful}/${sources.length}`,
    `- 行情状态：${fresh.market.ok ? '取得匹配 Mint 的主池行情' : '失败 / 未取得匹配数据'}`,
    `- 历史采样：${snapshot.history.length} 条`, `- 事件记录：${snapshot.events.length} 条`,
    `- 后台阈值：${snapshot.monitor.thresholdEvaluation === 'evaluated' ? snapshot.activeAlerts.length + ' 项触发' : '数据不可用，未判断'}`, '',
    '采集结果保存在 `monitor-data` 分支，并随本次运行的 `paid-dashboard` artifact 提供。',
    'GitHub Pages 部署结果见 deploy job；采集成功不代表网站已上线。', '',
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
}
