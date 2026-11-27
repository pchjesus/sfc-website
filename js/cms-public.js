"use strict";
/* SFC 2.0 public content. No authentication is needed to read published materials. */
(function(){
  const cms=window.SFC_CMS;
  const motion=window.SFC_MOTION;
  const $=id=>document.getElementById(id);
  let posts=[],loaded=false,loadError="",allPeople=[],allSessions=[],researchSector="all",researchSearch="";
  let recruitConfig={status:"planned"},siteConfig={},refreshClock=null,publicDb=null;
  let peopleError=false,sessionsError=false,settingsError=false;
  const orderRows=(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.id).localeCompare(String(b.id));
  const recruitmentDefaults=new Map(["recruitTitle","recruitMessage","recruitAudiencePublic","recruitCapacityPublic","recruitMeetingPublic","recruitMethodPublic"].map(id=>[id,$(id)?.innerHTML||""]));
  let showRevision=0,loadRevision=0;
  const element=(tag,cls,text)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  function card(post,compact=false){
    const link=element("a","cms-card"+(compact?" compact":""));
    link.href="#post-"+post.id;
    link.dataset.motionKey="post-"+post.id;
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
    const hasResearch=list.length>0;
    const featured=document.querySelector(".featured-work"),demos=$("homeWorks");
    if(featured)featured.hidden=hasResearch;
    if(demos)demos.hidden=hasResearch;
    home.hidden=!hasResearch;
    if(!hasResearch)return;
    const wrap=element("div","cms-live-list");
    list.forEach((p,i)=>{const el=card(p,true);el.dataset.motion="rise";el.dataset.motionDelay=String(i*45);wrap.append(el);});
    home.append(wrap);
  }
  function renderHomeUpdates(){
    const root=$("homeUpdates"),list=$("homeUpdatesList");
    if(!root||!list)return;
    const latest=posts.filter(p=>p.kind==="notice"||p.kind==="activity").slice(0,3);
    root.hidden=!latest.length;list.replaceChildren();
    latest.forEach((p,i)=>{const el=card(p,true);el.dataset.motion="rise";el.dataset.motionDelay=String(i*40);list.append(el);});
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
    if(window.SFC_PLATFORM){
      root.hidden=true;const demo=$("demoResearchBlock");if(demo)demo.hidden=true;
      return;
    }
    const research=posts.filter(p=>p.kind==="research");
    root.hidden=!research.length;
    const sample=$("demoResearchBlock");
    if(sample)sample.hidden=research.length>0;
    if(!research.length){root.replaceChildren();return;}
    let toolbar=root.querySelector(".cms-research-toolbar");
    if(!toolbar){
      root.replaceChildren(element("span","eyebrow","PUBLISHED / OFFICIAL SFC RESEARCH"));
      toolbar=element("div","cms-research-toolbar");
      const category=element("div","cms-filters");
      category.setAttribute("role","group");category.setAttribute("aria-label","산업별 연구 필터");
      const input=element("input","cms-research-search");
      input.type="search";input.value=researchSearch;input.placeholder="기업·제목·작성자 검색";
      input.setAttribute("aria-label","공개 리서치 검색");
      input.addEventListener("input",()=>{
        researchSearch=input.value;
        renderResearchResults(root.querySelector(".cms-live-list"));
      });
      toolbar.append(category,input);
      root.append(toolbar,element("p","cms-research-total"),element("div","cms-live-list"));
      root.querySelector(".cms-research-total").setAttribute("aria-live","polite");
    }
    const sectors=["all",...new Set(research.map(p=>p.research_sector).filter(Boolean))];
    if(!sectors.includes(researchSector))researchSector="all";
    motion.controls(toolbar.querySelector(".cms-filters"),sectors.map(x=>[x,x==="all"?"전체":x]),researchSector,value=>{
      if(value===researchSector)return;
      researchSector=value;renderResearch();
    });
    renderResearchResults(root.querySelector(".cms-live-list"));
  }
  function renderResearchResults(wrap){
    if(!wrap)return;
    const matched=matchingResearch(),nodes=matched.map(p=>card(p,true));
    if(!nodes.length){
      const empty=element("p","cms-empty","검색된 리서치가 없습니다.");empty.dataset.motionKey="empty";nodes.push(empty);
    }
    motion.reconcile(wrap,nodes,{reuse:"equal"});
    const count=$("liveResearch")?.querySelector(".cms-research-total");
    if(count)count.textContent=matched.length+" / "+posts.filter(p=>p.kind==="research").length+" PUBLIC REPORTS";
  }
  let activeFilter="all";
  function renderUpdates(){
    const filters=$("updatesFilters"),root=$("updatesList");
    if(!filters||!root)return;
    motion.controls(filters,[["all","전체"],["notice","공지"],["activity","활동"],["research","리서치"]],activeFilter,value=>{
      if(value===activeFilter)return;activeFilter=value;renderUpdates();
    });
    const chosen=posts.filter(p=>activeFilter==="all"||p.kind===activeFilter),nodes=chosen.map(p=>card(p));
    if(!nodes.length){
      const empty=element("div","cms-empty-state");
      empty.dataset.motionKey="empty";
      if(loadError){
        empty.setAttribute("role","status");
        empty.append(element("span","eyebrow","CONNECTION UNAVAILABLE"),
          element("h3","","게시글을 불러오지 못했습니다."),
          element("p","","네트워크 연결을 확인한 뒤 다시 시도해 주세요."));
        const retry=element("button","","다시 시도");
        retry.type="button";
        retry.addEventListener("click",()=>{
          retry.disabled=true;
          empty.querySelector("p").textContent="게시글을 다시 불러오는 중입니다.";
          void load();
        });
        empty.append(retry);
      }else if(!posts.length){
        empty.append(element("span","eyebrow","NO POSTS YET"),
          element("h3","","아직 등록된 소식이 없습니다."),
          element("p","","모집 일정과 학회 공지사항은 게시되는 대로 이곳에서 확인할 수 있습니다."));
      }else{
        empty.append(element("span","eyebrow","NO MATCHES"),
          element("h3","","해당 분류에 등록된 게시글이 없습니다."),
          element("p","","다른 유형을 선택하면 공개된 글을 확인할 수 있습니다."));
      }
      nodes.push(empty);
    }
    motion.reconcile(root,nodes,{reuse:"equal",exit:false});
    if(chosen.length)window.SFC_V28?.firstList(root,".cms-card",3);
  }
  async function show(id){
    const revision=++showRevision;
    window.SFC_READER?.status("게시글을 불러오는 중입니다.","");
    try{
      const db=publicDb||await cms.getPublicClient();
      if(!db)throw new Error("Public client unavailable");
      let article;
      {
        const response=await db.from("cms_posts").select(
          "id,kind,title,excerpt,body,cover_url,attachment_url,published_at,research_sector,research_company,research_author,research_method,research_limitations"
        ).eq("id",id).eq("status","published").is("deleted_at",null)
          .or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString()).maybeSingle();
        if(response.error)throw response.error;
        article=response.data;
        // Re-query public visibility on every open; formerly public rows may be withdrawn.
      }
      if(revision!==showRevision||location.hash.slice(1)!=="post-"+id)return;
      if(article)window.SFC_READER?.render(article,cms);
      else window.SFC_READER?.status("게시글을 찾을 수 없습니다.","삭제되었거나 공개되지 않은 글입니다.");
    }catch(_error){
      if(revision===showRevision)window.SFC_READER?.status(
        "게시글을 불러오지 못했습니다.","연결 상태를 확인하고 다시 시도해 주세요.");
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
    // Studio can override a genuinely customized introduction.
    // A stored *legacy default* must not silently overwrite the owner-approved
    // v2.7 public copy; preserve the two-sentence responsive DOM in that case.
    const intro=document.querySelector(".about-photo-panel [data-about-intro]");
    if(intro&&typeof v?.about_body==="string"&&v.about_body.trim()){
      const legacy="SFC(Sangmyung Financial Club)는 상명대학교 경영학부 기업재무분석 학술동아리입니다. 기업의 사업구조와 재무 데이터를 분석하고, 가치평가의 가정을 검증하며, 근거에 기반한 판단을 토론합니다.";
      const approved="SFC는 상명대학교 경영학부 기업재무분석 학술동아리로, 기업의 사업구조를 살피고 재무제표와 가치평가 모델을 분석합니다. 팀별 토론과 최종 보고서 발표까지 이어지는 15주 과정으로 진행됩니다.";
      const normalize=text=>String(text).replace(/\s+/g," ").trim();
      const body=normalize(v.about_body);
      if(body!==normalize(legacy)&&body!==normalize(approved))intro.textContent=v.about_body;
    }
    setText(".about-end p",v?.program_note);
    const email=String(v?.contact_email||"");
    const contact=$("siteContactLink");if(contact){contact.hidden=true;contact.removeAttribute("href");contact.textContent="";}
    if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      const link=$("siteContactLink");
      if(link){link.hidden=false;link.href="mailto:"+encodeURIComponent(email);link.textContent="CONTACT / "+email;}
    }
  }
  function publicPeople(){
    const root=$("roleList");if(!root)return;
    const sorted=allPeople.filter(x=>x.visible).sort(orderRows);
    if(window.SFC_PEOPLE_RECRUITMENT){
      window.SFC_PEOPLE_RECRUITMENT.setPeople(sorted);
      if(peopleError)$("peopleDisclaimer").textContent="조회 실패 / 아래 역할 구조는 운영 기획안이며 실제 운영진 정보는 확인할 수 없습니다.";
      livePeopleMode=sorted.length>0;
      return;
    }
    if(!sorted.length){
      if(livePeopleMode){livePeopleMode=false;window.SFC_DEMO?.people();}
      return;
    }
    livePeopleMode=true;
    const nodes=sorted.map((p,i)=>{
      const row=element("div","cms-person-row");
      row.dataset.motionKey="person-"+p.id;
      row.dataset.motion="rise";
      row.dataset.motionDelay=String(Math.min(i*35,120));
      row.append(element("span","cms-person-index",String(i+1).padStart(2,"0")));
      const main=element("div","cms-person-details");
      const button=element("button","cms-person-toggle");
      button.type="button";button.setAttribute("aria-expanded","false");
      const panelId="person-bio-"+p.id;
      button.setAttribute("aria-controls",panelId);
      const info=element("span","cms-person-info");
      info.append(element("strong","",p.name),element("small","",[p.position,p.term].filter(Boolean).join(" / ")));
      button.append(info,element("span","motion-plus","＋"));
      const panel=element("div","motion-disclosure");
      panel.id=panelId;panel.inert=true;panel.setAttribute("aria-hidden","true");
      const inner=element("div","");inner.append(element("p","cms-person-bio",p.bio||"세부 소개는 추후 안내됩니다."));
      panel.append(inner);
      button.addEventListener("click",()=>motion.accordion(root,".cms-person-row",row.classList.contains("open")?null:row));
      main.append(button,panel);row.append(main);return row;
    });
    motion.reconcile(root,nodes,{reuse:"equal"});
    setText(".people-lead p","학회의 실제 운영진을 소개합니다.");
    const disclaimer=document.querySelector(".role-notice");if(disclaimer)disclaimer.hidden=true;
    motion.reveal();
  }
  let liveStage="all",liveOpen=null,liveSessionMode=false,livePeopleMode=false;
  function publicSessions(){
    const sessions=allSessions.filter(x=>x.visible).sort(orderRows);
    if(!sessions.length){
      if(liveSessionMode){liveSessionMode=false;liveOpen=null;window.SFC_DEMO?.schedule(liveStage);}
      const notice=document.querySelector("#activities .notice-inline");if(notice)notice.textContent=sessionsError?"조회 실패 / 아래 교육과정은 운영 기획안이며 실제 공개 자료는 확인할 수 없습니다.":"※ 위 과정은 운영 기획안 기준이며 학기 일정에 따라 조정될 수 있습니다. 주차를 눌러 세부 내용을 볼 수 있습니다.";
      return;
    }
    const tabs=$("scheduleTabs"),root=$("scheduleList");
    if(!tabs||!root)return;
    const firstLive=!liveSessionMode;
    liveSessionMode=true;
    const title=document.querySelector(".schedule-header strong");
    if(title)title.textContent="SFC / CURRENT PROGRAM";
    const count=document.querySelector(".schedule-header small");
    if(count)count.textContent=sessions.length+" SESSIONS / PUBLISHED";
    const notice=document.querySelector("#activities .notice-inline");
    if(notice)notice.textContent="실제 공개된 교육과정입니다. 세부 내용은 변경될 수 있습니다.";
    const stages=[["all","전체"],["foundation","기초교육"],["application","기업분석 실습"],["research","최종 연구"]];
    if(firstLive){
      const prior=tabs.querySelector('[aria-pressed="true"]')?.dataset.value;
      if(stages.some(([v])=>v===prior))liveStage=prior;
    }
    if(!sessions.some(s=>s.id===liveOpen))liveOpen=null;
    function toggleLive(id){
      liveOpen=liveOpen===id?null:id;
      const active=[...root.children].find(el=>el.dataset.motionKey==="live-session-"+liveOpen);
      motion.accordion(root,".cms-session",active||null);
    }
    // Rebuild only when the underlying *data* changed, never on tab clicks.
    const signature=JSON.stringify(sessions);
    if(root.dataset.curriculumMode!=="live"||root.dataset.curriculumSource!==signature){
      const nodes=sessions.map(s=>{
        const section=element("div","cms-session");
        section.dataset.motionKey="live-session-"+s.id;
        section.dataset.stage=s.stage;
        const button=element("button","cms-session-head");
        button.type="button";
        const expanded=liveOpen===s.id;
        section.classList.toggle("open",expanded);
        button.setAttribute("aria-expanded",String(expanded));
        const panelId="live-session-panel-"+s.id;
        button.setAttribute("aria-controls",panelId);
        button.append(element("span","cms-session-week","W"+s.week_label),
          element("strong","",s.title),element("span","cms-session-summary",s.summary||""),element("span","motion-plus","＋"));
        const panel=element("div","motion-disclosure");
        panel.id=panelId;panel.inert=!expanded;panel.setAttribute("aria-hidden",String(!expanded));
        const inner=element("div","");
        inner.append(element("p","cms-session-detail",s.detail||"세부 내용은 추후 안내됩니다."));
        panel.append(inner);
        button.addEventListener("click",()=>toggleLive(s.id));
        section.append(button,panel);
        return section;
      });
      root.replaceChildren(...nodes);
      root.dataset.curriculumMode="live";
      root.dataset.curriculumSource=signature;
      delete root.dataset.filtered;
    }
    const render=()=>{
      motion.controls(tabs,stages,liveStage,value=>{
        if(value===liveStage)return;
        liveStage=value;
        if(!sessions.some(s=>s.id===liveOpen&&(value==="all"||s.stage===value)))liveOpen=null;
        render();
      });
      motion.filterRows(root,liveStage);
      const active=[...root.children].find(el=>el.dataset.motionKey==="live-session-"+liveOpen);
      motion.accordion(root,".cms-session",active||null);
    };
    render();
  }
  function computedRecruitStatus(){
    const v=recruitConfig||{};
    if(v.status==="closed")return "closed";
    const now=Date.now(),start=v.start_at?new Date(v.start_at).getTime():null,
      end=v.end_at?new Date(v.end_at).getTime():null;
    if((v.start_at&&!Number.isFinite(start))||(v.end_at&&!Number.isFinite(end))||(start!==null&&end!==null&&start>=end))return "planned";
    if(end!==null&&now>=end)return "closed";
    if(start&&now<start)return "planned";
    if(start&&now>=start)return "open";
    return v.status==="open"?"open":"planned";
  }
  function renderRecruitment(){
    const v=recruitConfig||{};
    const status=computedRecruitStatus();
    const names={planned:"모집 예정",open:"모집 중",closed:"모집 마감"};
    for(const [id,html] of recruitmentDefaults){const el=$(id);if(el)el.innerHTML=html;}
    setText("#recruitStatus",settingsError?"모집 상태 미확인":names[status]);
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
    window.SFC_PEOPLE_RECRUITMENT?.syncRecruitment();
    if(settingsError){const message=$("recruitMessage");if(message)message.textContent="모집 설정을 불러오지 못했습니다. 공식 공고를 확인해 주세요.";}

  }
  let modalTransition=null;
  function openApplicationDialog(){
    const dialog=$("applicationDialog");
    if(!dialog||dialog.open)return;
    modalTransition?.cancel();
    const pdf=cms.safeUrl(recruitConfig?.pdf_url);
    const docx=cms.safeUrl(recruitConfig?.docx_url);
    const frame=$("applicationFrame"),fallback=$("applicationUnavailable"),status=$("applicationPreviewStatus");
    frame.hidden=!pdf;fallback.hidden=Boolean(pdf);
    fallback.textContent=docx&&!pdf
      ?"PDF 미리보기는 제공되지 않습니다. 아래에서 편집용 DOCX 파일을 내려받을 수 있습니다."
      :"공식 지원서가 아직 등록되지 않았습니다. 모집 공고 이후 다시 확인해 주세요.";
    if(status){status.hidden=!pdf;status.textContent=pdf?"미리보기를 불러오는 중…":"";}
    if(pdf){frame.src=pdf+"#toolbar=0";}else{frame.removeAttribute("src");}
    dialog.showModal();
    modalTransition=motion.play(dialog,[{opacity:0,transform:"translateY(10px) scale(.98)"},{opacity:1,transform:"none"}],{duration:motion.timing.modal});
    $("applicationClose").focus({preventScroll:true});
  }
  function closeApplicationDialog(){
    const dialog=$("applicationDialog");
    if(!dialog?.open||dialog.dataset.closing==="true")return;
    const currentOpacity=Number(getComputedStyle(dialog).opacity);
    const currentTransform=getComputedStyle(dialog).transform;
    modalTransition?.cancel();
    dialog.dataset.closing="true";
    const finish=()=>{delete dialog.dataset.closing;if(dialog.open)dialog.close();};
    modalTransition=motion.play(dialog,[{opacity:currentOpacity,transform:currentTransform},{opacity:0,transform:"translateY(6px) scale(.985)"}],{duration:motion.timing.close});
    if(modalTransition)modalTransition.finished.then(finish,finish);else finish();
  }
  $("applicationTrigger")?.addEventListener("click",openApplicationDialog);
  $("applicationClose")?.addEventListener("click",closeApplicationDialog);
  $("applicationFrame")?.addEventListener("load",()=>{
    const status=$("applicationPreviewStatus");if(status)status.hidden=true;
  });
  $("applicationDialog")?.addEventListener("cancel",event=>{event.preventDefault();closeApplicationDialog();});
  $("applicationDialog")?.addEventListener("close",()=>{
    $("applicationFrame").removeAttribute("src");
    $("applicationTrigger").focus({preventScroll:true});
  });
  $("applicationDialog")?.addEventListener("click",event=>{
    if(event.target!==$("applicationDialog"))return;
    const r=event.target.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeApplicationDialog();
  });
  async function load(){
    if(!cms)return;
    const revision=++loadRevision;showRevision++;
    try{
      const db=await cms.getPublicClient();
      if(revision!==loadRevision)return;
      publicDb=db;
      if(!db){loadError="공개 게시글 연결을 확인할 수 없습니다.";loaded=true;renderUpdates();return;}
      const results=await Promise.allSettled([
        db.from("cms_posts").select(
          "id,kind,title,excerpt,published_at,research_sector,research_company,research_author"
        ).eq("status","published").is("deleted_at",null)
          .or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString())
          .order("published_at",{ascending:false}).limit(80),
        db.from("cms_site_settings").select("key,value"),
        db.from("cms_people").select("id,name,position,term,bio,sort_order,visible").eq("visible",true).order("sort_order"),
        db.from("cms_sessions").select("id,week_label,title,summary,detail,stage,sort_order,visible").eq("visible",true).order("sort_order")
      ]);
      if(revision!==loadRevision)return;
      if(results[0].status==="fulfilled"&&!results[0].value.error){posts=results[0].value.data||[];loadError="";}
      else{posts=[];loadError="게시글 조회 실패";}
      if(results[1].status==="fulfilled"&&!results[1].value.error){
        settingsError=false;recruitConfig={status:"planned"};
        const settings=results[1].value.data||[];
        for(const row of settings){
          if(row.key==="site")applySiteSettings(row.value||{});
          if(row.key==="recruitment")recruitConfig=row.value||{};
        }
      }
      else{settingsError=true;recruitConfig={status:"planned"};applySiteSettings({});}
      peopleError=results[2].status!=="fulfilled"||Boolean(results[2].value?.error);allPeople=peopleError?[]:results[2].value.data||[];
      sessionsError=results[3].status!=="fulfilled"||Boolean(results[3].value?.error);allSessions=sessionsError?[]:results[3].value.data||[];
    }catch(e){if(revision!==loadRevision)return;posts=[];loadError=String(e.message||e);}
    if(revision!==loadRevision)return;
    loaded=true;
    renderHome();renderHomeUpdates();renderResearch();renderUpdates();publicPeople();publicSessions();renderRecruitment();motion.reveal();
    if(publicDb)void window.SFC_PLATFORM?.connect(publicDb);
    const route=/^post-([0-9a-f-]{36})$/.exec(location.hash.slice(1));
    if(route)show(route[1]);
    clearInterval(refreshClock);
    refreshClock=setInterval(renderRecruitment,60_000);
  }
  window.SFC_PUBLIC={show,load,openApplicationDialog};
  load();
})();
