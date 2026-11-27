// R8: synthetic-only technical candidate. Does not read databases or write files.
// Never publish this output until the real URL/publication lifecycle is approved.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=value=>typeof value==="string"&&value.trim()?Date.parse(value):NaN;
export function buildSyntheticResearchCandidates(rows,{now,base="https://pchjesus.github.io/sfc-website/"}={}){
  const cutoff=date(now);
  if(!Number.isFinite(cutoff)||!Array.isArray(rows))throw new TypeError("Explicit fixture array and valid cutoff required");
  const root=new URL(base);
  if(root.protocol!=="https:"||root.username||root.password||root.search||root.hash||!root.pathname.endsWith("/"))throw new TypeError("Invalid base");
  if(rows.some(r=>!r||r.synthetic!==true))throw new Error("Synthetic fixtures only");
  const seen=new Set();
  const pages=[];
  for(const r of rows){
    if(typeof r.id!=="string"||!UUID.test(r.id))throw new Error("Invalid fixture ID");
    const id=r.id.toLowerCase();
    if(seen.has(id))throw new Error("Duplicate fixture ID");
    seen.add(id);
    if(r.kind!=="research"||r.status!=="published"||r.deleted_at!=null||r.approved_public!==true)continue;
    const published=date(r.published_at);
    const scheduled=r.scheduled_at==null?null:date(r.scheduled_at);
    if(!Number.isFinite(published)||published>cutoff||(scheduled!==null&&(!Number.isFinite(scheduled)||scheduled>cutoff)))continue;
    if(typeof r.title!=="string"||!r.title.trim())continue;
    // ID-only slug remains stable through title edits and avoids title collisions.
    const slug="report-"+id;
    const canonical=new URL("research/"+slug+"/",root).href;
    const existing=new URL("#post-"+id,root).href;
    const title=esc(r.title.trim().slice(0,200)),description=esc(String(r.excerpt??"").slice(0,300));
    const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+title+'</title><link rel="canonical" href="'+esc(canonical)+'"><meta name="description" content="'+description+'"><meta property="og:type" content="article"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+description+'"><meta property="og:url" content="'+esc(canonical)+'"></head><body><h1>'+title+'</h1><p>'+description+'</p><a href="'+esc(existing)+'">기존 Reader</a></body></html>';
    pages.push({id,slug,canonical,existing,html});
  }
  pages.sort((a,b)=>a.id.localeCompare(b.id));
  const sitemap='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(p=>'<url><loc>'+esc(p.canonical)+'</loc></url>').join("")+'</urlset>';
  return {pages,sitemap,synthetic:true};
}
