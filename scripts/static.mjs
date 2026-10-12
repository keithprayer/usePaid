import { readFile } from 'node:fs/promises';
import { emptySnapshot } from './snapshot.mjs';
export function staticHandler(root) {
  return { async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const path = new URL(request.url).pathname;
    const routes = { '/': ['index.html', 'text/html'], '/data/snapshot.json': ['data/snapshot.json', 'application/json'] };
    const route = routes[path];
    if (!route) return new Response('Not found', { status: 404 });
    let body;
    try { body = await readFile(new URL(route[0], root)); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (path !== '/data/snapshot.json') return new Response('Build first: npm run build', { status: 404 });
      body = JSON.stringify(emptySnapshot());
    }
    return new Response(request.method === 'HEAD' ? null : body, { headers: {
      'Content-Type': route[1] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } };
}
