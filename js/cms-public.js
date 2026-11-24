"use strict";
/* SFC 2.0 public content. No authentication is needed to read published materials. */
(function(){
  const cms=window.SFC_CMS;
  const $=id=>document.getElementById(id);
  let posts=[],loaded=false,loadError="",allPeople=[],allSessions=[],researchSector="all",researchSearch="";
  let recruitConfig={status:"planned"},siteConfig={},refreshClock=null;
  const element=(tag,cls,text)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  function card(post,compact=false){
    const link=element("a","cms-card"+(compact?" compact":""));
    link.href="#post-"+post.id;
    const kind=element("span","cms-card-type",(cms.kindNames[post.kind]||post.kind)+" / SFC");
    const h=element("h3","",post.title);
    const details=[post.kind==="research"&&post.research_sector,post.kind==="research"&&post.research_company].filter(Boolean).join(" · ");
    const p=element("p","",details||post.excerpt||"본문에서 내용을 확인해 주세요.");
    const date=element("time","",cms.dateText(post.published_at));
    link.append(kind,h,p,date);
    return link;
  }
  function renderHome(){
    const list=posts.filter(x=>x.kind==="research").slice(0,3);
    const home=$("homeLiveResearch");
    if(!home)return;
    home.replaceChildren();
    if(!list.length){home.hidden=true;return;}
    home.hidden=false;
    const featured=document.querySelector(".featured-work");
    const demos=$("homeWorks");
    if(featured)featured.hidden=true;
    if(demos)demos.hidden=true;
    const wrap=element("div","cms-live-list");
    list.forEach(p=>wrap.append(card(p,true)));
    home.append(wrap);
  }
  function renderHomeUpdates(){
    const root=$("homeUpdates"),list=$("homeUpdatesList");
    if(!root||!list)return;
    const latest=posts.filter(p=>p.kind==="notice"||p.kind==="activity").slice(0,3);
    root.hidden=!latest.length;list.replaceChildren();
    latest.forEach(p=>list.append(card(p,true)));
  }
  function matchingResearch(){
    return posts.filter(p=>{
      if(p.kind!=="research")return false;
      if(researchSector!=="all"&&p.research_sector!==researchSector)return false;
      const search=[p.title,p.excerpt,p.research_sector,p.research_company,p.research_author].join(" ").toLocaleLowerCase("ko");
      return search.includes(researchSearch.toLocaleLowerCase("ko"));
    });
  }
  function renderResearch(){
    const root=$("liveResearch");if(!root)return;
    const research=posts.filter(p=>p.kind==="research");
    root.hidden=!research.length;root.replaceChildren();
    const sample=$("demoResearchBlock");
    if(sample)sample.hidden=research.length>0;
    if(!research.length)return;
    root.append(element("span","eyebrow","PUBLISHED / OFFICIAL SFC RESEARCH"));
    const toolbar=element("div","cms-research-toolbar");
    const category=element("div","cms-filters");
    category.setAttribute("role","group");
    category.setAttribute("aria-label","산업별 연구 필터");
    const sectors=["all",...new Set(research.map(p=>p.research_sector).filter(Boolean))];
    sectors.forEach(sector=>{
      const button=element("button","cms-filter"+(researchSector===sector?" active":""),sector==="all"?"전체":sector);
      button.type="button";button.setAttribute("aria-pressed",String(researchSector===sector));
      button.addEventListener("click",()=>{researchSector=sector;renderResearch();});
      category.append(button);
    });
    const input=element("input","cms-research-search");
    input.type="search";input.value=researchSearch;input.placeholder="기업·제목·작성자 검색";
    input.setAttribute("aria-label","공개 리서치 검색");
    input.addEventListener("input",()=>{
      researchSearch=input.value;
      renderResearchResults(root.querySelector(".cms-live-list"));
    });
    toolbar.append(category,input);root.append(toolbar);
    root.append(element("p","cms-research-total",research.length+" PUBLIC REPORTS"));
    const wrap=element("div","cms-live-list");root.append(wrap);
    renderResearchResults(wrap);
  }
  function renderResearchResults(wrap){
    if(!wrap)return;
    wrap.replaceChildren();
    const matched=matchingResearch();
    if(!matched.length)wrap.append(element("p","cms-empty","검색된 리서치가 없습니다."));
    matched.forEach(p=>wrap.append(card(p,true)));
    const count=$("liveResearch")?.querySelector(".cms-research-total");
    if(count)count.textContent=matched.length+" / "+posts.filter(p=>p.kind==="research").length+" PUBLIC REPORTS";
  }
  let activeFilter="all";
  function renderUpdates(){
    const filters=$("updatesFilters"),root=$("updatesList");
    if(!filters||!root)return;
    filters.replaceChildren();
    [["all","전체"],["notice","공지"],["activity","활동"],["research","리서치"]].forEach(([value,name])=>{
      const button=element("button","cms-filter"+(activeFilter===value?" active":""),name);
      button.type="button";button.setAttribute("aria-pressed",String(activeFilter===value));
      button.addEventListener("click",()=>{activeFilter=value;renderUpdates();});
      filters.append(button);
    });
    root.replaceChildren();
    const chosen=posts.filter(p=>activeFilter==="all"||p.kind===activeFilter);
    if(!chosen.length)root.append(element("p","cms-empty",loadError
      ?"글을 불러오지 못했어요. 잠시 후 다시 접속해 주세요.":"현재 공개된 게시글이 없습니다."));
    chosen.forEach(p=>root.append(card(p)));
  }
  function show(id){
    const article=posts.find(p=>p.id===id);
    const title=$("cmsPostTitle"),meta=$("cmsPostMeta"),body=$("cmsPostBody"),assets=$("cmsPostAssets");
    if(!title||!meta||!body||!assets)return;
    body.replaceChildren();assets.replaceChildren();
    if(!article){
      title.textContent=loaded?"게시글을 찾을 수 없습니다.":"게시글을 불러오는 중입니다.";
      meta.textContent=loaded?"삭제되었거나 공개되지 않은 글입니다.":"";
      return;
    }
    title.textContent=article.title;
    const description=[cms.kindNames[article.kind]||article.kind,article.research_sector,
      article.research_company,article.research_author,cms.dateText(article.published_at)].filter(Boolean);
    meta.textContent=description.join(" / ");
    cms.renderBody(body,article.body);
    if(article.excerpt)body.prepend(element("p","cms-post-deck",article.excerpt));
    if(article.kind==="research"&&(article.research_method||article.research_limitations)){
      const section=element("section","cms-research-notes");
      if(article.research_method){
        section.append(element("h2","","분석 방법"),element("p","",article.research_method));
      }
      if(article.research_limitations){
        section.append(element("h2","","가정과 한계"),element("p","",article.research_limitations));
      }
      body.append(section);
    }
    const cover=cms.safeUrl(article.cover_url),file=cms.safeUrl(article.attachment_url);
    if(cover){
      const img=element("img","cms-post-cover");
      img.src=cover;img.alt="게시글 대표 이미지";img.loading="lazy";
      assets.append(img);
    }
    if(file){
      const link=element("a","cms-download","첨부 PDF 열기 ↗");
      link.href=file;link.target="_blank";link.rel="noopener noreferrer";
      assets.append(link);
    }
  }
  function setText(selector,value){
    if(!value||typeof value!=="string")return;
    const target=document.querySelector(selector);
    if(target)target.textContent=value;
  }
  function applySiteSettings(v){
    siteConfig=v||{};
    if(v?.hero_description)window.SFC_HERO_EDIT?.(v.hero_description);
    setText(".about-photo-panel h2",v?.about_heading);
    setText(".about-photo-panel p",v?.about_body);
    setText(".about-end p",v?.program_note);
    const email=String(v?.contact_email||"");
    if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      const link=$("siteContactLink");
      if(link){link.hidden=false;link.href="mailto:"+encodeURIComponent(email);link.textContent="CONTACT / "+email;}
    }
  }
  function publicPeople(){
    if(!allPeople.length)return;
    const root=$("roleList");
    if(!root)return;
    root.replaceChildren();
    const sorted=allPeople.filter(x=>x.visible).sort((a,b)=>a.sort_order-b.sort_order);
    sorted.forEach((p,i)=>{
      const row=element("div","cms-person-row");
      row.append(element("span","cms-person-index",String(i+1).padStart(2,"0")));
      const main=element("div","cms-person-details");
      main.append(element("h3","",p.name),element("p","",p.position+(p.term?" / "+p.term:"")));
      if(p.bio)main.append(element("p","cms-person-bio",p.bio));
      row.append(main);root.append(row);
    });
    if(sorted.length){
      setText(".people-lead p","학회의 실제 운영진을 소개합니다.");
      const disclaimer=document.querySelector(".role-notice");
      if(disclaimer)disclaimer.hidden=true;
    }
  }
  function publicSessions(){
    const sessions=allSessions.filter(x=>x.visible).sort((a,b)=>a.sort_order-b.sort_order);
    if(!sessions.length)return;
    const tabs=$("scheduleTabs"),root=$("scheduleList");
    if(!tabs||!root)return;
    const title=document.querySelector(".schedule-header strong");
    if(title)title.textContent="SFC / CURRENT PROGRAM";
    const count=document.querySelector(".schedule-header small");
    if(count)count.textContent=sessions.length+" SESSIONS / PUBLISHED";
    const notice=document.querySelector("#activities .notice-inline");
    if(notice)notice.textContent="실제 공개된 교육과정입니다. 세부 내용은 변경될 수 있습니다.";
    let stage="all";
    const stages=[["all","전체"],["foundation","기초교육"],["application","기업분석 실습"],["research","최종 연구"]];
    function render(){
      tabs.replaceChildren();root.replaceChildren();
      stages.forEach(([value,label])=>{
        const b=element("button",(stage===value?"selected":""),label);
        b.type="button";b.setAttribute("aria-pressed",String(stage===value));
        b.addEventListener("click",()=>{stage=value;render();});
        tabs.append(b);
      });
      sessions.filter(x=>stage==="all"||x.stage===stage).forEach((s,i)=>{
        const section=element("div","cms-session");
        const button=element("button","cms-session-head");
        button.type="button";button.setAttribute("aria-expanded","false");
        button.append(element("span","cms-session-week","W"+s.week_label),
          element("strong","",s.title),element("span","cms-session-summary",s.summary||""));
        const panel=element("div","cms-session-detail",s.detail||"세부 내용은 추후 안내됩니다.");
        panel.hidden=true;
        button.addEventListener("click",()=>{
          const opened=!panel.hidden;panel.hidden=opened;
          button.setAttribute("aria-expanded",String(!opened));
        });
        section.append(button,panel);root.append(section);
      });
    }
    render();
  }
  function computedRecruitStatus(){
    const v=recruitConfig||{};
    if(v.status==="closed")return "closed";
    const now=Date.now(),start=v.start_at?new Date(v.start_at).getTime():null,
      end=v.end_at?new Date(v.end_at).getTime():null;
    if(end&&now>end)return "closed";
    if(start&&now<start)return "planned";
    if(start&&now>=start)return "open";
    return v.status==="open"?"open":"planned";
  }
  function renderRecruitment(){
    const v=recruitConfig||{};
    const status=computedRecruitStatus();
    const names={planned:"모집 예정",open:"모집 중",closed:"모집 마감"};
    setText("#recruitStatus",names[status]);
    const statusEl=$("recruitStatus");
    if(statusEl)statusEl.dataset.status=status;
    setText("#recruitTitle",v.title);
    setText("#recruitMessage",v.message);
    for(const [id,key] of [
      ["recruitAudiencePublic","audience"],["recruitCapacityPublic","capacity"],
      ["recruitMeetingPublic","meeting"],["recruitMethodPublic","method"]
    ])setText("#"+id,v[key]);
    const instructions=$("recruitInstructionsPublic");
    if(instructions){
      instructions.hidden=!v.instructions;
      if(v.instructions)instructions.textContent=v.instructions;
    }
    const pdf=cms.safeUrl(v.pdf_url);
    const editable=cms.safeUrl(v.docx_url);
    const label=$("applicationAvailability");
    if(label)label.textContent=pdf?"PDF 미리보기 및 다운로드 가능":"공식 지원서 양식 등록 전";
    const download=$("applicationDownload");
    if(download){
      download.hidden=!pdf;
      if(pdf)download.href=pdf;else download.removeAttribute("href");
    }
    const doc=$("applicationDocxDownload");
    if(doc){
      doc.hidden=!editable;
      if(editable)doc.href=editable;else doc.removeAttribute("href");
    }
  }
  function openApplicationDialog(){
    const dialog=$("applicationDialog");
    if(!dialog)return;
    const pdf=cms.safeUrl(recruitConfig?.pdf_url);
    const frame=$("applicationFrame"),fallback=$("applicationUnavailable");
    frame.hidden=!pdf;fallback.hidden=Boolean(pdf);
    if(pdf){frame.src=pdf+"#toolbar=0";}else{frame.removeAttribute("src");}
    dialog.showModal();
  }
  function closeApplicationDialog(){
    const dialog=$("applicationDialog");
    if(!dialog)return;
    dialog.close();
    $("applicationFrame").removeAttribute("src");
    $("applicationTrigger").focus();
  }
  $("applicationTrigger")?.addEventListener("click",openApplicationDialog);
  $("applicationClose")?.addEventListener("click",closeApplicationDialog);
  $("applicationDialog")?.addEventListener("close",()=>$("applicationFrame").removeAttribute("src"));
  $("applicationDialog")?.addEventListener("click",event=>{
    if(event.target===$("applicationDialog"))closeApplicationDialog();
  });
  async function load(){
    if(!cms)return;
    try{
      const db=await cms.getClient();
      if(!db){loaded=true;renderUpdates();return;}
      const results=await Promise.allSettled([
        db.from("cms_posts").select(
          "id,kind,title,excerpt,body,cover_url,attachment_url,published_at,research_sector,research_company,research_author,research_method,research_limitations"
        ).eq("status","published").is("deleted_at",null).order("published_at",{ascending:false}).limit(300),
        db.from("cms_site_settings").select("key,value"),
        db.from("cms_people").select("id,name,position,term,bio,sort_order,visible").eq("visible",true).order("sort_order"),
        db.from("cms_sessions").select("id,week_label,title,summary,detail,stage,sort_order,visible").eq("visible",true).order("sort_order")
      ]);
      if(results[0].status==="fulfilled"&&!results[0].value.error)posts=results[0].value.data||[];
      else loadError="게시글 조회 실패";
      if(results[1].status==="fulfilled"&&!results[1].value.error){
        const settings=results[1].value.data||[];
        for(const row of settings){
          if(row.key==="site")applySiteSettings(row.value||{});
          if(row.key==="recruitment")recruitConfig=row.value||{};
        }
      }
      if(results[2].status==="fulfilled"&&!results[2].value.error)allPeople=results[2].value.data||[];
      if(results[3].status==="fulfilled"&&!results[3].value.error)allSessions=results[3].value.data||[];
    }catch(e){loadError=String(e.message||e);}
    loaded=true;
    renderHome();renderHomeUpdates();renderResearch();renderUpdates();publicPeople();publicSessions();renderRecruitment();
    const route=/^post-([0-9a-f-]{36})$/.exec(location.hash.slice(1));
    if(route)show(route[1]);
    clearInterval(refreshClock);
    refreshClock=setInterval(renderRecruitment,60_000);
  }
  window.SFC_PUBLIC={show,load};
  load();
})();
