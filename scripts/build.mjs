import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { emptySnapshot, MINT } from './snapshot.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('src/index.html', root), 'utf8');
let snapshot;
try { snapshot = JSON.parse(await readFile(new URL('data/snapshot.json', root), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; snapshot = emptySnapshot(); }
if (snapshot.mint !== MINT) throw new Error('Refusing to build with a different mint');
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('data/', output), { recursive: true });
await Promise.all([
  writeFile(new URL('index.html', output), html),
  writeFile(new URL('data/snapshot.json', output), JSON.stringify(snapshot)),
  writeFile(new URL('.nojekyll', output), ''),
]);
console.log('Built static Pages site; snapshot ' + (snapshot.generatedAt || 'not collected yet'));
