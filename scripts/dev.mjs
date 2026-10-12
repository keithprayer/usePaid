import { serve } from './http.mjs';
import { staticHandler } from './static.mjs';
const root = new URL('../', import.meta.url);
const source = staticHandler(new URL('src/', root));
const data = staticHandler(root);
serve({ fetch(request) {
  return (new URL(request.url).pathname === '/' ? source : data).fetch(request);
} });
