import { MINT } from '../scripts/snapshot.mjs';
export const ANALYTICS_URL = 'https://usepaid.app/analytics';
export const VOLUME_URL = 'https://usepaid.app/api/analytics/volume';
const DAY = 86400000;
export const dayOf = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0,10) : null;
export const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function displayNumber(value) {
  const m = String(value ?? '').replace(/[$,]/g,'').trim().match(/^(\d+(?:\.\d+)?)\s*([KMB])?(?:\s+SOL)?$/i);
  return m ? Number(m[1]) * ({K:1e3,M:1e6,B:1e9}[m[2]?.toUpperCase()] || 1) : null;
}
function micros(value) { if (!/^\d+$/.test(String(value ?? ''))) throw Error('Invalid USD micros'); const n=Number(BigInt(value))/1e6; if(!Number.isFinite(n)) throw Error('Invalid amount'); return n; }
// Decode JSON strings only. Never evaluate scripts from the remote website.
export function flightRoots(html) {
  const stream = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m=>JSON.parse(m[1])).join('');
  return stream.split('\n').flatMap(line=>{try{return [JSON.parse(line.slice(line.indexOf(':')+1))];}catch{return [];}});
}
export function findObject(roots, predicate) {
  let result;
  const visit=o=>{if(result||!o||typeof o!=='object')return;if(predicate(o)){result=o;return;}Object.values(o).forEach(visit);};
  roots.forEach(visit); return result;
}
function dailySeries(series) {
  if(series?.bucketUnit!=='day'||!Array.isArray(series.bars)||!Array.isArray(series.barLabels)||series.bars.length!==series.barLabels.length) throw Error('Daily series schema changed');
  const rows=series.bars.map((value,i)=>{const day=dayOf(series.barLabels[i].split(' · ')[0]);if(!day||numeric(value)===null)throw Error('Invalid daily bucket');return {day,value};});
  if(new Set(rows.map(r=>r.day)).size!==rows.length)throw Error('Duplicate daily bucket'); return rows;
}
const signature=value=>typeof value==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(value)?value:null;
function eventTime(s){if(typeof s!=='string')return null;const t=Date.parse(s+' UTC');return Number.isFinite(t)?new Date(t).toISOString():null;}
export function normalizeBuyback(event) {
  const d=Object.fromEntries((event.details||[]).map(x=>[x.label.replace(/^\$+/,''),x.value]));
  if(d.Token!==MINT) return null;
  const swap=signature(d.Swap), burn=signature(d.Burn);
  if(!swap&&!burn)return null;
  return {id:swap||burn,status:event.kind,swap,burn,
    boughtAt:swap?eventTime(d.Bought):null,burnedAt:event.kind==='burned'&&burn?eventTime(d.Burned):null,
    solSpent:displayNumber(d['SOL spent']),usdSpent:displayNumber(d.Value),
    tokensBought:displayNumber(d['PAID bought']),tokensBurned:displayNumber(d['PAID burned']),
    amountPrecision:'website-rounded',sourceUrl:ANALYTICS_URL};
}
export function parseAnalytics(html) {
  const p=findObject(flightRoots(html),o=>o.buyback&&o.analytics);
  if(p?.buyback?.mint!==MINT||!p.analytics.all)throw Error('Analytics mint or schema mismatch');
  const a=p.analytics.all;
  if(!Number.isFinite(Date.parse(a.generatedAt)))throw Error('Analytics timestamp missing');
  const fees=dailySeries(a.volume),burns=new Map(dailySeries(a.burnt).map(x=>[x.day,x.value])),launches=new Map(dailySeries(a.launches).map(x=>[x.day,x.value]));
  return {asOf:a.generatedAt,sourceUrl:ANALYTICS_URL,
    totalRegistered:displayNumber(a.launches.total),issuedViaUsePaid:null,
    totalFeesUsd:micros(a.accounting.feesMicros),totalBurnedUsd:micros(a.accounting.burnedMicros),pendingBurnUsd:micros(a.accounting.pendingBurnMicros),
    daily:fees.map(x=>({day:x.day,feesClaimedUsd:x.value,burnedUsd:burns.get(x.day)??null,registered:launches.get(x.day)??null,asOf:a.generatedAt})),
    transactions:p.buyback.events.map(normalizeBuyback).filter(Boolean),
    countMethod:'官网 Tokens registered：包含新发行及后来接入的代币，无法单独核实通过 UsePaid 发行的数量。',
    burnMethod:'官网 USD 日统计；交易列表可能只含近期记录。PAID/SOL 数量来自网页舍入值，按回购和销毁各自的 UTC 时间分别汇总，尚未经 RPC 逐笔确认。'};
}
export function parseVolume(payload, now=new Date().toISOString()) {
  const audit=payload?.audit, cutoff=Date.parse(audit?.cutoff), current=Date.parse(now);
  if(!Number.isFinite(cutoff)||cutoff>current||!Array.isArray(audit?.daily))throw Error('Invalid volume audit');
  let sum=0n;const seen=new Set();
  const daily=audit.daily.map(r=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||dayOf(r.date)!==r.date||Date.parse(r.date)>cutoff||seen.has(r.date))throw Error('Invalid or duplicate volume day');seen.add(r.date);const volumeUsd=micros(r.usdMicros);sum+=BigInt(r.usdMicros);return {day:r.date,volumeUsd,partial:r.date===dayOf(audit.cutoff)&&cutoff%DAY!==0};});
  if(sum!==BigInt(audit.totalUsdMicros))throw Error('Volume total does not reconcile');
  const snapshots=(payload.snapshots||[]).filter(s=>Number.isFinite(Date.parse(s.hour))&&Date.parse(s.hour)<=Date.parse(s.startedAt)&&Date.parse(s.startedAt)<=Date.parse(s.completedAt)&&Date.parse(s.completedAt)<=current&&String(s.volume24hUsd).trim()!==''&&numeric(Number(s.volume24hUsd))!==null&&Number.isInteger(s.tokenCount)&&s.tokenCount>0&&Number.isInteger(s.coveredTokens)&&s.coveredTokens>=0&&s.coveredTokens<=s.tokenCount).sort((a,b)=>Date.parse(a.hour)-Date.parse(b.hour));
  const latest=snapshots.at(-1)||null;
  return {sourceUrl:VOLUME_URL,cutoff:audit.cutoff,asOf:audit.cutoff,stale:current-cutoff>2*3600000,daily,
    latestRolling:latest?{...latest,stale:current-Date.parse(latest.completedAt)>2*3600000}:null,
    backfill:payload.backfill?.state||'unknown',totalUsd:micros(audit.totalUsdMicros),
    coverage:'官网协议聚合口径；未提供逐币成交明细或全链覆盖证明。小时快照中的 coveredTokens/tokenCount 仅适用于该快照。',
    method:'使用 audit.daily 的 UTC 自然日成交量；不累加滚动 24h/1h 快照。缺失日期保持未知，不填零。'};
}
export function estimateFees(volumeUsd, creatorFeeBps, routedPercent, split=[65,10,25]) {
  if(numeric(volumeUsd)===null||numeric(creatorFeeBps)===null||creatorFeeBps>1000||numeric(routedPercent)===null||routedPercent>100||!Array.isArray(split)||split.length!==3||split.some(x=>numeric(x)===null)||Math.abs(split.reduce((a,b)=>a+b,0)-100)>0.01)return null;
  const fees=volumeUsd*creatorFeeBps/10000*routedPercent/100;
  return {creatorFeesUsd:fees,recipientUsd:fees*split[0]/100,treasuryUsd:fees*split[1]/100,buybackBudgetUsd:fees*split[2]/100};
}
export function mergeProtocol(current, previous={}, now=new Date().toISOString()) {
  const merge=(old,rows,key,limit)=>[...new Map([...old,...rows].map(r=>[r[key],r])).values()].sort((a,b)=>String(a[key]).localeCompare(String(b[key]))).slice(-limit);
  const analytics=current.analytics.ok?current.analytics:{...current.analytics,data:previous.analytics?.data||null,lastSuccessAt:previous.analytics?.data?.asOf||null};
  const volume=current.volume.ok?current.volume:{...current.volume,data:previous.volume?.data||null,lastSuccessAt:previous.volume?.data?.asOf||null};
  const transactions=merge(previous.transactions||[],current.analytics.ok?analytics.data.transactions:[],'id',20000);
  const daily=merge(previous.daily||[],current.analytics.ok?analytics.data.daily:[],'day',730);
  const transactionDays=new Map();
  const seenSwap=new Set(),seenBurn=new Set();
  for(const tx of transactions){
    for(const kind of ['buy','burn']){
      const sig=kind==='buy'?tx.swap:tx.burn,at=kind==='buy'?tx.boughtAt:tx.burnedAt,seen=kind==='buy'?seenSwap:seenBurn;
      if(!sig||!at||seen.has(sig)||tx.status==='failed')continue;seen.add(sig);
      const day=dayOf(at);let row=transactionDays.get(day);if(!row){row={day,buyCount:0,burnCount:0,buyUsd:0,buySol:0,tokensBought:0,tokensBurned:0};transactionDays.set(day,row);}
      if(kind==='buy'){row.buyCount++;for(const [target,source]of [['buyUsd','usdSpent'],['buySol','solSpent'],['tokensBought','tokensBought']])row[target]=row[target]===null||tx[source]===null?null:row[target]+tx[source];}
      else{row.burnCount++;row.tokensBurned=row.tokensBurned===null||tx.tokensBurned===null?null:row.tokensBurned+tx.tokensBurned;}
    }
  }
  return {analytics,volume,daily,transactions,transactionDays:[...transactionDays.values()].sort((a,b)=>a.day.localeCompare(b.day)),checkedAt:now};
}
export async function collectProtocol(read) {
  const results=await Promise.all([[ANALYTICS_URL,false,parseAnalytics],[VOLUME_URL,true,parseVolume]].map(async([url,json,parse])=>{
    const r=await read(url,json);if(!r.ok)return r;
    try{return {...r,data:parse(r.data)}}catch(e){return {ok:false,url,checkedAt:r.checkedAt,error:e.message};}
  }));return {analytics:results[0],volume:results[1]};
}
