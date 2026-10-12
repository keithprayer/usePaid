import worker from '../dist/server/index.js';
import { serve } from './http.mjs';

serve(worker);
