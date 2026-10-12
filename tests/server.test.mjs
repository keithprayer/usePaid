import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboard,candles} from '../src/server.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
test('filters exact mint and chain; selects deepest pool; distinguishes policy conflict and missing authority fields',async()=>{
const original=globalThis.fetch;
globalThis.fetch=async url=>{
if(url.includes('dexscreener'))return Response.json([
{chainId:'solana',baseToken:{address:'wrong-mint'},liquidity:{usd:999999}},
{chainId:'ethereum',baseToken:{address:mint},liquidity:{usd:999999}},
{chainId:'solana',baseToken:{address:mint},pairAddress:'small',liquidity:{usd:100}},
{chainId:'solana',baseToken:{address:mint},pairAddress:'deep',liquidity:{usd:500}}]);
if(url.includes('rugcheck'))return Response.json({topHolders:[],token:{supply:1000000,decimals:6}});
if(url.includes('api.github'))return Response.json({public_repos:0,followers:63,html_url:'https://github.com/UsePaid'});
if(url.includes('disclosures'))return new Response('<p>20% of claimed fees</p>');
if(url.includes('analytics'))return new Response('<script>bad text</script><a href="https://solscan.io/tx/123ABC">Burn</a>');
return new Response('<p>X Money payouts are paused.</p><p>Current collection split: 65% recipient pool / 10% UsePaid treasury / 25% buyback and burn.</p>');
};
try{const d=await dashboard();assert.equal(d.market.pairs.length,2);assert.equal(d.market.main.pairAddress,'deep');const sources=Object.fromEntries(d.sources.map(x=>[x.id,x]));assert.deepEqual(sources.paid.data.split,[65,10,25]);assert.equal(sources.docs.data.paused,true);assert.equal(sources.disclosures.data.legacy20,true);assert.equal(sources.security.data.authorityFieldsPresent,false);assert.deepEqual(sources.analytics.data.burnLinks,['https://solscan.io/tx/123ABC']);assert.equal(sources.github.data.publicRepos,0);}finally{globalThis.fetch=original;}
});
test('upstream errors remain unknown, never become zero or a healthy result',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('Unavailable',{status:503});try{const d=await dashboard();assert.equal(d.market.ok,false);assert.equal(d.market.main,null);assert.equal(d.market.pairs.length,0);assert.ok(d.sources.every(s=>!s.ok&&s.error==='HTTP 503'));}finally{globalThis.fetch=original;}});
test('candle pool validation prevents arbitrary outbound requests',async()=>{assert.equal((await candles('../../evil')).ok,false);});
test('a malformed security report does not hide successful market data',async()=>{
const original=globalThis.fetch;
globalThis.fetch=async url=>{
 if(url.includes('dexscreener'))return Response.json([{chainId:'solana',baseToken:{address:mint},pairAddress:'valid',liquidity:{usd:500}}]);
 if(url.includes('rugcheck'))return Response.json({mint:'different-token',topHolders:[]});
 if(url.includes('api.github'))return Response.json({public_repos:0,followers:0});
 return new Response('<p>Public document</p>');
};
try{const d=await dashboard();assert.equal(d.market.ok,true);assert.equal(d.market.main.pairAddress,'valid');const report=d.sources.find(s=>s.id==='security');assert.equal(report.ok,false);assert.match(report.error,/无效代币报告/);}finally{globalThis.fetch=original;}
});
