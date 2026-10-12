// Read-only checks of public endpoints used by the official client.
for (const url of ['https://usepaid.app/api/analytics/volume','https://usepaid.app/_next/static/chunks/3vx2dz6_dsd9i.js','https://protos.com/tag/usepaid/feed/','https://news.google.com/rss/search?q=UsePaid&hl=en-US&gl=US&ceid=US:en']) {
 try {const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const body=await r.text();
 console.log(JSON.stringify({url,status:r.status,body:url.endsWith('.js')?body.slice(-36000):body.slice(0,160000)}));}
 catch(e){console.log(JSON.stringify({url,error:e.message}));}
}
