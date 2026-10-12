import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../dist/server/index.js';

const response = await worker.fetch(new Request('https://example.test/'), {}, {});
assert.equal(response.status, 200);
assert.match(response.headers.get('content-type'), /text\/html/);
const html = await response.text();
assert.match(html, /项目概览/);
assert.doesNotMatch(html, /仅自己可见|appgprj_/);
const source = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
for (const [, script] of source.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
assert.equal((await worker.fetch(new Request('https://example.test/health'), {}, {})).status, 200);
assert.equal((await worker.fetch(new Request('https://example.test/not-found'), {}, {})).status, 404);
assert.equal((await worker.fetch(new Request('https://example.test/api/dashboard', { method: 'POST' }), {}, {})).status, 405);
console.log('Worker HTML, UI JavaScript syntax, health, missing route and method handling verified.');
