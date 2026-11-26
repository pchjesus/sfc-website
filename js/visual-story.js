"use strict";
/* SFC v2.5: one stage selection state, no duplicate activity controls. */
(function(){
  const motion=window.SFC_MOTION;
  const stageMeta={
    all:{label:"전체 학습 과정",detail:"기초 역량을 쌓고, 기업분석을 연습한 뒤, 팀별 연구로 연결되는 학기 운영 계획입니다.",sequence:"01 — 15"},
    foundation:{label:"기초교육",detail:"재무제표와 가치평가 방법의 언어를 익히는 단계입니다.",sequence:"01 — 04"},
    application:{label:"기업분석 실습",detail:"실제 공시와 사례를 읽고 기업별 판단의 근거를 토론합니다.",sequence:"05 — 12"},
    research:{label:"최종 연구",detail:"선택한 기업의 분석 내용을 리포트와 발표로 정리하는 것을 목표로 합니다.",sequence:"13 — 15"}
  };
  const tabs=document.getElementById("scheduleTabs");
  const heading=document.getElementById("journeyCurrent");
  const detail=document.getElementById("journeyDescription");
  const range=document.getElementById("journeyRange");
  const progress=document.getElementById("journeyProgress");
  let selected="all";
  function renderStages(){
    if(!tabs||!heading)return;
    const button=tabs.querySelector('[aria-pressed="true"]');
    const next=button?.dataset.value||"all";
    if(selected===next&&heading.textContent===stageMeta[next].label)return;
    selected=next;
    const data=stageMeta[selected]||stageMeta.all;
    heading.textContent=data.label;
    detail.textContent=data.detail;
    range.textContent="W"+data.sequence;
    progress.style.setProperty("--journey-progress",next==="foundation"?"27%":next==="application"?"78%":"100%");
    progress.dataset.stage=next;
    const current=document.getElementById("journeyContext");
    current?.animate&&!motion.reduced()&&current.animate([
      {opacity:.20,offset:0},
      {opacity:.72,offset:.65},
      {opacity:1,offset:1}
    ],{duration:560,easing:"cubic-bezier(.40,0,.20,1)",fill:"backwards"});
  }
  if(tabs){
    const observer=new MutationObserver(records=>{
      if(records.some(x=>x.attributeName==="aria-pressed"||x.type==="childList"))renderStages();
    });
    observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:["aria-pressed"],childList:true});
    renderStages();
  }

  // Slide-specific analysis diagrams: appear only when the user selects a step.
  const experience=document.getElementById("experienceLayout");
  if(experience){
    const visuals=experience.querySelector(".experience-visual");
    const sync=()=>{
      const selected=experience.querySelector('[role="tab"][aria-selected="true"]');
      if(visuals)visuals.dataset.phase=selected?.dataset.experienceStep||"0";
    };
    const observer=new MutationObserver(sync);
    observer.observe(experience,{subtree:true,attributes:true,attributeFilter:["aria-selected"]});
    sync();
  }

  // Recruitment track reflects the declared recruitment period; stages are
  // states, not a claim that a particular applicant completed a step.
  const recruitStatus=document.getElementById("recruitStatus");
  const track=document.getElementById("recruitmentStatusTrack");
  if(recruitStatus&&track){
    const sync=()=>{
      const state=recruitStatus.dataset.status||"planned";
      track.dataset.state=state;
      track.querySelectorAll("[data-recruit-state]").forEach(node=>{
        const current=node.dataset.recruitState===state;
        node.classList.toggle("current",current);
        node.setAttribute("aria-current",current?"step":"false");
      });
      const label=document.getElementById("recruitmentNextStep");
      if(label)label.textContent=state==="open"
        ?"모집 공고의 제출 방법과 마감 일정을 확인해 주세요."
        :state==="closed"?"이번 모집은 종료됐습니다. 공개된 자료는 계속 열람할 수 있습니다."
        :"모집 일정과 지원 방법은 공식 공고에서 확정됩니다.";
    };
    const observer=new MutationObserver(sync);
    observer.observe(recruitStatus,{attributes:true,attributeFilter:["data-status"]});
    sync();
  }
})();
