// Read-only diagnostics of the same public website used by the monitor.
// No credentials, wallets, private endpoints or form submissions are used.
const pageUrls = ['https://usepaid.app/analytics', 'https://usepaid.app/explore', 'https://usepaid.app/launch'];
const scripts = new Set();
const text = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const url of pageUrls) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const html = await r.text();
    for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)/g)) {
      const asset = new URL(match[1], url);
      if (asset.origin === 'https://usepaid.app') scripts.add(asset.href);
    }
    const jsonBlocks = [...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]);
    const inline = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
    const terms = ['buyback', 'burnedAt', 'burned_at', 'boughtAt', 'initialData', 'initialTokens', 'totalCount', 'totalTokens', 'volume', 'pagination'];
    const contexts = [];
    for (const word of terms) {
      const i = inline.toLowerCase().indexOf(word.toLowerCase());
      if (i >= 0) contexts.push(inline.slice(Math.max(0, i - 160), i + 900));
    }
    console.log(JSON.stringify({ page: url, status: r.status, bytes: html.length, jsonBlocks: jsonBlocks.map(b => b.slice(0, 8000)), inlineContexts: contexts, visibleStart: text(html).slice(0, 1800) }));
  } catch (e) { console.log(JSON.stringify({ page: url, error: e.message })); }
}
console.log(JSON.stringify({ publicScripts: [...scripts] }));
const selected = [...scripts].filter(s => /analytics|explore|launch|app\/page|layout/.test(s)).slice(0, 12);
for (const url of selected) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await r.text();
    const endpoints = [...new Set([...body.matchAll(/["'`]((?:https:\/\/[^"'`\s]+)?\/api\/[^"'`\s]*)["'`]/g)].map(x => x[1]))];
    const contexts = [...body.matchAll(/(?:fetch\(|\/api\/|buyback|volume24|totalCount)/g)].slice(0, 35).map(m => body.slice(Math.max(0, m.index - 100), m.index + 450));
    console.log(JSON.stringify({ script: url, status: r.status, bytes: body.length, endpoints, contexts }));
  } catch (e) { console.log(JSON.stringify({ script: url, error: e.message })); }
}
