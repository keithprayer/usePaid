import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAnalytics, parseVolume, mergeProtocol, estimateFees, normalizeBuyback } from '../src/protocol.mjs';
import { MINT } from '../scripts/snapshot.mjs';
const flight=await readFile(new URL('./fixtures/analytics-flight.txt',import.meta.url),'utf8');
const html='<script>self.__next_f.push([1,'+JSON.stringify(flight)+'])</script>';
const fixture=JSON.parse(await readFile(new URL('./fixtures/volume.json',import.meta.url),'utf8'));
const at='2026-10-12T17:00:00Z';
test('real public analytics flight yields UTC daily fees, registrations, burns and exact mint',()=>{
 const a=parseAnalytics(html),today=a.daily.find(r=>r.day==='2026-10-12');
 assert.equal(a.totalRegistered,42008);assert.equal(a.issuedViaUsePaid,null);
 assert.equal(today.feesClaimedUsd,10633.391494);assert.equal(today.burnedUsd,10014.659094);assert.equal(today.registered,122);
 assert.equal(a.transactions.length,4);assert.equal(a.transactions[0].tokensBurned,61400);
 assert.equal(a.transactions[0].boughtAt,'2026-10-12T15:34:00.000Z');
 assert.throws(()=>parseAnalytics(html.replaceAll(MINT,'wrong-mint')),/mint/);
 assert.throws(()=>parseAnalytics('<html>Loading</html>'),/schema/);
});
test('volume audit reconciles micros and never sums rolling windows into daily totals',()=>{
 const v=parseVolume(fixture,at);assert.equal(v.cutoff,'2026-09-26T20:00:00.000Z');assert.equal(v.stale,true);
 assert.equal(v.daily.some(d=>d.day==='2026-10-12'),false);assert.equal(v.daily.at(-1).partial,true);
 assert.equal(v.latestRolling.coveredTokens,2520);assert.equal(v.latestRolling.stale,true);
 const bad=structuredClone(fixture);bad.audit.totalUsdMicros='0';assert.throws(()=>parseVolume(bad,at),/reconcile/);
 const duplicate=structuredClone(fixture);duplicate.audit.daily.push(duplicate.audit.daily[0]);assert.throws(()=>parseVolume(duplicate,at),/duplicate/);
 const future=structuredClone(fixture);future.audit.cutoff='2099-01-01T00:00:00Z';assert.throws(()=>parseVolume(future,at),/audit/);
});
test('observed swaps and burns use separate UTC dates, deduplicate signatures and exclude failed status',()=>{
 const tx={id:'a',swap:'swap',burn:'burn',status:'burned',boughtAt:'2026-10-11T23:59:00Z',burnedAt:'2026-10-12T00:01:00Z',usdSpent:100,solSpent:1,tokensBought:1000,tokensBurned:1000};
 const raw={analytics:{ok:true,data:{asOf:at,daily:[],transactions:[tx,{...tx,id:'duplicate'},{...tx,id:'failed',swap:'bad',burn:'badburn',status:'failed'}]}},volume:{ok:false,error:'offline'}};
 const once=mergeProtocol(raw,{},at),twice=mergeProtocol(raw,once,at);
 assert.deepEqual(twice.transactionDays,once.transactionDays);
 assert.equal(once.transactionDays[0].buyUsd,100);assert.equal(once.transactionDays[0].burnCount,0);
 assert.equal(once.transactionDays[1].tokensBurned,1000);assert.equal(once.transactionDays[1].buyCount,0);
 const unavailable=mergeProtocol({analytics:{ok:false,error:'offline'},volume:{ok:false}},once,at);
 assert.equal(unavailable.analytics.ok,false);assert.equal(unavailable.analytics.lastSuccessAt,at);assert.deepEqual(unavailable.transactionDays,once.transactionDays);
});
test('fee scenarios separate creator fees, recipient, treasury and buyback budget; missing is unknown',()=>{
 assert.deepEqual(estimateFees(1000000,25,80),{creatorFeesUsd:2000,recipientUsd:1300,treasuryUsd:200,buybackBudgetUsd:500});
 assert.equal(estimateFees(null,25,100),null);assert.equal(estimateFees(100,25,101),null);
 assert.equal(estimateFees(100,25,100,[80,10,20]),null);
 assert.equal(normalizeBuyback({details:[{label:'Token',value:'other'}]}),null);
});
