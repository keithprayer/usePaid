import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, safeUrl, normalizeX, collectSocial } from '../src/social.mjs';
const xml='<rss><channel><item><title><![CDATA[UsePaid &amp; payment update]]></title><link>https://example.com/update</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate><source>Example</source></item><item><title>Paid salaries</title><link>https://example.com/unrelated</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate></item><item><title>UsePaid scam?</title><link>javascript:alert(1)</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>';
test('RSS decodes entities, filters unrelated results and unsafe links without assigning sentiment',()=>{
 const p=parseRss(xml,'feed','https://example.com/feed','2026-10-12T12:00:00Z');assert.equal(p.length,1);assert.equal(p[0].title,'UsePaid & payment update');assert.equal(p[0].assessment,'待人工评价');
 assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('https://user:secret@example.com'),null);assert.throws(()=>parseRss('<html>Blocked</html>','x','x'),/RSS/);
});
test('X adapter attributes exact authors and handles zero posts without inventing metrics',()=>{
 const posts=normalizeX({data:[{id:'123',author_id:'1',created_at:'2026-10-12T10:00:00Z',text:'Update'}],includes:{users:[{id:'1',username:'UsePaid'}]}},'2026-10-12T12:00:00Z');assert.equal(posts[0].kind,'official');assert.equal(posts[0].url,'https://x.com/UsePaid/status/123');assert.deepEqual(normalizeX({meta:{result_count:0}}),[]);assert.throws(()=>normalizeX({error:'denied'}),/schema/);
});
test('source outage keeps archived opinions and makes failed collection explicit',async()=>{
 const before=process.env.X_BEARER_TOKEN;delete process.env.X_BEARER_TOKEN;
 try{const s=await collectSocial(async url=>({ok:false,url,error:'HTTP 503'}),{posts:[{id:'old',url:'https://example.com/old',title:'Archived',publishedAt:'2026-10-01T00:00:00Z'}]});assert.equal(s.ok,false);assert.equal(s.xConnected,false);assert.ok(s.posts.some(p=>p.id==='old'));assert.ok(s.posts.some(p=>p.kind==='media'));}finally{if(before!==undefined)process.env.X_BEARER_TOKEN=before;}
});
