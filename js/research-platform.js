"use strict";
/* SFC v2.6 Research Archive: same UI for demo and actual public reports.
   Published queries use an isolated anonymous Supabase client + RLS. */
(function(){
  const root=document.getElementById("researchWorkbench");
  if(!root)return;
  const limit=6;
  const $=id=>document.getElementById(id);
  const state={search:"",sector:"all",sort:"new",view:"list",page:1};
  const u=new URL(location.href).searchParams;
  state.search=(u.get("sfcq")||"").slice(0,60);
  state.sector=(u.get("sfcs")||"all").slice(0,100);
  state.sort=["new","old","title"].includes(u.get("sfco"))?u.get("sfco"):"new";
  state.view=u.get("sfcv")==="grid"?"grid":"list";
  state.page=Math.max(1,Math.min(5000,Number.parseInt(u.get("sfcp")||"1",10)||1));
  let client=null,mode="demo",demos=[],openDemo=null,sectors=[],requestVersion=0,total=0;
  let debounce=null;
  const short=q=>String(q||"").normalize("NFKC").replace(/[^\p{L}\p{N}\s_-]/gu,"").trim().slice(0,60);
  const node=(tag,cls,text)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  root.innerHTML=`
    <div class="archive-intro">
      <div><span class="eyebrow">RESEARCH LIBRARY</span></div>
      <span class="archive-mode" id="archiveMode">예시 자료 · 공식 발행 전</span>
    </div>
    <div class="archive-workspace">
      <div class="archive-search-row">
        <label class="archive-search"><span class="archive-search-icon" aria-hidden="true">⌕</span><span class="sr-only">보고서 검색</span>
        <input type="search" id="archiveSearch" autocomplete="off" placeholder="보고서 제목 · 기업 · 산업 검색" maxlength="60"></label>
        <button type="button" id="archiveReset" class="archive-reset">초기화 ↗</button>
      </div>
      <div class="archive-controls">
        <div id="archiveSectors" class="archive-sector-tabs" role="group" aria-label="리서치 산업·유형 필터"></div>
        <div class="archive-right">
          <label class="archive-sort-label">정렬
          <select id="archiveSort" aria-label="리서치 정렬">
            <option value="new">최신순</option><option value="old">오래된순</option><option value="title">제목순</option>
          </select></label>
          <div class="archive-view-toggle" role="group" aria-label="보고서 표시 형태">
            <button type="button" id="archiveListButton" aria-pressed="true" aria-label="목록 보기">☷</button>
            <button type="button" id="archiveGridButton" aria-pressed="false" aria-label="격자 보기">▦</button>
          </div>
        </div>
      </div>
      <div class="archive-result-meta"><span id="archiveCount" role="status"></span><span id="archiveReadingHint">SELECT A REPORT / EXPLORE ITS FRAMEWORK</span></div>
      <div id="archiveResults" class="archive-results" aria-live="polite" aria-busy="false"></div>
      <nav id="archivePager" class="archive-pager" aria-label="리서치 페이지 이동">
        <button type="button" id="archivePrev">← PREVIOUS</button>
        <span id="archivePage" aria-live="polite"></span>
        <button type="button" id="archiveNext">NEXT →</button>
      </nav>
    </div>
    <p id="archiveDisclosure" class="archive-disclosure">DEMO / 모든 제목과 날짜는 시연을 위한 예시이며 실제 SFC 연구 성과가 아닙니다.</p>`;
  const search=$("archiveSearch"), results=$("archiveResults"), pager=$("archivePager");
  search.value=state.search;$("archiveSort").value=state.sort;
  function persist(){
    const url=new URL(location.href);
    for(const key of ["sfcq","sfcs","sfco","sfcv","sfcp"])url.searchParams.delete(key);
    if(state.search)url.searchParams.set("sfcq",state.search);
    if(state.sector!=="all")url.searchParams.set("sfcs",state.sector);
    if(state.sort!=="new")url.searchParams.set("sfco",state.sort);
    if(state.view!=="list")url.searchParams.set("sfcv",state.view);
    if(state.page!==1)url.searchParams.set("sfcp",String(state.page));
    history.replaceState(history.state,"",url.pathname+url.search+url.hash);
  }
  function controls(){
    const values=["all",...sectors];
    if(!values.includes(state.sector))state.sector="all";
    const host=$("archiveSectors");
    host.replaceChildren(...values.map(value=>{
      const button=node("button","archive-sector",value==="all"?"전체":value);
      button.type="button";button.dataset.value=value;
      button.setAttribute("aria-pressed",String(state.sector===value));
      button.classList.toggle("selected",state.sector===value);
      button.addEventListener("click",()=>{
        if(value===state.sector)return;
        state.sector=value;state.page=1;refresh();
      });
      return button;
    }));
    $("archiveSort").value=state.sort;
    for(const [view,id] of [["list","archiveListButton"],["grid","archiveGridButton"]]){
      $(id).setAttribute("aria-pressed",String(state.view===view));
      $(id).classList.toggle("selected",state.view===view);
    }
    // Grid/list layout is switched by FLIP in refresh() after measurement.
  }
  function makeCard(item){
    const link=node("a","archive-report");
    const demo=mode==="demo";
    link.href=demo?"#reader-demo-"+item.index:"#post-"+item.id;
    link.dataset.motionKey=demo?"demo-"+item.index:"public-"+item.id;
    const cap=node("span","archive-report-number",demo?String(item.index+1).padStart(2,"0"):"SFC / PUBLICATION");
    const body=node("div","archive-report-copy");
    // The DEMO state and report type are one adjacent, immediately visible label.
    // Keep the research discipline (e.g. EQUITY RESEARCH) instead of replacing it with SAMPLE.
    const label=node("span","archive-report-label",demo?"DEMO / "+item.type.toUpperCase():
      [item.research_sector||"RESEARCH",item.research_company].filter(Boolean).join(" / "));
    if(demo&&item.category)label.setAttribute("title",item.category);
    const title=node("h3","",item.title);
    const description=node("p","",demo?item.desc:
      item.excerpt||"발행된 연구의 세부 내용을 확인해 주세요.");
    body.append(label,title,description);
    const date=node("span","archive-report-date",demo?item.date+" / SAMPLE":
      window.SFC_CMS?.dateText(item.published_at)||"PUBLISHED");
    const arrow=node("span","archive-report-arrow","↗");arrow.setAttribute("aria-hidden","true");
    link.append(cap,body,date,arrow);
    if(demo)link.addEventListener("click",event=>{
      if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey)return;
      event.preventDefault();openDemo?.(item.index);
    });
    return link;
  }
  function paint(rows,count){
    total=count;
    const pages=Math.max(1,Math.ceil(total/limit));
    if(state.page>pages){state.page=pages;refresh();return;}
    const children=rows.map(makeCard);
    if(!children.length){
      const empty=node("div","archive-empty");
      empty.append(node("strong","","조건에 맞는 연구가 없습니다."),
        node("p","","검색어나 산업 필터를 조정해 보세요."));
      const reset=node("button","","검색 초기화 ↗");reset.type="button";reset.addEventListener("click",clear);
      empty.append(reset);children.push(empty);
    }
    // One keyed reconciliation engine for forward, reverse and 1↔1 swaps.
    window.SFC_MOTION.reconcile(results,children,{reuse:"equal",exit:false});
    window.SFC_V28?.firstList(results,".archive-report",4);
    $("archiveCount").textContent=(mode==="demo"?"SAMPLE / ":"PUBLISHED / ")+total+" REPORT"+(total===1?"":"S");
    $("archivePage").textContent=state.page+" / "+pages;
    $("archivePrev").disabled=state.page===1;
    $("archiveNext").disabled=state.page>=pages;
    pager.hidden=pages<=1;
    results.setAttribute("aria-busy","false");
  }
  function demoResults(){
    let rows=demos.filter(p=>{
      if(state.sector!=="all"&&p.category!==state.sector)return false;
      return [p.title,p.category,p.type,p.desc].join(" ").toLocaleLowerCase("ko").includes(state.search.toLocaleLowerCase("ko"));
    });
    if(state.sort==="new")rows.sort((a,b)=>b.date.localeCompare(a.date));
    if(state.sort==="old")rows.sort((a,b)=>a.date.localeCompare(b.date));
    if(state.sort==="title")rows.sort((a,b)=>a.title.localeCompare(b.title,"ko"));
    paint(rows.slice((state.page-1)*limit,state.page*limit),rows.length);
  }
  async function liveResults(){
    if(!client)return;
    const version=++requestVersion;
    results.setAttribute("aria-busy","true");
    $("archiveCount").textContent="공개 연구를 불러오는 중…";
    try{
      const now=new Date().toISOString();
      // Only metadata is transferred for archive rows; never preload full body.
      let query=client.from("cms_posts").select(
        "id,kind,title,excerpt,published_at,research_sector,research_company,research_author",
        {count:"exact"}
      ).eq("kind","research").eq("status","published").is("deleted_at",null)
        .or("scheduled_at.is.null,scheduled_at.lte."+now);
      if(state.sector!=="all")query=query.eq("research_sector",state.sector);
      const term=short(state.search);
      if(term)query=query.or(["title","excerpt","research_company","research_sector","research_author"]
        .map(key=>key+".ilike.*"+term.replace(/\s+/g,"*")+"*").join(","));
      if(state.sort==="title")query=query.order("title",{ascending:true}).order("id",{ascending:true});
      else query=query.order("published_at",{ascending:state.sort==="old"}).order("id",{ascending:true});
      const from=(state.page-1)*limit;
      const response=await query.range(from,from+limit-1);
      if(version!==requestVersion||mode!=="live")return;
      if(response.error)throw response.error;
      paint(response.data||[],Number.isFinite(response.count)?response.count:(response.data||[]).length);
    }catch(error){
      if(version!==requestVersion)return;
      results.replaceChildren();
      const alert=node("div","archive-error");
      alert.append(node("p","","리서치 조회에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요."));
      const retry=node("button","","다시 시도");retry.type="button";retry.addEventListener("click",refresh);
      alert.append(retry);results.append(alert);
      $("archiveCount").textContent="RESEARCH / UNAVAILABLE";
      pager.hidden=true;results.setAttribute("aria-busy","false");
    }
  }
  function refresh(){
    controls();persist();
    const grid=state.view==="grid";
    if(results.classList.contains("grid")!==grid){
      window.SFC_MOTION.transition(results,()=>results.classList.toggle("grid",grid),{exit:false});
    }
    if(mode==="live")void liveResults();else demoResults();
  }
  function clear(){
    state.search="";state.sector="all";state.sort="new";state.page=1;
    search.value="";refresh();search.focus({preventScroll:true});
  }
  search.addEventListener("input",()=>{
    clearTimeout(debounce);
    debounce=setTimeout(()=>{state.search=search.value.trim().slice(0,60);state.page=1;refresh();},220);
  });
  $("archiveReset").addEventListener("click",clear);
  $("archiveSort").addEventListener("change",()=>{
    state.sort=$("archiveSort").value;state.page=1;refresh();
  });
  for(const [view,id] of [["list","archiveListButton"],["grid","archiveGridButton"]])
    $(id).addEventListener("click",()=>{if(state.view!==view){state.view=view;refresh();}});
  $("archivePrev").addEventListener("click",()=>{
    if(state.page>1){state.page--;refresh();}
  });
  $("archiveNext").addEventListener("click",()=>{
    if(state.page*limit<total){state.page++;refresh();}
  });
  function activate(isLive){
    mode=isLive?"live":"demo";
    root.hidden=false;
    const legacy=document.getElementById("demoResearchBlock");
    const oldLive=document.getElementById("liveResearch");
    if(legacy)legacy.hidden=true;if(oldLive)oldLive.hidden=true;
    $("archiveMode").textContent=isLive?"OFFICIAL / PUBLISHED":"예시 자료 · 공식 발행 전";
    $("archiveDisclosure").textContent=isLive
      ?"PUBLIC RESEARCH / 각 연구의 방법·가정·한계와 원문을 확인할 수 있습니다."
      :"DEMO / 모든 제목과 날짜는 시연을 위한 예시이며 실제 SFC 연구 성과가 아닙니다.";
  }
  function startDemo(items,open){
    demos=items.map((item,index)=>({...item,index}));
    openDemo=open;
    if(mode==="live")return;
    sectors=[...new Set(demos.map(item=>item.category))];
    activate(false);refresh();
  }
  async function connect(db){
    if(!db)return;
    client=db;
    try{
      const probe=await db.from("cms_posts").select("id",{count:"exact"})
        .eq("kind","research").eq("status","published").is("deleted_at",null)
        .or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString()).limit(1);
      if(probe.error)throw probe.error;
      if(!(probe.data?.length||probe.count>0))return; // no publications: sample stays explicitly labelled
      const response=await db.from("cms_posts").select("research_sector")
        .eq("kind","research").eq("status","published").is("deleted_at",null)
        .or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString()).limit(400);
      if(response.error)throw response.error;
      sectors=[...new Set((response.data||[]).map(x=>x.research_sector).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
      state.page=1;
      activate(true);refresh();
    }catch(error){
      // Keep an honest sample fallback; do not misrepresent a failed live query.
      $("archiveDisclosure").textContent="DEMO / 공개 연구 연결 확인에 실패했습니다. 아래 내용은 시연 자료입니다.";
    }
  }
  window.SFC_PLATFORM=Object.freeze({startDemo,connect,refresh,get mode(){return mode;},get state(){return {...state};}});
})();
