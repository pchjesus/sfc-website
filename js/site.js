"use strict";
document.documentElement.classList.add("js");
const $=id=>document.getElementById(id);
const pages=["home","about","research","activities","people","recruitment"];
const navLabels=["HOME","ABOUT","RESEARCH","ACTIVITIES","PEOPLE","RECRUITMENT"];
const nav=$("navLinks");
pages.forEach((name,i)=>{
  const button=document.createElement("button");
  button.type="button";
  button.textContent=navLabels[i];
  button.dataset.page=name;
  button.addEventListener("click",()=>navigate(name));
  nav.appendChild(button);
});
function closeMenu(){
  nav.classList.remove("open");
  $("scrim").classList.remove("open");
  $("menuToggle").setAttribute("aria-expanded","false");
  $("menuToggle").textContent="☰";
  document.body.style.overflow="";
}
function toggleMenu(){
  const opened=nav.classList.toggle("open");
  $("scrim").classList.toggle("open",opened);
  $("menuToggle").setAttribute("aria-expanded",String(opened));
  $("menuToggle").textContent=opened?"×":"☰";
  document.body.style.overflow=opened?"hidden":"";
}
function navigate(route){
  if(location.hash.slice(1)!==route)history.pushState({route},"","#"+route);
  renderRoute();
}
function renderRoute(){
  const route=decodeURIComponent(location.hash.slice(1)||"home");
  let target=route;
  const reportMatch=/^report-(\d+)$/.exec(route);
  if(reportMatch){
    const index=Number(reportMatch[1]);
    if(reports[index]){fillReport(index);target="detail";}else target="research";
  }
  if(!pages.includes(target)&&target!=="detail")target="home";
  document.querySelectorAll(".view").forEach(section=>section.classList.toggle("active",section.id===target));
  document.querySelectorAll("#navLinks button").forEach(button=>{
    const selected=button.dataset.page===(target==="detail"?"research":target);
    button.classList.toggle("active",selected);
    button.setAttribute("aria-current",selected?"page":"false");
  });
  document.title=(target==="home"?"SFC":target==="detail"?"Research":target.charAt(0).toUpperCase()+target.slice(1))+" | Sangmyung Financial Club";
  closeMenu();
  window.scrollTo({top:0,left:0,behavior:"instant"});
  revealOnScroll();
}
window.addEventListener("popstate",renderRoute);
window.addEventListener("hashchange",renderRoute);
$("menuToggle").addEventListener("click",toggleMenu);
$("scrim").addEventListener("click",closeMenu);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeMenu()});
/* Home photo slider */
const slides=[
  {heading:"See beyond<br>the numbers.",description:"기업의 숫자를 읽고, 가치의 근거를 찾다.",label:"DISCOVER SFC",route:"about",color:"#ed7857"},
  {heading:"Research<br>with purpose.",description:"실제 기업을 분석하고, 가설을 검증합니다.",label:"EXPLORE RESEARCH",route:"research",color:"#bfdcf0"},
  {heading:"Ideas become<br>insight.",description:"배움을 실전으로 연결하는 15주의 여정.",label:"OUR ACTIVITIES",route:"activities",color:"#e9e1a5"}
];
let currentSlide=0,heroInterval=null,slideSwitchTimeout=null;
function setSlide(index){
  if(index===currentSlide)return;
  currentSlide=index;
  const entry=slides[index],copy=$("heroCopy");
  copy.classList.add("switching");
  document.querySelectorAll(".hero-photo").forEach((photo,i)=>photo.classList.toggle("active",i===index));
  document.querySelectorAll(".hero-controls button").forEach((button,i)=>{
    button.classList.toggle("active",i===index);
    button.setAttribute("aria-pressed",String(i===index));
  });
  clearTimeout(slideSwitchTimeout);
  slideSwitchTimeout=setTimeout(()=>{
    $("heroNumber").textContent="SFC / 00"+(index+1);
    $("heroNumber").style.color=entry.color;
    $("heroHeading").innerHTML=entry.heading;
    $("heroDescription").textContent=entry.description;
    $("heroButton").firstChild.textContent=entry.label+" ";
    $("heroButton").style.backgroundColor=entry.color;
    $("heroButton").dataset.route=entry.route;
    copy.classList.remove("switching");
  },230);
  resetSlideshow();
}
function resetSlideshow(){
  clearInterval(heroInterval);
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches&&!document.hidden){
    heroInterval=setInterval(()=>setSlide((currentSlide+1)%slides.length),8200);
  }
}
document.querySelectorAll(".hero-controls button").forEach((button,i)=>button.addEventListener("click",()=>setSlide(i)));
$("heroButton").addEventListener("click",()=>navigate($("heroButton").dataset.route||"about"));
document.addEventListener("visibilitychange",resetSlideshow);
let touchStart=null;
$("hero").addEventListener("touchstart",event=>{touchStart=event.changedTouches[0].screenX},{passive:true});
$("hero").addEventListener("touchend",event=>{
  if(touchStart===null)return;
  const moved=event.changedTouches[0].screenX-touchStart;
  if(Math.abs(moved)>55)setSlide((currentSlide+(moved<0?1:2))%3);
  touchStart=null;
},{passive:true});
resetSlideshow();
/* All sample records are clearly marked as hypothetical. */
const reports=[
  {title:"반도체 산업의 구조적 변화와 기업가치 재평가",type:"Equity Research",category:"기업분석",date:"2027.05",desc:"산업 구조 · 현금흐름 전망 · 상대가치평가",question:"반도체 산업의 성장 가정은 기업가치에 어떻게 반영되는가?",method:"산업 분석, 재무 추정, DCF 및 상대가치평가의 연결을 검토하는 구성안입니다.",risk:"산업 사이클, 설비투자, 수익성 추정 등 핵심 가정 변화에 대한 검증 영역입니다."},
  {title:"국내 소비재 기업의 상대가치 비교",type:"Relative Valuation",category:"기업분석",date:"2027.04",desc:"PER · EV/EBITDA · 비교기업 선정",question:"서로 다른 사업구조를 가진 기업의 배수를 어떻게 비교할 수 있는가?",method:"동종기업 선정과 상대가치평가 배수의 차이를 설명하는 구성안입니다.",risk:"비교기업 선정의 편향과 이익 정상화에 관한 검증 영역입니다."},
  {title:"IPO 공모가 산정과 시장 평가의 차이",type:"IPO Case Study",category:"케이스",date:"2027.06",desc:"증권신고서 · 멀티플 · 공모가 검토",question:"기업공개 과정의 공모가 산정은 어떤 판단을 전제로 하는가?",method:"공개된 증권신고서의 산정 방식과 비교기업 선정 논리를 검토하는 구성안입니다.",risk:"시장 환경과 할인율 및 거래 가능성의 변화에 관한 검증 영역입니다."},
  {title:"현금흐름 할인모형의 주요 가정과 민감도",type:"DCF Modeling",category:"교육자료",date:"2027.04",desc:"FCFF · WACC · 잔여가치",question:"할인율과 잔여가치 가정은 기업가치를 얼마나 바꾸는가?",method:"FCFF와 WACC, 잔여가치 추정의 관계를 설명하는 교육용 목업입니다.",risk:"장기 성장률과 자본비용 변화에 따른 모델 불확실성 설명 영역입니다."}
];
/* Hypothetical report outlines for the editorial prototype: no measured results or investment ratings. */
const reportBriefs=[
  {
    deck:"반도체 산업의 변화가 기업가치의 주요 가정에 어떤 영향을 미치는지 살펴보는 리서치 구성안.",
    overview:"시장 성장 전망을 그대로 주가 전망으로 연결하지 않고, 수요·공급 구조와 기업의 현금흐름 가정을 분리하여 검토하는 것을 목표로 합니다.",
    focus:"산업 사이클 / 설비투자 / 수익성",
    steps:[
      ["Industry context","수요와 공급, 경쟁구도, 산업 사이클을 구분하여 주요 변수를 정리합니다."],
      ["Financial translation","산업 가정을 매출·이익률·투자지출·현금흐름 추정으로 연결합니다."],
      ["Valuation review","DCF와 비교기업 배수를 함께 살펴보고 가정별 민감도를 검토합니다."]
    ]
  },
  {
    deck:"서로 다른 소비재 기업의 가치평가 배수를 비교할 때 고려해야 하는 기준을 정리한 예시.",
    overview:"단순히 PER이 낮은 기업을 저평가로 판단하지 않고, 사업 포트폴리오와 성장률, 수익성 차이를 먼저 확인하는 분석 구조를 제안합니다.",
    focus:"비교기업 선정 / 수익성 / 평가배수",
    steps:[
      ["Peer selection","사업 영역, 제품군, 지역별 매출 구성을 기준으로 비교 대상의 적합성을 살핍니다."],
      ["Metric normalization","회계 및 일회성 요인 차이를 점검하고 비교 가능한 이익 지표를 검토합니다."],
      ["Multiple interpretation","PER과 EV/EBITDA 등 배수 차이를 성장률과 수익성 가정에 비추어 해석합니다."]
    ]
  },
  {
    deck:"IPO 공모가 산정 논리를 읽고 비교기업과 할인 기준을 검토하는 사례연구 구성안.",
    overview:"공모가를 사후 성과로만 판단하지 않고, 당시 증권신고서에 제시된 비교기업·이익 지표·할인 조건의 논리를 구분해 살펴봅니다.",
    focus:"증권신고서 / 공모가 / 비교기업",
    steps:[
      ["Disclosure review","증권신고서에 제시된 기업 개요와 공모가 산정 절차를 확인합니다."],
      ["Peer benchmarking","비교기업 선정 근거와 평가배수 적용 방식을 분석합니다."],
      ["Assumption check","희망 공모가 밴드와 적용 할인 조건에 반영된 전제를 검토합니다."]
    ]
  },
  {
    deck:"DCF 모형을 구성하는 할인율과 잔여가치 가정의 영향을 살펴보는 교육용 구성안.",
    overview:"한 개의 기업가치 수치보다 현금흐름의 근거와 할인율·잔여가치에 대한 판단 과정을 명확히 설명하는 데 초점을 둡니다.",
    focus:"FCFF / WACC / Terminal Value",
    steps:[
      ["Cash flow model","매출·비용·투자·운전자본 가정을 FCFF 추정으로 연결합니다."],
      ["Cost of capital","WACC의 구성 요소와 자본구조·요구수익률의 관계를 점검합니다."],
      ["Sensitivity review","할인율 및 장기성장률 변화를 통해 추정 가치의 범위를 검토합니다."]
    ]
  }
];

const categories=["전체","기업분석","케이스","교육자료"];
let filter="전체",query="",sort="featured",layout="list";
function openReport(index){navigate("report-"+index)}
function renderHomeWorks(){
  $("homeWorks").innerHTML=reports.slice(1,3).map((r,i)=>
    '<button class="work-link" type="button" data-index="'+(i+1)+'"><small>'+r.type.toUpperCase()+' / DEMO</small><strong>'+r.title+'</strong><small class="date">'+r.date+'</small><span class="row-arr" aria-hidden="true">↗</span></button>'
  ).join("");
  $("homeWorks").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>openReport(Number(button.dataset.index))));
}
function setFilter(next){filter=next;renderFilters();renderReports()}
function renderFilters(){
  $("reportFilters").innerHTML=categories.map(category=>'<button type="button" class="'+(filter===category?'selected':'')+'" aria-pressed="'+(filter===category)+'">'+category+'</button>').join("");
  $("reportFilters").querySelectorAll("button").forEach((button,i)=>button.addEventListener("click",()=>setFilter(categories[i])));
}
function setLayout(next){
  layout=next;
  $("reportResults").classList.toggle("grid",layout==="grid");
  document.querySelectorAll("[data-layout]").forEach(button=>{
    const on=button.dataset.layout===layout;
    button.classList.toggle("selected",on);
    button.setAttribute("aria-pressed",String(on));
  });
}
function renderReports(){
  let matches=reports.map((r,i)=>({...r,index:i})).filter(r=>
    (filter==="전체"||filter===r.category)&&
    (r.title+" "+r.type+" "+r.category+" "+r.desc).toLowerCase().includes(query.trim().toLowerCase())
  );
  if(sort==="new")matches.sort((a,b)=>b.date.localeCompare(a.date));
  else if(sort==="old")matches.sort((a,b)=>a.date.localeCompare(b.date));
  else if(sort==="title")matches.sort((a,b)=>a.title.localeCompare(b.title,"ko"));
  $("reportCount").textContent=matches.length+" SAMPLE REPORT"+(matches.length===1?"":"S");
  const results=$("reportResults");
  results.innerHTML=matches.length?matches.map(r=>
    '<button type="button" class="report-item" data-index="'+r.index+'">'+
      '<div class="report-cover k'+r.index+'"><small>SFC / DEMO 0'+(r.index+1)+'</small><b>'+r.type+'</b></div>'+
      '<div><span class="report-category">'+r.category+' / '+r.type.toUpperCase()+'</span><h3>'+r.title+'</h3><p>'+r.desc+'</p></div>'+
      '<time>'+r.date+' ↗</time></button>'
  ).join(""):'<div class="empty-result"><p>조건에 맞는 예시 보고서가 없습니다.</p><button type="button" id="resetReports">검색 초기화 ↗</button></div>';
  results.querySelectorAll(".report-item").forEach(button=>button.addEventListener("click",()=>openReport(Number(button.dataset.index))));
  results.querySelector("#resetReports")?.addEventListener("click",()=>{filter="전체";query="";$("searchReports").value="";renderFilters();renderReports()});
  setLayout(layout);
}
$("searchReports").addEventListener("input",event=>{query=event.target.value;renderReports()});
$("sortReports").addEventListener("change",event=>{sort=event.target.value;renderReports()});
document.querySelectorAll("[data-layout]").forEach(button=>button.addEventListener("click",()=>setLayout(button.dataset.layout)));
function fillReport(index){
  const r=reports[index];
  const brief=reportBriefs[index];
  if(!r||!brief)return;
  $("detailType").textContent=r.category+" / "+r.type.toUpperCase()+" / SAMPLE";
  $("detailTitle").textContent=r.title;
  $("detailDeck").textContent=brief.deck;
  $("detailQuestion").textContent=r.question;
  $("detailOverview").textContent=brief.overview;
  $("detailMethod").textContent=r.method;
  $("detailRisk").textContent=r.risk;
  $("detailField").textContent=r.type;
  $("detailFocus").textContent=brief.focus;
  $("detailMeta").textContent="SFC RESEARCH · "+r.date+" · DEMONSTRATION";
  $("detailSteps").replaceChildren(...brief.steps.map(([title,description],i)=>{
    const row=document.createElement("div");
    row.className="detail-step";
    const number=document.createElement("span");
    number.className="detail-step-number";
    number.textContent=String(i+1).padStart(2,"0");
    const heading=document.createElement("strong");
    heading.textContent=title;
    const body=document.createElement("p");
    body.textContent=description;
    row.append(number,heading,body);
    return row;
  }));
  const related=reports.map((item,i)=>({item,i})).filter(({i})=>i!==index).slice(0,2);
  const container=$("detailRelated");
  container.replaceChildren(...related.map(({item,i})=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="detail-related-link";
    const type=document.createElement("span");
    type.textContent=item.type.toUpperCase()+" / SAMPLE";
    const title=document.createElement("strong");
    title.textContent=item.title;
    const arrow=document.createElement("span");
    arrow.className="detail-related-arrow";
    arrow.setAttribute("aria-hidden","true");
    arrow.textContent="↗";
    button.append(type,title,arrow);
    button.addEventListener("click",()=>openReport(i));
    return button;
  }));
  $("copyReportLink").textContent="COPY SAMPLE LINK ↗";
}
let linkCopyReset;
$("copyReportLink").addEventListener("click",async ()=>{
  const button=$("copyReportLink");
  try{
    await navigator.clipboard.writeText(window.location.href);
    button.textContent="LINK COPIED ✓";
  }catch(error){
    button.textContent="LINK COPY UNAVAILABLE";
  }
  clearTimeout(linkCopyReset);
  linkCopyReset=setTimeout(()=>{button.textContent="COPY SAMPLE LINK ↗"},2400);
});
/* Planned semester */
const sessions=[
  ["01","Orientation","오리엔테이션 · 팀 구성 · 엑셀 기초","foundation","학기 목표와 세션 진행 방식을 공유하고, 팀 구성 및 기초 스프레드시트 작업을 준비합니다."],
  ["02","Financial Statements","재무제표 3표 연결 및 주요 비율","foundation","재무상태표·손익계산서·현금흐름표의 연결을 확인하고 핵심 재무비율을 해석합니다."],
  ["03","Relative Valuation","PER · PBR · EV/EBITDA","foundation","평가배수의 정의를 구분하고 적절한 비교기업을 선정할 때 고려할 조건을 학습합니다."],
  ["04","DCF Modeling","FCFF · WACC · 잔여가치와 민감도","foundation","현금흐름과 할인율을 연결해 기업가치를 계산하고 핵심 가정의 민감도를 살펴봅니다."],
  ["05–06","Case Study I","바이사이드 밸류에이션","application","공개 기업자료를 바탕으로 사업구조와 가치평가의 전제를 검토하는 사례연구를 계획합니다."],
  ["07","Research Skills","DART 공시 · 산업 분석","application","사업보고서와 공시에서 분석 근거를 찾고 산업 구조를 정리하는 과정을 연습합니다."],
  ["08","Midterm Break","중간고사 기간 · 정기 세션 휴회","application","중간고사 기간에 따른 휴회 주차로 계획되어 있으며 정기 교육 세션은 진행하지 않습니다."],
  ["09–10","Case Study II","동종업계 기업가치 비교","application","기업별 사업 구성과 수익성 차이를 고려해 비교기업 분석과 가치평가 배수를 검토합니다."],
  ["11–12","Case Study III","IPO 공모가 산정 사례","application","증권신고서의 공모가 산정 근거를 읽고 비교기업과 할인 기준의 적절성을 토론합니다."],
  ["13–14","Final Research","팀별 최종 리포트 작성","research","분석 질문을 정하고 근거 자료와 가치평가 결과를 정리해 팀별 보고서 초안을 준비합니다."],
  ["15","Final Presentation","최종 연구 발표회","research","분석 결과를 발표하고 가정·방법론·한계에 대한 질의응답을 진행하는 과정입니다."]
];
let selectedStage="all",openedSession=-1;
const stages=[["all","전체"],["foundation","기초교육"],["application","기업분석 실습"],["research","최종 연구"]];
function chooseStage(stage){selectedStage=stage;openedSession=-1;renderSchedule()}
function toggleSession(i){
  const next=openedSession===i?-1:i;
  const list=$("scheduleList");
  const previous=list.querySelector(".session.open");
  if(previous){
    previous.classList.remove("open");
    previous.querySelector("button").setAttribute("aria-expanded","false");
    previous.querySelector(".session-body").setAttribute("aria-hidden","true");
  }
  if(next!==-1){
    const active=list.querySelector('[data-session="'+i+'"]');
    if(active){
      active.classList.add("open");
      active.querySelector("button").setAttribute("aria-expanded","true");
      active.querySelector(".session-body").setAttribute("aria-hidden","false");
    }
  }
  openedSession=next;
}
function renderSchedule(){
  $("scheduleTabs").innerHTML=stages.map(([value,label])=>
    '<button type="button" data-stage="'+value+'" class="'+(selectedStage===value?'selected':'')+'" aria-pressed="'+(selectedStage===value)+'">'+label+'</button>'
  ).join("");
  $("scheduleTabs").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>chooseStage(button.dataset.stage)));
  $("scheduleList").innerHTML=sessions.map((s,i)=>({s,i})).filter(({s})=>selectedStage==="all"||s[3]===selectedStage).map(({s,i})=>
    '<div class="session" data-session="'+i+'"><button class="session-button" type="button" data-index="'+i+'" aria-controls="session-panel-'+i+'" aria-expanded="false">'+
    '<span class="week">W'+s[0]+'</span><strong>'+s[1]+'</strong><span class="summary">'+s[2]+'</span><span class="plus" aria-hidden="true">＋</span></button>'+
    '<div class="session-body" id="session-panel-'+i+'" aria-hidden="true"><div><p>'+s[4]+'</p></div></div></div>'
  ).join("");
  $("scheduleList").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>toggleSession(Number(button.dataset.index))));
}
/* Only one people section, expandable in place */
const roles=[
  ["President","회장","학회 운영 총괄, 지도교수 및 학과와의 소통, 정기 세션 관리"],
  ["Head of Research","리서치장","기초 교육, 분석 케이스 선정, 리포트 검토와 피드백"],
  ["Operations","총무·대외","출결·운영 일정, 홍보 및 대외협력 지원"]
];
let openedRole=-1;
function toggleRole(i){
  const next=openedRole===i?-1:i;
  const list=$("roleList");
  const old=list.querySelector(".role-row.open");
  if(old){
    old.classList.remove("open");
    old.querySelector("button").setAttribute("aria-expanded","false");
    old.querySelector(".role-detail").setAttribute("aria-hidden","true");
  }
  if(next!==-1){
    const active=list.querySelector('[data-role="'+i+'"]');
    if(active){
      active.classList.add("open");
      active.querySelector("button").setAttribute("aria-expanded","true");
      active.querySelector(".role-detail").setAttribute("aria-hidden","false");
    }
  }
  openedRole=next;
}
function renderRoles(){
  $("roleList").innerHTML=roles.map((r,i)=>
    '<div class="role-row" data-role="'+i+'"><button type="button" class="role-button" data-index="'+i+'" aria-controls="role-panel-'+i+'" aria-expanded="false"><span>0'+(i+1)+'</span><span class="role-title"><strong>'+r[0]+'</strong><small>'+r[1]+'</small></span><span class="role-toggle-icon" aria-hidden="true"></span></button>'+
    '<div class="role-detail" id="role-panel-'+i+'" aria-hidden="true"><div><p>'+r[2]+' (운영 기획 기준)</p></div></div></div>'
  ).join("");
  $("roleList").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>toggleRole(Number(button.dataset.index))));
}
/* Recruitment FAQ */
const faqs=[
  ["금융 관련 선행 지식이 필요한가요?","기초 교육을 포함하는 운영안이 준비되어 있습니다. 자세한 지원 자격은 모집 공고를 확인해 주세요."],
  ["활동은 어떻게 진행되나요?","주 1회 약 2시간의 정기 세션과 팀별 기업분석 실습 및 발표를 계획하고 있습니다."],
  ["언제, 어디서 지원할 수 있나요?","2027년 3월 초 모집 예정이며 지원 방법과 세부 일정은 추후 공지합니다."]
];
let openedFaq=-1;
function toggleFaq(i){
  const next=openedFaq===i?-1:i;
  const list=$("faqList");
  const old=list.querySelector(".faq.open");
  if(old){
    old.classList.remove("open");
    old.querySelector("button").setAttribute("aria-expanded","false");
    old.querySelector(".faq-answer").setAttribute("aria-hidden","true");
  }
  if(next!==-1){
    const active=list.querySelector('[data-faq="'+i+'"]');
    if(active){
      active.classList.add("open");
      active.querySelector("button").setAttribute("aria-expanded","true");
      active.querySelector(".faq-answer").setAttribute("aria-hidden","false");
    }
  }
  openedFaq=next;
}
function renderFaqs(){
  $("faqList").innerHTML=faqs.map((f,i)=>
    '<div class="faq" data-faq="'+i+'"><button type="button" data-index="'+i+'" aria-controls="faq-panel-'+i+'" aria-expanded="false">'+f[0]+' <span aria-hidden="true">＋</span></button>'+
    '<div class="faq-answer" id="faq-panel-'+i+'" aria-hidden="true"><div><p>'+f[1]+'</p></div></div></div>'
  ).join("");
  $("faqList").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>toggleFaq(Number(button.dataset.index))));
}
/* Reveal only active view's visible elements. */
let observer;
function revealOnScroll(){
  if(observer)observer.disconnect();
  const targets=document.querySelectorAll(".view.active .reveal");
  if(!("IntersectionObserver" in window)){
    targets.forEach(el=>el.classList.add("visible"));return;
  }
  observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target);}
  }),{threshold:.08});
  targets.forEach(el=>observer.observe(el));
}
renderHomeWorks();
renderFilters();
renderReports();
renderSchedule();
renderRoles();
renderFaqs();
if(!location.hash)history.replaceState({route:"home"},"","#home");
renderRoute();