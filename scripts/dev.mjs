import { readFile } from 'node:fs/promises';
import backend from '../src/server.mjs';
import { serve } from './http.mjs';

// The HTML is read on each request; backend edits restart through node --watch.
serve({ async fetch(request, env, ctx) {
  if (request.method === 'GET' && new URL(request.url).pathname === '/') {
    return new Response(await readFile(new URL('../src/index.html', import.meta.url)), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return backend.fetch(request, env, ctx);
} });
