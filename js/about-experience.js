"use strict";
/* SFC v2.4 — planned education experience, shown as a conceptual journey. */
(function(){
  const root=document.getElementById("experienceLayout");
  if(!root)return;
  const tabs=[...root.querySelectorAll('[role="tab"][data-experience-step]')];
  const panel=document.getElementById("experiencePanel");
  const kicker=document.getElementById("experienceKicker");
  const heading=document.getElementById("experienceHeading");
  const copy=document.getElementById("experienceCopy");
  const outcome=document.getElementById("experienceOutcome");
  const counter=document.getElementById("experienceCounter");
  const next=document.getElementById("experienceNext");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const stages=[
    {kicker:"01 / OBSERVE",heading:"이 기업은 어떻게 가치를 만들까?",
     lines:["제품과 고객, 산업 구조를 살피며 재무 데이터 이전에","기업의 사업을 이해하는 질문부터 시작합니다."],
     outcome:"사업모델과 산업 구조 이해"},
    {kicker:"02 / ANALYZE",heading:"재무 수치는 무엇을 설명할까?",
     lines:["재무제표와 현금흐름의 연결을 확인하고,","수익성 변화가 발생한 이유를 분석하는 과정을 연습합니다."],
     outcome:"재무 흐름과 핵심 위험요인 파악"},
    {kicker:"03 / VALUE",heading:"가정이 바뀌면 가치는 어떻게 달라질까?",
     lines:["비교기업과 현금흐름 가정의 적절성을 따지며,","다양한 가치평가 결과를 검증합니다."],
     outcome:"근거를 설명할 수 있는 평가 과정"},
    {kicker:"04 / DEFEND",heading:"분석을 다른 사람에게 설득할 수 있을까?",
     lines:["팀별 토론과 발표를 통해 가정과 한계를 검토하고,","분석 결과를 하나의 리포트로 정리하는 것을 목표로 합니다."],
     outcome:"연구 결과를 정리하고 설명하는 경험"}
  ];
  let current=0,animation=null;
  function select(index,focus=false){
    if(index<0||index>=stages.length||index===current)return;
    current=index;
    const stage=stages[index];
    tabs.forEach((button,i)=>{
      const active=i===index;
      button.classList.toggle("selected",active);
      button.setAttribute("aria-selected",String(active));
      button.tabIndex=active?0:-1;
    });
    panel.setAttribute("aria-labelledby",tabs[index].id);
    kicker.textContent=stage.kicker;
    heading.textContent=stage.heading;
    copy.replaceChildren(...stage.lines.flatMap((text,i)=>{
      const span=document.createElement("span");
      span.className="about-line";
      span.textContent=text+(i<stage.lines.length-1?" ":"");
      return [span];
    }));
    outcome.textContent=stage.outcome;
    counter.textContent=String(index+1).padStart(2,"0")+" / 04";
    next.textContent=index===stages.length-1?"BACK TO START ↗":"NEXT STEP ↗";
    root.querySelectorAll("[data-experience-visual]").forEach(group=>{
      const shown=Number(group.dataset.experienceVisual)===index;
      group.classList.toggle("active",shown);
      group.setAttribute("aria-hidden",String(!shown));
    });
    animation?.cancel();animation=null;
    if(!reduced.matches&&panel.animate){
      animation=panel.querySelector(".experience-description").animate(
        [{opacity:.78},{opacity:1}],
        {duration:230,easing:"cubic-bezier(.22,1,.36,1)"}
      );
    }
    window.SFC_V28?.stage(index);
    if(focus)tabs[index].focus({preventScroll:true});
  }
  tabs.forEach((button,i)=>{
    button.addEventListener("click",()=>select(i));
    button.addEventListener("keydown",event=>{
      let nextIndex;
      if(event.key==="ArrowRight"||event.key==="ArrowDown")nextIndex=(i+1)%tabs.length;
      else if(event.key==="ArrowLeft"||event.key==="ArrowUp")nextIndex=(i+tabs.length-1)%tabs.length;
      else if(event.key==="Home")nextIndex=0;
      else if(event.key==="End")nextIndex=tabs.length-1;
      else return;
      event.preventDefault();
      select(nextIndex,true);
    });
  });
  next.addEventListener("click",()=>select((current+1)%stages.length));
})();
