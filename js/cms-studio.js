"use strict";
(function(){
  const $=id=>document.getElementById(id);
  const util=()=>window.SFC_STUDIO;
  const cms=window.SFC_CMS;
  const state={site:{},recruitment:{},people:[],sessions:[],admins:[]};
  let generation=0;
  const session=()=>{const g=generation,owner=util().getUser()?.id;return ()=>Boolean(owner)&&g===generation&&util().getUser()?.id===owner;};
  // Never overwrite unsubmitted structured CMS input with asynchronous reads.
  const dirtyForms={site:false,recruitment:false,people:false,sessions:false};
  const busyForms={site:false,recruitment:false,people:false,sessions:false};
  const settingVersions={site:null,recruitment:null};
  const formIds={site:"siteForm",recruitment:"recruitForm",people:"peopleForm",sessions:"sessionForm"};
  function lockForm(key,locked){
    busyForms[key]=locked;
    const form=document.getElementById(formIds[key]);
    form.inert=locked;
    form.setAttribute("aria-busy",String(locked));
  }
  for(const [key,id] of Object.entries(formIds)){
    const form=document.getElementById(id);
    form.addEventListener("input",()=>{if(!busyForms[key])dirtyForms[key]=true;});
    form.addEventListener("change",()=>{if(!busyForms[key])dirtyForms[key]=true;});
  }
  window.addEventListener("beforeunload",event=>{
    if(Object.values(dirtyForms).some(Boolean)){
      event.preventDefault();event.returnValue="";
    }
  });
  const n=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  };
  const safe=(url)=>cms.safeUrl(url)||"";
  const client=()=>util().getClient();
  const toast=(message,error)=>util().notify(message,error);
  async function queryAll(table){
    const {data,error}=await client().from(table).select("*").order("created_at",{ascending:true}).limit(300);
    if(error)throw error;return data||[];
  }
  function textVal(id){return $(id).value.trim();}
  function formToIso(value){
    if(!value)return null;
    const dt=new Date(value);
    if(Number.isNaN(dt.getTime()))throw Error("날짜 형식이 올바르지 않습니다.");
    return dt.toISOString();
  }
  function isoToForm(value){
    if(!value)return "";
    const dt=new Date(value);
    if(Number.isNaN(dt.getTime()))return "";
    const pad=n=>String(n).padStart(2,"0");
    return [dt.getFullYear(),pad(dt.getMonth()+1),pad(dt.getDate())].join("-")+"T"+pad(dt.getHours())+":"+pad(dt.getMinutes());
  }
  function buttonBusy(button,state){button.disabled=state;}
  function allowDiscard(key){
    if(busyForms[key])return false;
    if(!dirtyForms[key])return true;
    return confirm("저장하지 않은 입력 내용이 있습니다. 다른 항목으로 이동하면 내용이 사라집니다. 계속할까요?");
  }
  const settingReadTickets={site:0,recruitment:0};
  async function fetchSettings(pane){
    if(!(pane in settingReadTickets))return;
    const active=session();if(!active())return;
    const ticket=++settingReadTickets[pane];
    // Read only the pane being displayed. A Recruitment read must never
    // advance Site's version while its old inputs are still on screen.
    const {data,error}=await client().from("cms_site_settings")
      .select("key,value,updated_at").eq("key",pane).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("설정 데이터를 찾을 수 없습니다. 관리자에게 문의해 주세요.");
    if(!active()||ticket!==settingReadTickets[pane]||dirtyForms[pane]||busyForms[pane])return;
    // The form and the optimistic-concurrency token are updated as one snapshot.
    state[pane]=data.value||{};
    settingVersions[pane]=data.updated_at||null;
    if(pane==="site")fillSite();
    else fillRecruitment();
  }
  function previewRows(target,rows){
    $(target).replaceChildren(...rows.map(([label,value])=>{const item=n("div","");item.append(n("small","",label),n("p","",value||"미입력 · 공개 기본값 또는 미표시"));return item;}));
  }
  function previewSite(){previewRows("sitePreview",[
    ["HERO",textVal("siteHeroDescription")],["ABOUT 제목",textVal("siteAboutHeading")],["ABOUT 소개",textVal("siteAboutBody")],
    ["운영 안내",textVal("siteProgramNote")],["공개 연락처",textVal("siteContactEmail")]
  ]);}
  function previewRecruitment(){
    const start=$("recruitStart").value,end=$("recruitEnd").value;
    const warning=start&&end&&start>=end?"모집 마감은 시작 시각보다 나중이어야 합니다.":"";
    $("recruitDateWarning").hidden=!warning;$("recruitDateWarning").textContent=warning;
    const fileState=(id,key)=>$(id).files[0]?"선택됨 (저장 전): "+$(id).files[0].name:safe(state.recruitment?.[key])?"등록됨":"미등록";
    const status={planned:"모집 예정",open:"모집 중",closed:"모집 마감"}[$("recruitStatus").value];
    previewRows("recruitPreview",[["모집 상태",status],["제목",textVal("recruitTitle")],["안내",textVal("recruitMessage")],
      ["일정 (현지 시간)",(start||"미정")+" ~ "+(end||"미정")],["대상 / 인원 / 시간",[textVal("recruitAudience"),textVal("recruitCapacity"),textVal("recruitMeeting")].filter(Boolean).join(" · ")],["지원 방법 및 안내",[textVal("recruitMethod"),textVal("recruitInstructions")].filter(Boolean).join("\n")],["공통 양식", "PDF: "+fileState("recruitPdf","pdf_url")+" / DOCX: "+fileState("recruitDocx","docx_url")],["공개 준비",warning||($("recruitStatus").value==="open"&&!textVal("recruitMethod")?"모집 중: 지원 방법을 입력했는지 확인하세요.":"저장 전 문구와 파일 공개 승인 여부를 확인하세요.")]]);
  }
  for(const [id,fn] of [["siteForm",previewSite],["recruitForm",previewRecruitment]]){
    $(id).addEventListener("input",fn);$(id).addEventListener("change",fn);
  }
  function fillSite(){
    const v=state.site;
    for(const [id,key] of [
      ["siteHeroDescription","hero_description"],["siteAboutHeading","about_heading"],
      ["siteAboutBody","about_body"],["siteProgramNote","program_note"],
      ["siteContactEmail","contact_email"]
    ])$(id).value=v?.[key]||"";
    previewSite();
  }
  function fillRecruitment(){
    const v=state.recruitment;
    for(const [id,key] of [
      ["recruitTitle","title"],["recruitMessage","message"],
      ["recruitAudience","audience"],["recruitCapacity","capacity"],
      ["recruitMeeting","meeting"],["recruitMethod","method"],
      ["recruitInstructions","instructions"]
    ])$(id).value=v?.[key]||"";
    $("recruitStatus").value=v?.status||"planned";
    $("recruitStart").value=isoToForm(v?.start_at);
    $("recruitEnd").value=isoToForm(v?.end_at);
    for(const [id,key] of [["currentRecruitPdf","pdf_url"],["currentRecruitDocx","docx_url"]]){
      const url=safe(v?.[key]);
      $(id).hidden=!url;
      if(url)$(id).href=url;else $(id).removeAttribute("href");
    }
    previewRecruitment();
  }
  async function persistSetting(key,value,active){
    if(!active())return false;
    // Both records are seeded by SQL migration. Saving with an unknown
    // version would bypass conflict checking and silently replace an unseen
    // record after a failed initial read.
    if(!settingVersions[key])throw new Error("설정의 최신 버전을 읽지 못했습니다. 새로고침한 뒤 다시 저장해 주세요.");
    const updated_at=new Date().toISOString();
    const request=client().from("cms_site_settings").update({value,updated_at})
      .eq("key",key).eq("updated_at",settingVersions[key])
      .select("key,value,updated_at").maybeSingle();
    const {data,error}=await request;
    if(!active())return false;
    if(error)throw error;
    if(!data)throw new Error("다른 관리자가 먼저 수정한 설정입니다. 입력 내용은 유지됩니다. 복사한 뒤 페이지를 새로고침해 최신 상태를 확인하세요.");
    state[key]=data.value||{};
    settingVersions[key]=data.updated_at||updated_at;
    dirtyForms[key]=false;return true;
  }
  $("siteForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('button[type="submit"]');
    const active=session();if(!active()||busyForms.site)return;
    const data={
      hero_description:textVal("siteHeroDescription"),
      about_heading:textVal("siteAboutHeading"),
      about_body:textVal("siteAboutBody"),
      program_note:textVal("siteProgramNote"),
      contact_email:textVal("siteContactEmail")
    };
    if(data.contact_email&&(!$("siteContactEmail").checkValidity()))
      return toast("이메일 주소를 확인해 주세요.",true);
    buttonBusy(button,true);lockForm("site",true);
    try{if(!await persistSetting("site",data,active)||!active())return;toast("홈페이지 문구를 저장했습니다. 공개 페이지에서 반영됩니다.");}
    catch(e){if(active())toast("저장 실패: "+e.message,true);}
    finally{if(active()){lockForm("site",false);buttonBusy(button,false);}}
  });
  $("recruitForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const active=session();if(!active()||busyForms.recruitment)return;
    const button=event.currentTarget.querySelector('button[type="submit"]');
    buttonBusy(button,true);lockForm("recruitment",true);
    try{
      const start_at=formToIso(textVal("recruitStart")),end_at=formToIso(textVal("recruitEnd"));
      if(start_at&&end_at&&new Date(start_at)>=new Date(end_at))throw Error("모집 마감은 시작 시각보다 나중이어야 합니다.");
      const data={
        status:$("recruitStatus").value,title:textVal("recruitTitle"),
        message:textVal("recruitMessage"),audience:textVal("recruitAudience"),
        capacity:textVal("recruitCapacity"),meeting:textVal("recruitMeeting"),
        method:textVal("recruitMethod"),instructions:textVal("recruitInstructions"),
        start_at,end_at,pdf_url:safe(state.recruitment?.pdf_url),docx_url:safe(state.recruitment?.docx_url)
      };
      const pdfFile=$("recruitPdf").files[0],docxFile=$("recruitDocx").files[0];
      const pdf=await util().upload(pdfFile,"pdf");if(!active())return;
      const docx=await util().upload(docxFile,"docx");if(!active())return;
      if(pdf)data.pdf_url=pdf;
      if(docx)data.docx_url=docx;
      if(!await persistSetting("recruitment",data,active)||!active())return;
      $("recruitPdf").value="";$("recruitDocx").value="";
      fillRecruitment();
      toast("모집 설정과 지원서 파일을 저장했습니다.");
    }catch(e){if(active())toast("모집 설정 저장 실패: "+(e.message||e),true);}
    finally{if(active()){lockForm("recruitment",false);buttonBusy(button,false);}}
  });
  function clearPerson(force=false){
    if(!force&&!allowDiscard("people"))return;
    $("personId").value="";$("personName").value="";$("personPosition").value="";
    $("personTerm").value="";$("personBio").value="";$("personOrder").value="0";$("personVisible").checked=true;
    dirtyForms.people=false;
  }
  function editPerson(item){
    if(!allowDiscard("people"))return;
    $("personId").value=item.id;$("personName").value=item.name;
    $("personPosition").value=item.position||"";$("personTerm").value=item.term||"";
    $("personBio").value=item.bio||"";$("personOrder").value=String(item.sort_order||0);
    $("personVisible").checked=item.visible;
    dirtyForms.people=false;
  }
  function matchesText(query,values){return !query||values.some(v=>String(v||"").toLocaleLowerCase("ko-KR").includes(query));}
  function matchesVisibility(value,record){return !value||(value==="public"&&record.visible)||(value==="private"&&!record.visible);}
  function filterSummary(rows,filtered){const visible=rows.filter(v=>v.visible).length;return "전체 "+rows.length+" · 공개 "+visible+" · 비공개 "+(rows.length-visible)+" · 표시 "+filtered.length+(rows.length>=300?" (최근 조회 최대 300개)":"");}
  function renderPeople(){
    const list=$("peopleList");list.replaceChildren();
    const query=textVal("peopleSearch").toLocaleLowerCase("ko-KR"),visibility=$("peopleVisibility").value;
    const filtered=state.people.filter(p=>matchesVisibility(visibility,p)&&matchesText(query,[p.name,p.position,p.term]));
    $("peopleSummary").textContent=filterSummary(state.people,filtered);
    if(!filtered.length)list.append(n("p","sidebar-empty",state.people.length?"검색 조건에 맞는 인물이 없습니다.":"등록된 인물이 없어요. 실제 운영진부터 추가해 주세요."));
    for(const p of filtered.sort((a,b)=>a.sort_order-b.sort_order)){
      const row=n("div","studio-record");const info=n("div","");
      info.append(n("strong","",p.name+" · "+(p.position||"직책 미지정")),
        n("small","",(p.term||"")+" / "+(p.visible?"공개":"비공개")));
      const controls=n("div","studio-record-actions");
      const edit=n("button","","편집");edit.type="button";edit.addEventListener("click",()=>editPerson(p));
      const del=n("button","","삭제");del.type="button";del.addEventListener("click",async()=>{
        const active=session();if(!active()||!allowDiscard("people")||!confirm(p.name+" 님의 프로필을 삭제할까요?"))return;
        del.disabled=true;lockForm("people",true);
        try{
          const {error}=await client().from("cms_people").delete().eq("id",p.id);
          if(!active())return;if(error)throw error;
          await loadPeople();if(!active())return;clearPerson(true);
          toast("인물 정보를 삭제했습니다.");
        }catch(error){if(active())toast("삭제 실패: "+(error.message||error),true);}
        finally{if(active()){lockForm("people",false);del.disabled=false;}}
      });
      controls.append(edit,del);row.append(info,controls);list.append(row);
    }
  }
  async function loadPeople(){
    const active=session();if(!active())return;const rows=await queryAll("cms_people");if(!active())return;state.people=rows;renderPeople();
  }
  $("newPerson").addEventListener("click",()=>clearPerson());
  $("peopleForm").addEventListener("submit",async event=>{
    event.preventDefault();const active=session();if(!active()||busyForms.people)return;
    const save=event.currentTarget.querySelector('button[type="submit"]');
    const id=textVal("personId");
    const payload={name:textVal("personName"),position:textVal("personPosition"),
      term:textVal("personTerm"),bio:textVal("personBio"),
      sort_order:Number($("personOrder").value)||0,visible:$("personVisible").checked};
    if(!payload.name)return toast("성명을 입력해 주세요.",true);
    buttonBusy(save,true);lockForm("people",true);
    try{
      let result;
      if(id)result=await client().from("cms_people").update(payload).eq("id",id);
      else result=await client().from("cms_people").insert(payload);
      if(!active())return;if(result.error)throw result.error;
      await loadPeople();if(!active())return;clearPerson(true);toast("People 정보가 저장되었습니다.");
    }catch(e){if(active())toast("저장 실패: "+e.message,true);}
    finally{if(active()){lockForm("people",false);buttonBusy(save,false);}}
  });
  function clearSession(force=false){
    if(!force&&!allowDiscard("sessions"))return;
    $("sessionId").value="";$("sessionWeek").value="";$("sessionTitle").value="";
    $("sessionSummary").value="";$("sessionDetail").value="";$("sessionStage").value="foundation";
    $("sessionOrder").value="0";$("sessionVisible").checked=true;
    dirtyForms.sessions=false;
  }
  function editSession(s){
    if(!allowDiscard("sessions"))return;
    $("sessionId").value=s.id;$("sessionWeek").value=s.week_label;
    $("sessionTitle").value=s.title;$("sessionSummary").value=s.summary||"";
    $("sessionDetail").value=s.detail||"";$("sessionStage").value=s.stage;
    $("sessionOrder").value=String(s.sort_order||0);$("sessionVisible").checked=s.visible;
    dirtyForms.sessions=false;
  }
  function renderSessions(){
    const list=$("sessionsList");list.replaceChildren();
    const query=textVal("sessionSearch").toLocaleLowerCase("ko-KR"),visibility=$("sessionVisibility").value,stage=$("sessionFilterStage").value;
    const filtered=state.sessions.filter(s=>matchesVisibility(visibility,s)&&(!stage||s.stage===stage)&&matchesText(query,[s.week_label,s.title,s.summary]));
    $("sessionSummaryCount").textContent=filterSummary(state.sessions,filtered);
    if(!filtered.length)list.append(n("p","sidebar-empty",state.sessions.length?"검색 조건에 맞는 교육과정이 없습니다.":"아직 등록된 교육과정이 없어요. 이전 기획안은 샘플로 남아 있어요."));
    for(const s of filtered.sort((a,b)=>a.sort_order-b.sort_order)){
      const row=n("div","studio-record"),info=n("div","");
      info.append(n("strong","",s.week_label+" · "+s.title),
        n("small","",s.stage+" / "+(s.visible?"공개":"비공개")));
      const controls=n("div","studio-record-actions");
      const edit=n("button","","편집");edit.type="button";edit.addEventListener("click",()=>editSession(s));
      const del=n("button","","삭제");del.type="button";del.addEventListener("click",async()=>{
        const active=session();if(!active()||!allowDiscard("sessions")||!confirm(s.title+" 과정을 삭제할까요?"))return;
        del.disabled=true;lockForm("sessions",true);
        try{
          const {error}=await client().from("cms_sessions").delete().eq("id",s.id);
          if(!active())return;if(error)throw error;
          await loadSessions();if(!active())return;clearSession(true);
          toast("교육과정을 삭제했습니다.");
        }catch(error){if(active())toast("삭제 실패: "+(error.message||error),true);}
        finally{if(active()){lockForm("sessions",false);del.disabled=false;}}
      });
      controls.append(edit,del);row.append(info,controls);list.append(row);
    }
  }
  async function loadSessions(){const active=session();if(!active())return;const rows=await queryAll("cms_sessions");if(!active())return;state.sessions=rows;renderSessions();}
  $("newSession").addEventListener("click",()=>clearSession());
  $("sessionForm").addEventListener("submit",async event=>{
    event.preventDefault();const active=session();if(!active()||busyForms.sessions)return;
    const save=event.currentTarget.querySelector('button[type="submit"]');
    const id=textVal("sessionId");
    const payload={week_label:textVal("sessionWeek"),title:textVal("sessionTitle"),
      summary:textVal("sessionSummary"),detail:textVal("sessionDetail"),
      stage:$("sessionStage").value,sort_order:Number($("sessionOrder").value)||0,
      visible:$("sessionVisible").checked};
    if(!payload.week_label||!payload.title)return toast("주차와 제목을 입력해 주세요.",true);
    buttonBusy(save,true);lockForm("sessions",true);
    try{
      const result=id
        ? await client().from("cms_sessions").update(payload).eq("id",id)
        : await client().from("cms_sessions").insert(payload);
      if(!active())return;if(result.error)throw result.error;
      await loadSessions();if(!active())return;clearSession(true);toast("Activities 프로그램이 저장되었습니다.");
    }catch(e){if(active())toast("저장 실패: "+e.message,true);}
    finally{if(active()){lockForm("sessions",false);buttonBusy(save,false);}}
  });
  $("peopleSearch").addEventListener("input",renderPeople);$("peopleVisibility").addEventListener("change",renderPeople);
  $("sessionSearch").addEventListener("input",renderSessions);["sessionVisibility","sessionFilterStage"].forEach(id=>$(id).addEventListener("change",renderSessions));
  async function loadAdmins(){
    const active=session();if(!active())return;
    const {data,error}=await client().from("cms_admins").select("user_id,email,created_at").order("created_at",{ascending:true});
    if(!active())return;if(error)throw error;
    state.admins=data||[];renderAdmins();
  }
  function renderAdmins(){
    const list=$("memberList");list.replaceChildren();
    $("superadminCount").textContent=state.admins.length+" / 3";
    $("memberAddButton").disabled=state.admins.length>=3;
    $("memberCapacityNote").textContent=state.admins.length>=3?"관리자 정원이 찼습니다. 기존 권한을 해제한 뒤 추가할 수 있습니다.":"남은 운영 관리자 자리: "+(3-state.admins.length)+"명 · 개발자는 별도";
    for(const a of state.admins){
      const isSelf=util().getUser()?.id===a.user_id;
      const row=n("div","studio-member-row"),info=n("div","studio-member-identity");
      info.append(n("strong","",(a.email||a.user_id)+(isSelf?" · 현재 계정":"")),
        n("small","",cms.dateText(a.created_at)+" 등록"));
      const btn=n("button","","권한 해제");btn.type="button";btn.className="secondary";
      btn.disabled=isSelf||state.admins.length<=1;
      btn.addEventListener("click",async()=>{
        const active=session();if(!active()||!confirm(a.email+" 계정의 SFC 운영 권한을 해제할까요?"))return;
        btn.disabled=true;
        const {error}=await client().from("cms_admins").delete().eq("user_id",a.user_id);
        if(!active())return;if(error)toast("권한 해제 실패: "+error.message,true);
        else{await loadAdmins();if(!active())return;toast("최고관리자 권한을 해제했습니다. 기존 Supabase Auth 계정은 유지됩니다.");}
        btn.disabled=false;
      });
      row.append(info,btn);list.append(row);
    }
    if(!state.admins.length)list.append(n("p","sidebar-empty","최초 최고관리자 계정 등록이 필요합니다."));
  }
  $("memberAddForm").addEventListener("submit",async event=>{
    event.preventDefault();const active=session();if(!active()||$("memberAddButton").disabled)return;
    if(state.admins.length>=3)return toast("최고관리자는 최대 3명입니다.",true);
    const email=textVal("memberEmail").toLowerCase();
    if(!util().getUser())return;
    if(state.admins.some(a=>String(a.email||"").toLowerCase()===email))return toast("이미 등록된 운영 관리자입니다.",true);
    if(util().getRole()==="developer"&&email===String(util().getUser()?.email||"").toLowerCase())return toast("개발자는 운영 관리자 정원과 별도입니다.",true);
    const button=$("memberAddButton");buttonBusy(button,true);
    try{
      const {error}=await client().from("cms_admins").insert({email});
      if(!active())return;if(error)throw error;
      $("memberEmail").value="";await loadAdmins();if(!active())return;
      toast("최고관리자가 추가되었습니다. 해당 계정은 다음 로그인부터 관리할 수 있습니다.");
    }catch(e){if(active())toast("추가 실패: "+e.message+". Auth에 등록된 이메일인지 확인해 주세요.",true);}
    finally{if(active())buttonBusy(button,state.admins.length>=3);}
  });
  async function readBackupTable(table,active){
    const rows=[];
    for(let start=0;start<10000;start+=1000){
      if(!active())throw Error("세션 변경");
      const {data,error}=await client().from(table).select("*").order(table==="cms_site_settings"?"key":table==="cms_admins"?"user_id":"id").range(start,start+999);
      if(!active())throw Error("세션 변경");if(error)throw error;
      rows.push(...(data||[]));
      if((data||[]).length<1000)return rows;
    }
    throw Error(table+" 데이터가 10,000행을 초과합니다. 불완전한 백업 방지를 위해 중단했어요.");
  }
  $("exportData").addEventListener("click",async()=>{
    const active=session();if(!active())return;
    const button=$("exportData");buttonBusy(button,true);
    try{
      const tables=["cms_posts","cms_post_revisions","cms_site_settings","cms_people","cms_sessions","cms_admins"];
      const data={};
      for(const table of tables)data[table]=await readBackupTable(table,active);
      if(!active())return;
      const sealed=await window.SFC_BACKUP.seal(data);if(!active())return;
      const json=JSON.stringify(sealed,null,2);
      if(new TextEncoder().encode(json).length>window.SFC_BACKUP.maxBytes)throw Error("백업 20MiB 한도를 초과했습니다.");
      const blob=new Blob([json],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;link.download="sfc-content-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10_000);
      toast("데이터 백업 파일이 준비됐습니다. 관리자 전용 안전한 위치에 보관하세요.");
    }catch(e){if(active())toast("백업 실패: "+(e.message||e),true);}
    finally{if(active())buttonBusy(button,false);}
  });
  let backupSequence=0;
  function clearInspection(){backupSequence++;$("backupInspection").replaceChildren();$("inspectBackup").disabled=false;}
  $("inspectBackupFile").addEventListener("change",clearInspection);
  $("inspectBackup").addEventListener("click",async()=>{
    const active=session(),file=$("inspectBackupFile").files[0];if(!active()||$("inspectBackup").disabled)return;
    clearInspection();const seq=backupSequence;
    const valid=()=>active()&&seq===backupSequence;
    if(!file||file.size>window.SFC_BACKUP.maxBytes){$("backupInspection").textContent="20MiB 이하의 백업 JSON을 선택하세요.";return;}
    $("inspectBackup").disabled=true;$("backupInspection").textContent="이 기기에서 검사 중";
    try{
      const result=await window.SFC_BACKUP.inspect(await file.text());if(!valid())return;
      const host=$("backupInspection");host.replaceChildren(n("p","",result.ok?"형식 검사 통과 · 실제 복원 검증 아님":"백업 형식 검사 실패"),n("p","","체크섬: "+result.checksum));
      for(const [table,count] of Object.entries(result.counts))host.append(n("p","",table+" · "+count+"행"));
      for(const msg of result.errors)host.append(n("p","","오류: "+msg));
      for(const msg of result.warnings)host.append(n("p","","경고: "+msg));
    }catch(_){if(valid())$("backupInspection").textContent="백업 파일을 읽거나 검사하지 못했습니다.";}
    finally{if(valid())$("inspectBackup").disabled=false;}
  });
  let diagnosticSequence=0,lastDiagnostic=null;
  async function developerDiagnostic(){
    if(util().getRole()!=="developer")return;
    const started=++diagnosticSequence,owner=util().getUser()?.id;
    const active=()=>started===diagnosticSequence&&util().getRole()==="developer"&&util().getUser()?.id===owner;
    lastDiagnostic=null;$("devExport").disabled=true;$("devConnection").textContent="조회 중";$("devRefresh").disabled=true;
    $("devCounts").querySelectorAll("dd").forEach(e=>e.textContent="—");
    try{
      const queries=[client().from("cms_posts").select("id",{count:"exact",head:true}),client().from("cms_posts").select("id",{count:"exact",head:true}).eq("status","draft"),client().from("cms_admins").select("user_id",{count:"exact",head:true}),client().from("cms_people").select("id",{count:"exact",head:true}),client().from("cms_sessions").select("id",{count:"exact",head:true}),client().from("cms_site_settings").select("key",{count:"exact",head:true})];
      const results=await Promise.all(queries);
      if(!active())return;
      if(results.some(v=>v.error||typeof v.count!=="number")){const error=Error("일부 조회 요청이 실패했습니다.");error.failed=results.map((v,i)=>v.error||typeof v.count!=="number"?i:-1).filter(i=>i>=0);throw error;}
      const values=[results[0].count,results[1].count,results[2].count+" / 3",results[3].count+" / "+results[4].count,results[5].count];
      $("devCounts").querySelectorAll("dd").forEach((e,i)=>e.textContent=String(values[i]));
      $("devConnection").textContent="조회 성공";
      $("devAuth").textContent="현재 세션: Developer · 서버 회원 조회 확인";
      lastDiagnostic={format:"sfc-diagnostic-v1",checked_at:new Date().toISOString(),role:"developer",build:"readiness-c",deployed_sha:null,query_status:"success",counts:{all_posts:results[0].count,draft_status:results[1].count,operational_admins:results[2].count,people:results[3].count,activities:results[4].count,settings:results[5].count}};$("devExport").disabled=false;
    }catch(e){if(active()){$("devConnection").textContent="조회 실패";$("devAuth").textContent="조회 상태를 확인할 수 없습니다." + (e.failed?" · 실패 요청 "+e.failed.length+"건":"");lastDiagnostic={format:"sfc-diagnostic-v1",checked_at:new Date().toISOString(),role:"developer",build:"readiness-c",deployed_sha:null,query_status:"failed",failed_queries:e.failed||null};$("devExport").disabled=false;}}
    finally{if(active()){$("devRefresh").disabled=false;$("devChecked").textContent="최근 진단: "+new Date().toLocaleString("ko-KR");}}
  }
  $("devRefresh").addEventListener("click",developerDiagnostic);
  $("devExport").addEventListener("click",()=>{
    if(util().getRole()!=="developer"||!lastDiagnostic)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(lastDiagnostic,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="sfc-diagnostic-"+new Date().toISOString().slice(0,10)+".json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("devGoAccounts").addEventListener("click",()=>{if(util().getRole()==="developer")util().showPane("access");});
  window.addEventListener("sfc:admin-cleared",()=>{
    generation++;diagnosticSequence++;lastDiagnostic=null;clearInspection();$("inspectBackupFile").value="";
    state.site={};state.recruitment={};state.people=[];state.sessions=[];state.admins=[];
    for(const [key,id] of Object.entries(formIds)){
      settingVersions[key]=null;dirtyForms[key]=false;lockForm(key,false);$(id).reset();
      $(id).querySelectorAll("button[type=submit]").forEach(b=>b.disabled=false);
    }
    settingReadTickets.site++;settingReadTickets.recruitment++;
    fillSite();fillRecruitment();clearPerson(true);clearSession(true);
    for(const id of ["peopleList","sessionsList","memberList"])$(id).replaceChildren();
    for(const id of ["peopleSearch","peopleVisibility","sessionSearch","sessionVisibility","sessionFilterStage","memberEmail"])$(id).value="";
    for(const id of ["peopleSummary","sessionSummaryCount","memberCapacityNote"])$(id).textContent="조회 전";
    $("superadminCount").textContent="— / 3";$("memberAddButton").disabled=false;$("exportData").disabled=false;
    $("devRefresh").disabled=false;$("devExport").disabled=true;
  });
  async function openPane(pane){
    const active=session();if(!active())return;
    try{
      if(pane==="site"||pane==="recruitment")await fetchSettings(pane);
      if(pane==="people")await loadPeople();
      if(pane==="sessions")await loadSessions();
      if(pane==="access")await loadAdmins();
      if(pane==="developer")await developerDiagnostic();
    }catch(e){if(active())toast("데이터를 불러오지 못했습니다: "+(e.message||e),true);}
  }
  window.SFC_STUDIO_FORMS=Object.freeze({hasUnsaved:()=>Object.values(dirtyForms).some(Boolean),hasPendingWrite:()=>Object.values(busyForms).some(Boolean)});
  window.addEventListener("sfc:pane",e=>openPane(e.detail.pane));
})();
