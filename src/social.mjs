import { createHash } from 'node:crypto';
const article='https://solanacompass.com/news/usepaid-pauses-x-money-payouts-moves-pumpfun-creator-fee-claims-onchain-to';
const protos='https://protos.com/usepaid-suspends-x-money-payments-after-volume-spike/';
export const curated=[
 {id:'official-pause',kind:'official',author:'@UsePaid',publishedAt:'2026-09-27T19:05:00Z',url:'https://x.com/UsePaid/status/2104286234663395773',sourceUrl:article,title:'官方宣布暂停 X Money 支付',summary:'官方称支付遇到问题，费用继续累积。余额安全属于项目声明，不能视为独立审计结论。',assessment:'官方声明',verification:'原帖由 Solana Compass / Protos 引用；X 原文抓取受限。'},
 {id:'official-claims',kind:'official',author:'@UsePaid',publishedAt:'2026-09-28T22:48:00Z',url:'https://x.com/UsePaid/status/2104704774461645021',sourceUrl:article,title:'官方上线链上领取入口',summary:'官方介绍以原始报价资产领取手续费，通常为 SOL。历史 X Money 余额与新产生费用分开处理。',assessment:'产品进展',verification:'原帖由 Solana Compass 引用；属于历史公告。'},
 {id:'reaction-beff',kind:'community',author:'@beffjezos',publishedAt:'2026-09-25T00:00:00Z',datePrecision:'day',url:'https://x.com/beffjezos/status/2103621657273549015',sourceUrl:protos,title:'收款用户对大量支付作出反应',summary:'Protos 引述该用户收到大量款项后的惊讶反应；此个案反映使用体验，不代表项目背书或全网情绪。',assessment:'用户反应',verification:'媒体引用；未独立核验收款金额。'},
 {id:'review-protos',kind:'media',author:'Protos',publishedAt:'2026-09-28T00:00:00Z',datePrecision:'day',url:protos,sourceUrl:protos,title:'外部质疑：暂停支付的原因披露不足',summary:'Protos 指出项目没有充分解释支付问题，并回顾此前 ACH 入账延迟与付款限额。',assessment:'风险关注',verification:'外部媒体评价；发布时间早于新费率调整。'},
 {id:'review-compass',kind:'media',author:'Solana Compass',publishedAt:'2026-09-29T07:27:00Z',url:article,sourceUrl:article,title:'外部分析：链上领取解决结算问题，但提高使用门槛',summary:'该文认为链上领取减少对银行结算的依赖，同时要求收款人准备 Solana 钱包；也记录了 65/10/25 的新分配。',assessment:'利弊分析',verification:'媒体分析，非收入或资金安全证明。'}
];
const feeds=[['news','Google News · UsePaid','https://news.google.com/rss/search?q=UsePaid&hl=en-US&gl=US&ceid=US:en'],['protos','Protos · UsePaid','https://protos.com/tag/usepaid/feed/']];
export const decodeXml=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v<=0x10ffff?String.fromCodePoint(v):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const field=(s,tag)=>decodeXml(s.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1]||'').trim();
export function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function parseRss(xml, author, sourceUrl, now=new Date().toISOString()) {
  if(!/<rss\b/i.test(xml)||!/<channel\b/i.test(xml))throw Error('RSS schema unavailable');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(m=>{
    const title=field(m[1],'title').replace(/<[^>]+>/g,' ').slice(0,240),url=safeUrl(field(m[1],'link')),published=Date.parse(field(m[1],'pubDate'));
    if(!/usepaid|use paid/i.test(title)||!url||!Number.isFinite(published)||published>Date.parse(now)+300000)return [];
    return [{id:createHash('sha256').update(url).digest('hex').slice(0,20),kind:'news',author:field(m[1],'source')||author,title,url,sourceUrl,publishedAt:new Date(published).toISOString(),assessment:'待人工评价',verification:'RSS 标题索引；尚未核验全文。标题措辞不用于自动判断多空情绪。'}];
  });
}
export function normalizeX(payload,now=new Date().toISOString()) {
  if(!Array.isArray(payload?.data)&&payload?.meta?.result_count!==0)throw Error('X response schema unavailable');
  const users=new Map((payload.includes?.users||[]).map(u=>[u.id,u.username]));
  return (payload.data||[]).flatMap(p=>{const user=users.get(p.author_id);if(!user||!/^\w{1,15}$/.test(user)||!/^\d+$/.test(p.id)||!Number.isFinite(Date.parse(p.created_at))||Date.parse(p.created_at)>Date.parse(now))return [];
    return [{id:'x-'+p.id,kind:user.toLowerCase()==='usepaid'?'official':'community',author:'@'+user,url:`https://x.com/${user}/status/${p.id}`,sourceUrl:'https://api.x.com/2/tweets/search/recent',publishedAt:p.created_at,title:'X 公开帖子',summary:p.text?.slice(0,1200)||'',assessment:'未作情绪判定',verification:'X API 原文；官方或用户自述，事实需另行核验。',metrics:p.public_metrics||{}}];});
}
export async function collectSocial(read,previous={}) {
  const now=new Date().toISOString();
  const results=await Promise.all(feeds.map(async([id,name,url])=>{const r=await read(url,false);if(!r.ok)return {id,name,...r};try{return {id,name,...r,data:parseRss(r.data,name,url,now)}}catch(e){return {id,name,ok:false,url,checkedAt:now,error:e.message};}}));
  let x={id:'x',name:'X recent search',ok:false,checkedAt:now,error:'未配置 X_BEARER_TOKEN；当前提供历史原帖、外部报道及官方账号入口。'};
  if(process.env.X_BEARER_TOKEN){
    const url=new URL('https://api.x.com/2/tweets/search/recent');url.search=new URLSearchParams({query:'(UsePaid OR "usepaid.app" OR from:UsePaid) -is:retweet',max_results:'100','tweet.fields':'created_at,public_metrics,author_id',expansions:'author_id','user.fields':'username'});
    try{const r=await fetch(url,{headers:{Authorization:'Bearer '+process.env.X_BEARER_TOKEN},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('X API HTTP '+r.status);x={id:'x',name:'X recent search',ok:true,checkedAt:now,url:'https://api.x.com/2/tweets/search/recent',data:normalizeX(await r.json(),now)};}catch(e){x={...x,error:e.name==='TimeoutError'?'X API timeout':'X API unavailable'+(e.message.match(/HTTP \d+/)?.[0]?' · '+e.message.match(/HTTP \d+/)[0]:'')};}
  }
  results.push(x);
  const incoming=[...results.flatMap(r=>r.ok?r.data:[]),...curated];
  const posts=[...new Map([...(previous.posts||[]),...incoming].map(p=>[p.url,p])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,200);
  return {checkedAt:now,sources:results.map(({data,...r})=>r),posts,ok:results.some(r=>r.ok),xConnected:x.ok,
    scope:'自动跟踪公开新闻 RSS；X 搜索需有 recent search 权限的 X_BEARER_TOKEN，单次最多 100 条、非全量。历史精选附原帖和转引出处；不计算全网情绪指数。'};
}
