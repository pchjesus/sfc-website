"use strict";
/* Public CMS feed; sample reports remain visibly marked as demos. */
(function(){
  const cms=window.SFC_CMS;
  let posts=[],loaded=false,problem="",filter="all";
  const node=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  function card(post,compact=false){
    const a=node("a",compact?"cms-card compact":"cms-card");
    a.href="#post-"+post.id;
    const tag=node("span","cms-card-type",(cms.kindNames[post.kind]||post.kind)+" / SFC");
    const h=node("h3","",post.title);
    const p=node("p","",post.excerpt||"본문에서 자세한 내용을 확인할 수 있습니다.");
    const t=node("time","",cms.dateText(post.published_at));
    a.append(tag,h,p,t);
    return a;
  }
  function renderResearch(){
    const target=document.getElementById("liveResearch");if(!target)return;
    const list=posts.filter(p=>p.kind==="research");
    target.hidden=list.length===0;target.replaceChildren();
    if(!list.length)return;
    target.append(node("span","eyebrow","PUBLISHED / SFC RESEARCH"));
    const wrap=node("div","cms-live-list");
    list.forEach(p=>wrap.append(card(p,true)));
    target.append(wrap);
  }
  function renderFilters(){
    const target=document.getElementById("updatesFilters");if(!target)return;
    target.replaceChildren();
    [["all","전체"],["notice","공지"],["activity","활동"],["research","리서치"]].forEach(([value,label])=>{
      const b=node("button","cms-filter"+(value===filter?" active":""),label);
      b.type="button";b.setAttribute("aria-pressed",String(value===filter));
      b.addEventListener("click",()=>{filter=value;renderFilters();renderUpdates();});
      target.appendChild(b);
    });
  }
  function renderUpdates(){
    const target=document.getElementById("updatesList");if(!target)return;
    const list=posts.filter(p=>filter==="all"||p.kind===filter);
    target.replaceChildren();
    if(!list.length){
      target.append(node("p","cms-empty",problem
        ? "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        : "현재 공개된 게시글이 없습니다."));
      return;
    }
    list.forEach(p=>target.append(card(p)));
  }
  function show(id){
    const title=document.getElementById("cmsPostTitle"),meta=document.getElementById("cmsPostMeta");
    const body=document.getElementById("cmsPostBody"),assets=document.getElementById("cmsPostAssets");
    if(!title||!meta||!body||!assets)return;
    body.replaceChildren();assets.replaceChildren();
    const item=posts.find(p=>p.id===id);
    if(!item){
      title.textContent=loaded?"게시글을 찾을 수 없습니다.":"게시글을 불러오는 중입니다.";
      meta.textContent=loaded?"게시 취소되었거나 존재하지 않는 글입니다.":"";
      return;
    }
    title.textContent=item.title;
    meta.textContent=(cms.kindNames[item.kind]||item.kind)+"  /  "+cms.dateText(item.published_at);
    if(item.excerpt)body.append(node("p","cms-post-deck",item.excerpt));
    cms.renderBody(body,item.body);
    if(item.excerpt)body.prepend(node("p","cms-post-deck",item.excerpt));
    const cover=cms.safeUrl(item.cover_url),attachment=cms.safeUrl(item.attachment_url);
    if(cover){const img=node("img","cms-post-cover");img.src=cover;img.alt="게시글 첨부 이미지";img.loading="lazy";assets.append(img);}
    if(attachment){
      const link=node("a","cms-download","첨부 PDF 보기 ↗");
      link.href=attachment;link.target="_blank";link.rel="noopener noreferrer";
      assets.append(link);
    }
  }
  async function load(){
    if(!cms){return;}
    try{
      const client=await cms.getClient();
      if(client){
        const {data,error}=await client.from("cms_posts")
          .select("id,kind,title,excerpt,body,cover_url,attachment_url,published_at")
          .eq("status","published").order("published_at",{ascending:false}).limit(100);
        if(error)throw error;
        posts=data||[];
      }
    }catch(e){problem=String(e?.message||e);}
    loaded=true;renderFilters();renderUpdates();renderResearch();
    const match=/^post-([0-9a-f-]{36})$/.exec(location.hash.slice(1));
    if(match)show(match[1]);
  }
  window.SFC_PUBLIC={show,load};
  load();
})();
