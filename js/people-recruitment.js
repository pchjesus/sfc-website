"use strict";
/* SFC v2.6.5 — People and Recruitment: visible-by-default editorial content.
 * Static profile facts are NOT buttons; all biographies and process steps
 * are readable without clicks or hover. CMS visibility rules remain intact. */
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
  function normalize(records){
    const visible=Array.isArray(records)?records.filter(x=>x&&x.visible!==false):[];
    if(!visible.length)return plan;
    return [...visible].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)).map((p,i)=>({
      id:safe(p.id,"member-"+i),
      primary:safe(p.name,"등록된 구성원"),
      role:[p.position,p.term].filter(Boolean).join(" · ")||"SFC 구성원",
      caption:"OFFICIAL MEMBER",
      desc:safe(p.bio,"소개는 추후 공개됩니다.")
    }));
  }
  function element(tag,cls,text){
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  }
  function setPeople(records){
    if(!roleRoot)return;
    const live=Array.isArray(records)&&records.some(p=>p&&p.visible!==false);
    const people=normalize(records);
    roleRoot.replaceChildren(...people.map((p,i)=>{
      const article=element("article","team-node");
      article.setAttribute("role","listitem");
      article.dataset.personId=p.id;
      article.append(
        element("span","team-node-index",String(i+1).padStart(2,"0")+" / "+p.caption),
        element("h3","team-node-name",p.primary),
        element("p","team-node-role",p.role),
        element("p","team-node-description",p.desc)
      );
      return article;
    }));
    roleRoot.dataset.peopleMode=live?"live":"planned";
    window.SFC_V28?.people();
    graph?.classList.toggle("has-live-people",live);
    $("peopleIntro").textContent=live
      ?"공개된 SFC 구성원과 담당 업무를 확인할 수 있습니다."
      :"운영 · 연구 · 지원 역할과 담당 업무를 확인해 보세요. 실제 구성원 정보는 등록 후 공개됩니다.";
    $("peopleDisclaimer").textContent=live
      ?"OFFICIAL PEOPLE / 등록된 공개 프로필을 기준으로 표시합니다."
      :"POSITION STRUCTURE / 현재는 운영 기획상 역할을 보여주는 시안이며 실제 운영진 프로필이 아닙니다.";
  }
  setPeople([]);

  const trigger=$("applicationTrigger");
  const action=$("recruitActionCard");
  let ctaMode="activities";
  const actionTexts={
    planned:{
      title:"모집 전, 활동 내용을 먼저 살펴보세요.",
      desc:"15주 교육과 팀별 기업분석 계획을 확인할 수 있습니다.",
      tag:"NEXT STEP / EXPLORE THE PROGRAM",
      button:"ACTIVITIES"
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
    availability.hidden=state==="planned"&&!hasForm;
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
    window.SFC_V28?.recruitment(action);
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
  window.SFC_PEOPLE_RECRUITMENT=Object.freeze({setPeople,syncRecruitment});
})();
