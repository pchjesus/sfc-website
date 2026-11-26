"use strict";
(function(){
  const $=id=>document.getElementById(id);
  const util=()=>window.SFC_STUDIO;
  const cms=window.SFC_CMS;
  const state={site:{},recruitment:{},people:[],sessions:[],admins:[]};
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
  async function fetchSettings(pane){
    const {data,error}=await client().from("cms_site_settings").select("key,value,updated_at");
    if(error)throw error;
    for(const row of data||[]){
      if(!(row.key in dirtyForms)||dirtyForms[row.key]||busyForms[row.key])continue;
      state[row.key]=row.value||{};
      settingVersions[row.key]=row.updated_at||null;
    }
    if(pane==="site"&&!dirtyForms.site&&!busyForms.site)fillSite();
    if(pane==="recruitment"&&!dirtyForms.recruitment&&!busyForms.recruitment)fillRecruitment();
  }
  function fillSite(){
    const v=state.site;
    for(const [id,key] of [
      ["siteHeroDescription","hero_description"],["siteAboutHeading","about_heading"],
      ["siteAboutBody","about_body"],["siteProgramNote","program_note"],
      ["siteContactEmail","contact_email"]
    ])$(id).value=v?.[key]||"";
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
  }
  async function persistSetting(key,value){
    const updated_at=new Date().toISOString();
    const request=settingVersions[key]
      ? client().from("cms_site_settings").update({value,updated_at})
          .eq("key",key).eq("updated_at",settingVersions[key])
          .select("key,value,updated_at").maybeSingle()
      : client().from("cms_site_settings")
          .upsert({key,value,updated_at},{onConflict:"key"})
          .select("key,value,updated_at").single();
    const {data,error}=await request;
    if(error)throw error;
    if(!data)throw new Error("다른 관리자가 먼저 수정한 설정입니다. 입력 내용은 유지됩니다. 복사한 뒤 페이지를 새로고침해 최신 상태를 확인하세요.");
    state[key]=data.value||{};
    settingVersions[key]=data.updated_at||updated_at;
    dirtyForms[key]=false;
  }
  $("siteForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('button[type="submit"]');
    if(!client())return;
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
    try{await persistSetting("site",data);toast("홈페이지 문구를 저장했습니다. 공개 페이지에서 반영됩니다.");}
    catch(e){toast("저장 실패: "+e.message,true);}
    finally{lockForm("site",false);buttonBusy(button,false);}
  });
  $("recruitForm").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!client())return;
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
      const pdf=await util().upload($("recruitPdf").files[0],"pdf");
      const docx=await util().upload($("recruitDocx").files[0],"docx");
      if(pdf)data.pdf_url=pdf;
      if(docx)data.docx_url=docx;
      await persistSetting("recruitment",data);
      $("recruitPdf").value="";$("recruitDocx").value="";
      fillRecruitment();
      toast("모집 설정과 지원서 파일을 저장했습니다.");
    }catch(e){toast("모집 설정 저장 실패: "+(e.message||e),true);}
    finally{lockForm("recruitment",false);buttonBusy(button,false);}
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
  function renderPeople(){
    const list=$("peopleList");list.replaceChildren();
    if(!state.people.length)list.append(n("p","sidebar-empty","등록된 인물이 없어요. 실제 운영진부터 추가해 주세요."));
    for(const p of [...state.people].sort((a,b)=>a.sort_order-b.sort_order)){
      const row=n("div","studio-record");const info=n("div","");
      info.append(n("strong","",p.name+" · "+(p.position||"직책 미지정")),
        n("small","",(p.term||"")+" / "+(p.visible?"공개":"비공개")));
      const controls=n("div","studio-record-actions");
      const edit=n("button","","편집");edit.type="button";edit.addEventListener("click",()=>editPerson(p));
      const del=n("button","","삭제");del.type="button";del.addEventListener("click",async()=>{
        if(!allowDiscard("people")||!confirm(p.name+" 님의 프로필을 삭제할까요?"))return;
        del.disabled=true;
        const {error}=await client().from("cms_people").delete().eq("id",p.id);
        if(error)toast("삭제 실패: "+error.message,true);
        else{await loadPeople();clearPerson(true);toast("인물 정보를 삭제했습니다.");}
        del.disabled=false;
      });
      controls.append(edit,del);row.append(info,controls);list.append(row);
    }
  }
  async function loadPeople(){
    state.people=await queryAll("cms_people");renderPeople();
  }
  $("newPerson").addEventListener("click",()=>clearPerson());
  $("peopleForm").addEventListener("submit",async event=>{
    event.preventDefault();
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
      if(result.error)throw result.error;
      await loadPeople();clearPerson(true);toast("People 정보가 저장되었습니다.");
    }catch(e){toast("저장 실패: "+e.message,true);}
    finally{lockForm("people",false);buttonBusy(save,false);}
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
    if(!state.sessions.length)list.append(n("p","sidebar-empty","아직 등록된 교육과정이 없어요. 이전 기획안은 샘플로 남아 있어요."));
    for(const s of [...state.sessions].sort((a,b)=>a.sort_order-b.sort_order)){
      const row=n("div","studio-record"),info=n("div","");
      info.append(n("strong","",s.week_label+" · "+s.title),
        n("small","",s.stage+" / "+(s.visible?"공개":"비공개")));
      const controls=n("div","studio-record-actions");
      const edit=n("button","","편집");edit.type="button";edit.addEventListener("click",()=>editSession(s));
      const del=n("button","","삭제");del.type="button";del.addEventListener("click",async()=>{
        if(!allowDiscard("sessions")||!confirm(s.title+" 과정을 삭제할까요?"))return;
        del.disabled=true;
        const {error}=await client().from("cms_sessions").delete().eq("id",s.id);
        if(error)toast("삭제 실패: "+error.message,true);
        else{await loadSessions();clearSession(true);toast("교육과정을 삭제했습니다.");}
        del.disabled=false;
      });
      controls.append(edit,del);row.append(info,controls);list.append(row);
    }
  }
  async function loadSessions(){state.sessions=await queryAll("cms_sessions");renderSessions();}
  $("newSession").addEventListener("click",()=>clearSession());
  $("sessionForm").addEventListener("submit",async event=>{
    event.preventDefault();
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
      if(result.error)throw result.error;
      await loadSessions();clearSession(true);toast("Activities 프로그램이 저장되었습니다.");
    }catch(e){toast("저장 실패: "+e.message,true);}
    finally{lockForm("sessions",false);buttonBusy(save,false);}
  });
  async function loadAdmins(){
    const {data,error}=await client().from("cms_admins").select("user_id,email,created_at").order("created_at",{ascending:true});
    if(error)throw error;
    state.admins=data||[];renderAdmins();
  }
  function renderAdmins(){
    const list=$("memberList");list.replaceChildren();
    $("superadminCount").textContent=state.admins.length+" / 3";
    $("memberAddButton").disabled=state.admins.length>=3;
    for(const a of state.admins){
      const isSelf=util().getUser()?.id===a.user_id;
      const row=n("div","studio-member-row"),info=n("div","studio-member-identity");
      info.append(n("strong","",(a.email||a.user_id)+(isSelf?" · 현재 계정":"")),
        n("small","",cms.dateText(a.created_at)+" 등록"));
      const btn=n("button","","권한 해제");btn.type="button";btn.className="secondary";
      btn.disabled=isSelf||state.admins.length<=1;
      btn.addEventListener("click",async()=>{
        if(!confirm(a.email+" 계정의 SFC 운영 권한을 해제할까요?"))return;
        btn.disabled=true;
        const {error}=await client().from("cms_admins").delete().eq("user_id",a.user_id);
        if(error)toast("권한 해제 실패: "+error.message,true);
        else{await loadAdmins();toast("최고관리자 권한을 해제했습니다. 기존 Supabase Auth 계정은 유지됩니다.");}
        btn.disabled=false;
      });
      row.append(info,btn);list.append(row);
    }
    if(!state.admins.length)list.append(n("p","sidebar-empty","최초 최고관리자 계정 등록이 필요합니다."));
  }
  $("memberAddForm").addEventListener("submit",async event=>{
    event.preventDefault();
    if(state.admins.length>=3)return toast("최고관리자는 최대 3명입니다.",true);
    const email=textVal("memberEmail").toLowerCase();
    const button=$("memberAddButton");buttonBusy(button,true);
    try{
      const {error}=await client().from("cms_admins").insert({email});
      if(error)throw error;
      $("memberEmail").value="";await loadAdmins();
      toast("최고관리자가 추가되었습니다. 해당 계정은 다음 로그인부터 관리할 수 있습니다.");
    }catch(e){toast("추가 실패: "+e.message+". Auth에 등록된 이메일인지 확인해 주세요.",true);}
    finally{buttonBusy(button,state.admins.length>=3);}
  });
  async function readBackupTable(table){
    const rows=[];
    for(let start=0;start<10000;start+=1000){
      const {data,error}=await client().from(table).select("*").order(table==="cms_site_settings"?"key":table==="cms_admins"?"user_id":"id").range(start,start+999);
      if(error)throw error;
      rows.push(...(data||[]));
      if((data||[]).length<1000)return rows;
    }
    throw Error(table+" 데이터가 10,000행을 초과합니다. 불완전한 백업 방지를 위해 중단했어요.");
  }
  $("exportData").addEventListener("click",async()=>{
    if(!util().getUser())return;
    const button=$("exportData");buttonBusy(button,true);
    try{
      const tables=["cms_posts","cms_post_revisions","cms_site_settings","cms_people","cms_sessions","cms_admins"];
      const data={format:"sfc-cms-export-v1",exported_at:new Date().toISOString(),project:"sfc-website",tables:{}};
      for(const table of tables)data.tables[table]=await readBackupTable(table);
      const json=JSON.stringify(data,null,2);
      const blob=new Blob([json],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;link.download="sfc-content-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10_000);
      toast("데이터 백업 파일이 준비됐습니다. 관리자 전용 안전한 위치에 보관하세요.");
    }catch(e){toast("백업 실패: "+(e.message||e),true);}
    finally{buttonBusy(button,false);}
  });
  async function openPane(pane){
    try{
      if(pane==="site"||pane==="recruitment")await fetchSettings(pane);
      if(pane==="people")await loadPeople();
      if(pane==="sessions")await loadSessions();
      if(pane==="access")await loadAdmins();
    }catch(e){toast("데이터를 불러오지 못했습니다: "+(e.message||e),true);}
  }
  window.addEventListener("sfc:pane",e=>openPane(e.detail.pane));
})();
