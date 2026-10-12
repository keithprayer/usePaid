import { serve } from './http.mjs';
import { staticHandler } from './static.mjs';
serve(staticHandler(new URL('../dist/', import.meta.url)));
