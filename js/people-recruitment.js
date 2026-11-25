"use strict";
/* SFC v2.6.5 — people and recruitment preview.
 * Static data and public CMS records share a single information hierarchy.
 * Never imply demo roles or selection stages are real person/applicant progress.
 */
(function(){
  const $=id=>document.getElementById(id);
  const motion=window.SFC_MOTION;
  const roleRoot=$("roleList");
  const graph=$("peopleGraph");
  const safe=(v,fallback="")=>String(v==null?fallback:v);
  const plan=[
    {id:"president",primary:"President",role:"회장 · 운영 총괄",caption:"ORGANIZATION",desc:"학회 운영을 총괄하고, 정기 세션과 운영 일정, 지도교수 및 학과와의 소통을 관리하는 역할입니다."},
    {id:"research",primary:"Head of Research",role:"리서치장 · 연구·교육",caption:"RESEARCH",desc:"기초교육을 기획하고, 기업분석 사례를 선정하며, 연구보고서 검토와 피드백을 담당하는 역할입니다."},
    {id:"operations",primary:"Operations",role:"총무·대외 · 운영 지원",caption:"COORDINATION",desc:"세션 일정과 출결 등 운영 실무를 담당하고, 홍보와 대외협력 활동을 지원하는 역할입니다."}
  ];
  let people=plan,live=false,selected="president",transition=null;
  function normalize(list){
    const incoming=Array.isArray(list)?list:[];
    if(!incoming.length)return plan;
    return incoming.filter(x=>x&&x.visible!==false).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)).map((p,i)=>({
      id:safe(p.id,"member-"+i),primary:safe(p.name,"등록된 구성원"),
      role:[p.position,p.term].filter(Boolean).join(" · ")||"SFC 구성원",
      caption:"OFFICIAL MEMBER",desc:safe(p.bio,"소개는 추후 공개됩니다.")
    }));
  }
  function paintDetails(animate=true){
    const current=people.find(p=>p.id===selected)||people[0];if(!current)return;
    const panel=$("peopleSpotlight");
    const content=panel?.querySelector(".people-spotlight-main");
    transition?.cancel();
    $("peopleSpotlightKind").textContent=(live?"OFFICIAL MEMBER":"PLANNED ROLE")+" / "+current.caption;
    $("peopleSpotlightCounter").textContent=String(people.indexOf(current)+1).padStart(2,"0")+" / "+String(people.length).padStart(2,"0");
    $("peopleSpotlightTitle").textContent=current.primary;
    $("peopleSpotlightSubtitle").textContent=current.role;
    $("peopleSpotlightDescription").textContent=current.desc;
    if(animate&&!motion?.reduced()&&content){
      transition=content.animate([
        {opacity:.58,transform:"translateY(7px)"},
        {opacity:1,transform:"translateY(0)"}
      ],{duration:320,easing:"cubic-bezier(.22,1,.36,1)"});
    }
    roleRoot?.querySelectorAll(".team-node").forEach((button,index)=>{
      const isActive=button.dataset.key===selected;
      button.setAttribute("aria-pressed",String(isActive));
      button.tabIndex=isActive?0:-1;
      button.classList.toggle("selected",isActive);
      if(isActive)graph?.style.setProperty("--selected-node",String(index));
    });
  }
  function select(key,{focus=false}={}){
    if(!people.some(x=>x.id===key))return;
    const changed=selected!==key;
    selected=key;paintDetails(changed);
    if(focus)roleRoot?.querySelector(".team-node.selected")?.focus({preventScroll:true});
  }
  function keydown(event){
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key))return;
    event.preventDefault();
    const current=Math.max(0,people.findIndex(p=>p.id===selected));
    const index=event.key==="Home"?0:event.key==="End"?people.length-1:
      (current+(event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1)+people.length)%people.length;
    select(people[index].id,{focus:true});
  }
  function renderNodes(){
    if(!roleRoot)return;
    const previous=document.activeElement?.closest(".team-node")?.dataset.key;
    roleRoot.replaceChildren(...people.map((p,index)=>{
      const button=document.createElement("button");
      button.type="button";button.className="team-node";
      button.dataset.key=p.id;
      button.setAttribute("aria-controls","peopleSpotlight");
      button.setAttribute("aria-pressed","false");
      button.tabIndex=-1;
      const indexNode=document.createElement("span");indexNode.className="team-node-index";
      indexNode.textContent=String(index+1).padStart(2,"0")+" / "+p.caption;
      const title=document.createElement("strong");title.textContent=p.primary;
      const caption=document.createElement("small");caption.textContent=p.role;
      const arrow=document.createElement("span");arrow.className="team-node-arrow";arrow.textContent="↗";
      arrow.setAttribute("aria-hidden","true");
      button.append(indexNode,title,caption,arrow);
      button.addEventListener("click",()=>select(p.id));
      button.addEventListener("keydown",keydown);
      return button;
    }));
    roleRoot.dataset.peopleMode=live?"live":"planned";
    graph?.classList.toggle("has-live-people",live);
    $("peopleIntro").textContent=live
      ?"SFC의 실제 등록된 구성원을 소개합니다. 각 인물을 선택하면 역할과 활동 내용을 확인할 수 있습니다."
      :"연구와 운영이 연결되는 SFC의 역할 구조를 소개합니다. 실제 구성원 정보는 공식 등록 이후 공개됩니다.";
    $("peopleDisclaimer").textContent=live
      ?"OFFICIAL PEOPLE / 등록된 공개 프로필을 기준으로 표시합니다."
      :"POSITION STRUCTURE / 현재는 운영 기획상 역할을 보여주는 시안이며 실제 운영진 프로필이 아닙니다.";
    if(!people.some(p=>p.id===selected))selected=people[0]?.id;
    paintDetails(false);
    if(previous&&people.some(p=>p.id===previous))roleRoot.querySelector(".team-node.selected")?.focus({preventScroll:true});
  }
  function setPeople(records){
    live=Array.isArray(records)&&records.some(x=>x&&x.visible!==false);
    people=normalize(records);
    if(!live)people=plan;
    renderNodes();
  }
  setPeople([]);

  const steps=[
    {code:"NOTICE",name:"모집 공고",desc:"지원 자격, 모집 일정, 선발 절차와 제출 방법을 공식 공고에서 확인합니다."},
    {code:"APPLICATION",name:"지원서",desc:"공식 양식이 공개되면 요청된 서류와 제출 방법을 확인합니다. 제출 완료 여부는 이 페이지에서 추적하지 않습니다."},
    {code:"DISCUSSION",name:"면접",desc:"면접이 진행되는 경우 지원 동기와 연구 활동에 대한 관심을 함께 나눕니다. 실제 실시 여부와 방식은 공식 공고가 우선합니다."},
    {code:"WELCOME",name:"첫 세션",desc:"최종 합류한 구성원을 대상으로 학기 활동과 연구 방식에 대한 안내를 진행할 계획입니다."}
  ];
  const stepsRoot=$("recruitmentProcess");
  let activeStep=0,stepTransition=null;
  function setStep(i,focus=false){
    if(!stepsRoot||i<0||i>=steps.length)return;
    const previous=activeStep;activeStep=i;
    stepsRoot.querySelectorAll("[data-process-step]").forEach(b=>{
      const active=Number(b.dataset.processStep)===i;
      b.classList.toggle("selected",active);
      b.setAttribute("aria-pressed",String(active));b.tabIndex=active?0:-1;
    });
    const info=steps[i],panel=$("processDetail");
    $("processDetailNumber").textContent=String(i+1).padStart(2,"0")+" / "+info.code;
    $("processDetailTitle").textContent=info.name;
    $("processDetailDescription").textContent=info.desc;
    stepTransition?.cancel();
    if(previous!==i&&!motion?.reduced()){
      stepTransition=panel?.animate([{opacity:.65,transform:"translateY(6px)"},{opacity:1,transform:"none"}],
        {duration:300,easing:"cubic-bezier(.22,1,.36,1)"});
    }
    if(focus)stepsRoot.querySelector('[data-process-step="'+i+'"]')?.focus({preventScroll:true});
  }
  if(stepsRoot){
    stepsRoot.querySelectorAll("[data-process-step]").forEach(button=>{
      button.addEventListener("click",()=>setStep(Number(button.dataset.processStep)));
      button.addEventListener("keydown",event=>{
        if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
        event.preventDefault();
        const n=event.key==="Home"?0:event.key==="End"?steps.length-1:
          (activeStep+(event.key==="ArrowLeft"?-1:1)+steps.length)%steps.length;
        setStep(n,true);
      });
    });
    setStep(0);
  }

  const trigger=$("applicationTrigger");
  const action=$("recruitActionCard");
  let ctaMode="activities";
  const actionTexts={
    planned:{
      title:"모집 일정을 준비하고 있습니다.",
      desc:"현재 공개된 활동 내용을 살펴보고, 지원 일정과 방법은 공식 공고에서 확인해 주세요.",
      tag:"NEXT STEP / GET TO KNOW SFC",
      button:"EXPLORE ACTIVITIES"
    },
    open:{
      title:"함께 연구할 구성원을 모집합니다.",
      desc:"지원 대상과 마감 안내를 확인한 뒤 공식 지원서를 내려받아 제출해 주세요.",
      tag:"NEXT STEP / APPLICATION",
      button:"VIEW APPLICATION"
    },
    closed:{
      title:"이번 모집은 종료되었습니다.",
      desc:"모집은 마감되었지만 학회 활동과 공개된 연구 자료는 계속 확인할 수 있습니다.",
      tag:"NEXT STEP / STAY CONNECTED",
      button:"EXPLORE RESEARCH"
    }
  };
  let supportButton=null;
  function syncRecruitment(){
    if(!trigger||!action)return;
    const state=["planned","open","closed"].includes($("recruitStatus")?.dataset.status)
      ?$("recruitStatus").dataset.status:"planned";
    const pdf=$("applicationDownload");
    const docx=$("applicationDocxDownload");
    const hasPdf=Boolean(pdf&&!pdf.hidden&&pdf.getAttribute("href"));
    const hasDocx=Boolean(docx&&!docx.hidden&&docx.getAttribute("href"));
    const hasForm=hasPdf||hasDocx;
    const info=actionTexts[state];
    action.dataset.state=state;
    $("recruitActionEyebrow").textContent=info.tag;
    $("recruitActionTitle").textContent=info.title;
    $("recruitActionDescription").textContent=info.desc;
    ctaMode=state==="open"?(hasForm?"form":"instructions"):
      state==="closed"?"research":"activities";
    let label=info.button;
    if(state==="open"&&!hasForm)label="CHECK APPLICATION METHOD";
    trigger.dataset.action=ctaMode;
    trigger.firstChild.textContent=label+" ";
    const availability=$("applicationAvailability");
    availability.textContent=hasPdf
      ?"PDF 양식 열람 가능"+(hasDocx?" · DOCX 제공":"")
      :hasDocx?"DOCX 양식 다운로드 가능"
      :"공식 지원서 파일은 아직 등록되지 않았습니다.";
    if(!supportButton){
      supportButton=document.createElement("button");
      supportButton.type="button";supportButton.id="recruitSecondaryTrigger";
      supportButton.className="recruit-secondary-trigger";
      supportButton.textContent="공개된 지원서 자료 확인 ↗";
      action.querySelector(".recruit-action-copy")?.append(supportButton);
      supportButton.addEventListener("click",()=>{
        const pdf=$("applicationDownload"),doc=$("applicationDocxDownload");
        const exists=Boolean((pdf&&!pdf.hidden&&pdf.getAttribute("href"))||
          (doc&&!doc.hidden&&doc.getAttribute("href")));
        if(exists)window.SFC_PUBLIC?.openApplicationDialog?.();
      });
    }
    supportButton.hidden=!hasForm||(state==="open"&&ctaMode==="form");
  }
  trigger?.addEventListener("click",event=>{
    if(ctaMode==="form")return; // Existing CMS handler opens the safe PDF/DOCX dialog.
    event.preventDefault();event.stopImmediatePropagation();
    if(ctaMode==="instructions"){
      const target=!$("recruitInstructionsPublic")?.hidden?$("recruitInstructionsPublic"):$("recruitMethodPublic");
      target?.scrollIntoView({behavior:motion?.reduced()?"instant":"smooth",block:"center"});
      return;
    }
    window.navigate?.(ctaMode==="research"?"research":"activities");
  },true);
  syncRecruitment();
  window.SFC_PEOPLE_RECRUITMENT=Object.freeze({setPeople,syncRecruitment,selectRole:select,setStep});
})();
