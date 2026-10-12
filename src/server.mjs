const MINT='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const sources=[['paid','https://usepaid.app/paid'],['docs','https://usepaid.app/docs'],['disclosures','https://usepaid.app/legal/disclosures'],['analytics','https://usepaid.app/analytics'],['team','https://tw.rootdata.com/member/rylo?k=MzQ3NjM%3D'],['github','https://api.github.com/users/UsePaid'],['security','https://api.rugcheck.xyz/v1/tokens/'+MINT+'/report']];
const checked=()=>new Date().toISOString();
const plain=s=>s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
async function read(url,json=true){const t=checked();try{const r=await fetch(url,{headers:{'Accept':json?'application/json':'text/html','User-Agent':'PaidObservatory/1.0'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('HTTP '+r.status);return {ok:true,checkedAt:t,url,data:json?await r.json():await r.text()};}catch(e){return {ok:false,checkedAt:t,url,error:e.name==='TimeoutError'?'请求超时':String(e.message).slice(0,160)};}}
async function fingerprint(s){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
function pickPairs(data){return (Array.isArray(data)?data:Array.isArray(data?.pairs)?data.pairs:[]).filter(p=>p?.chainId==='solana'&&p.baseToken?.address===MINT).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));}
export async function dashboard(){
 const marketPromise=read('https://api.dexscreener.com/token-pairs/v1/solana/'+MINT);
 const otherPromise=Promise.all(sources.map(async([id,url])=>{const r=await read(url,id==='security'||id==='github');if(!r.ok)return {id,...r};try{if(id==='github')return {id,...r,data:{publicRepos:r.data.public_repos,followers:r.data.followers,url:r.data.html_url}};if(id==='security'){const d=r.data;if(!d||typeof d!=='object'||(d.mint&&d.mint!==MINT))throw new Error('无效代币报告');return {id,...r,data:{mintAuthority:d.mintAuthority??d.token?.mintAuthority??null,freezeAuthority:d.freezeAuthority??d.token?.freezeAuthority??null,token:d.token?{supply:d.token.supply,decimals:d.token.decimals}:null,topHolders:(d.topHolders||[]).slice(0,20).map(h=>({address:h.address,owner:h.owner,pct:h.pct,amount:h.amount})),risks:(d.risks||[]).map(x=>({name:x.name,level:x.level,description:x.description})),rugged:d.rugged,reportAt:d.detectedAt||null,authorityFieldsPresent:('mintAuthority' in d||'mintAuthority' in (d.token||{}))&&('freezeAuthority' in d||'freezeAuthority' in (d.token||{}))}};}
 const txt=plain(r.data);const hash=await fingerprint(txt);const p={id,ok:true,url,checkedAt:r.checkedAt,hash,data:{}};
 if(id==='paid'||id==='docs'||id==='disclosures'){p.data.paused=/X\s*Money payouts (?:are |remain )?paused|X\s*Money payouts remain suspended/i.test(txt);p.data.split=txt.match(/(?:Current collection split:|split:)\s*(\d+)% recipient pool\s*\/\s*(\d+)% UsePaid treasury\s*\/\s*(\d+)% buyback/i)?.slice(1).map(Number)||null;p.data.legacy20=/20% of claimed fees/i.test(txt);}
 if(id==='analytics'){p.data.burnLinks=[...new Set([...r.data.matchAll(/https:\/\/solscan\.io\/tx\/[1-9A-HJ-NP-Za-km-z]+/g)].map(x=>x[0]))].slice(0,8);p.data.notice='官网记录需逐笔在 Solscan 核实；不将页面占位数字当作测量值。';}
 if(id==='team')p.data.mentionsRylo=/rylo/i.test(txt);return p;}catch(error){return {id,ok:false,url,checkedAt:r.checkedAt,error:'数据结构无法识别：'+String(error.message).slice(0,100)};}}));
 const [market,records]=await Promise.all([marketPromise,otherPromise]);const pairs=market.ok?pickPairs(market.data):[];const main=pairs[0]||null;
 const out={mint:MINT,generatedAt:checked(),market:{...market,data:undefined,pairs,main,ok:market.ok&&pairs.length>0,error:market.error||(pairs.length?null:'数据源未返回与指定 mint 匹配的交易池')},sources:records};
 return out;
}
export async function candles(pool) {
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pool)) return {ok:false,error:'无效交易池地址'};
 const r=await read('https://api.geckoterminal.com/api/v2/networks/solana/pools/'+pool+'/ohlcv/hour?aggregate=1&limit=168&currency=usd&token='+MINT);
 if(!r.ok) return {...r,data:null};
 const rows=r.data?.data?.attributes?.ohlcv_list;
 if(!Array.isArray(rows)) return {...r,ok:false,data:null,error:'历史价格数据结构无法识别'};
 const data=rows.filter(x=>Array.isArray(x)&&x.length>=6&&x.slice(0,6).every(Number.isFinite)).map(x=>({time:x[0],open:x[1],high:x[2],low:x[3],close:x[4],volume:x[5]})).sort((a,b)=>a.time-b.time);
 return {...r,ok:data.length>0,data,error:data.length?null:'没有有效历史价格'};
}
