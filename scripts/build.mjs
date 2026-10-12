import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const [html, server] = await Promise.all([
  readFile(new URL('src/index.html', root), 'utf8'),
  readFile(new URL('src/server.mjs', root), 'utf8'),
]);
const output = new URL('dist/server/', root);
await mkdir(output, { recursive: true });
await writeFile(new URL('index.js', output), `const HTML = ${JSON.stringify(html)};\n${server}`);
console.log(`Built ${fileURLToPath(new URL('index.js', output))}`);
