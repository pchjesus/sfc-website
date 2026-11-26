"use strict";
(function(){
  const cms=window.SFC_CMS;
  const $=id=>document.getElementById(id);
  let client=null,user=null,posts=[],current=null,busy=false,dirty=false,filter="all",checking=null,recovering=false;
  let autosaveTimer=null,stashTimer=null,toastTimer=null;
  const legacyKey="sfc-editor-draft-v2", recoveryPrefix="sfc-editor-draft-v3:";
  let workId=null,epoch=0,blockedRecovery=false,pendingFiles={},previewUrl=null;
  let importCandidate=null,importRevision=0,importManual=false;
  const editorFields=["postKind","postTitle","postExcerpt","postBody","postCoverUrl","postAttachmentUrl",
   "postSchedule","researchSector","researchCompany","researchAuthor","researchMethod","researchLimitations"];
  function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function notify(message,error=false){
    const e=$("studioMessage");e.textContent=message;e.hidden=false;e.style.background=error?"#983f39":"#172d41";
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,6000);
  }
  function visible(target){
    ["studioSetup","studioLogin","studioReset","studioPanel"].forEach(id=>$(id).hidden=id!==target);
    $("studioLogout").hidden=target!=="studioPanel";
    $("studioAccount").hidden=target!=="studioPanel";
  }
  function showPane(pane){
    document.querySelectorAll("[data-pane-view]").forEach(e=>e.hidden=e.dataset.paneView!==pane);
    document.querySelectorAll("[data-pane]").forEach(e=>{
      const active=e.dataset.pane===pane;e.classList.toggle("selected",active);e.setAttribute("aria-current",active?"page":"false");
    });
    if(pane==="posts"){renderPosts();}else{window.dispatchEvent(new CustomEvent("sfc:pane",{detail:{pane}}));}
  }
  function validUrl(v){return !v||Boolean(cms.safeUrl(v));}
  function asIso(local){
    if(!local)return null;
    const dt=new Date(local);
    if(Number.isNaN(dt.getTime()))throw Error("날짜 형식을 확인해 주세요.");
    return dt.toISOString();
  }
  function toLocal(date){
    if(!date)return "";
    const dt=new Date(date);if(Number.isNaN(dt.getTime()))return "";
    const pad=n=>String(n).padStart(2,"0");
    return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate())+"T"+pad(dt.getHours())+":"+pad(dt.getMinutes());
  }
  function readPost(){
    return {
      kind:$("postKind").value,title:$("postTitle").value.trim(),
      excerpt:$("postExcerpt").value.trim(),body:$("postBody").value.trim(),
      cover_url:cms.safeUrl($("postCoverUrl").value.trim())||null,
      attachment_url:cms.safeUrl($("postAttachmentUrl").value.trim())||null,
      scheduled_at:asIso($("postSchedule").value),
      research_sector:$("researchSector").value.trim(),
      research_company:$("researchCompany").value.trim(),
      research_author:$("researchAuthor").value.trim(),
      research_method:$("researchMethod").value.trim(),
      research_limitations:$("researchLimitations").value.trim()
    };
  }
  function applyForm(item){
    $("postKind").value=item?.kind||"notice";
    $("postTitle").value=item?.title||"";
    $("postExcerpt").value=item?.excerpt||"";
    $("postBody").value=item?.body||"";
    $("postCoverUrl").value=item?.cover_url||"";
    $("postAttachmentUrl").value=item?.attachment_url||"";
    $("postSchedule").value=toLocal(item?.scheduled_at);
    for(const [name,id] of [["research_sector","researchSector"],["research_company","researchCompany"],["research_author","researchAuthor"],
      ["research_method","researchMethod"],["research_limitations","researchLimitations"]])$(id).value=item?.[name]||"";
    $("postCoverFile").value="";$("postPdfFile").value="";
    $("researchFields").hidden=$("postKind").value!=="research";
  }
  function key(id,owner=user?.id){return owner&&id?recoveryPrefix+encodeURIComponent(owner)+":"+encodeURIComponent(id):null;}
  function readScratch(id){try{return JSON.parse(sessionStorage.getItem(key(id))||"null");}catch(_){return null;}}
  function snapshots(owner=user?.id){
    if(!owner)return [];
    const prefix=recoveryPrefix+encodeURIComponent(owner)+":",rows=[];
    try{for(let i=0;i<sessionStorage.length;i++){
      const k=sessionStorage.key(i);if(!k?.startsWith(prefix))continue;
      try{const v=JSON.parse(sessionStorage.getItem(k));if(v?.userId===owner&&v.workId&&k===key(v.workId,owner)&&v.values)rows.push(v);}catch(_){}
    }}catch(_){}
    return rows.sort((a,b)=>b.savedAt-a.savedAt);
  }
  function renderRecovery(){
    const select=$("recoverySelect"),previous=select.value,rows=snapshots();
    select.replaceChildren(new Option("복구본 선택",""));
    for(const v of rows)select.append(new Option((v.values.postTitle||"제목 없는 글")+" · "+new Date(v.savedAt).toLocaleString("ko-KR"),v.workId));
    if(rows.some(v=>v.workId===previous))select.value=previous;
    $("recoveryControls").hidden=!rows.length;
  }
  function migrateLegacy(){
    try{const v=JSON.parse(sessionStorage.getItem(legacyKey)||"null");
      if(!v||v.userId!==user?.id||!v.values)return;
      const id=v.id||crypto.randomUUID(),k=key(id);
      if(!sessionStorage.getItem(k))sessionStorage.setItem(k,JSON.stringify({...v,workId:id,baseVersion:null,pendingFiles:{}}));
      sessionStorage.removeItem(legacyKey);
    }catch(_){}
  }
  function fileNames(){
    const names={...pendingFiles};
    for(const id of ["postCoverFile","postPdfFile"]){const f=$(id).files[0];if(f)names[id]=f.name;}
    return names;
  }
  function hasPending(){return Object.keys(fileNames()).length>0;}
  function pendingNotice(){
    const names=fileNames();
    $("editorFileNote").textContent=Object.keys(names).length?"선택/복구 파일: "+Object.values(names).join(", ")+" · 파일 자체는 임시저장되지 않습니다. 새로고침 후 재선택하세요.":"";
    $("discardPendingFiles").hidden=!Object.keys(names).length;
  }
  function detail(message){$("editorSaveDetail").textContent=message||"";}
  function savedTime(){return current?.updated_at?new Date(current.updated_at).toLocaleString("ko-KR"):"없음";}
  function stash(){
    if(!user||!workId||(!dirty&&!hasPending()&&!(current?.status==="draft"&&$("postSchedule").value)))return false;
    try{sessionStorage.setItem(key(workId),JSON.stringify({id:current?.id||null,workId,userId:user.id,baseVersion:current?.updated_at||null,blockedRecovery,importManual,values:Object.fromEntries(editorFields.map(id=>[id,$(id).value])),pendingFiles:fileNames(),savedAt:Date.now()}));renderRecovery();return true;}
    catch(_){detail("이 기기에 복구본을 저장하지 못했습니다. 서버 저장 또는 본문 복사를 권장합니다.");return false;}
  }
  function forget(id=workId,owner=user?.id){try{const k=key(id,owner);if(k)sessionStorage.removeItem(k);}catch(_){}renderRecovery();}
  function clearPreviewFile(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$("previewLocalPdf").hidden=true;$("previewLocalPdf").removeAttribute("href");}
  function restoreScratch(id,force=false){
    const v=readScratch(id);if(!v||v.userId!==user?.id||v.workId!==id||!v.values)return;
    if(!force&&!confirm("이전에 저장되지 않은 편집 내용이 있어요. 복구할까요? (취소해도 목록에 남습니다.)")){
      // A new editing session must never overwrite a deferred recovery.
      const fresh=crypto.randomUUID();workId=fresh;return;
    }
    if(Object.hasOwn(v.values,"postTitle"))for(const field of editorFields)$(field).value=typeof v.values[field]==="string"?v.values[field]:"";
    else applyForm(v.values);
    pendingFiles={};for(const field of ["postCoverFile","postPdfFile"])if(typeof v.pendingFiles?.[field]==="string")pendingFiles[field]=v.pendingFiles[field];
    importManual=Boolean(v.importManual);
    blockedRecovery=Boolean(v.blockedRecovery||(current&&v.baseVersion!==current.updated_at));
    $("researchFields").hidden=$("postKind").value!=="research";$("publishPost").textContent=$("postSchedule").value?"예약·게시하기 ↗":"게시하기 ↗";markChanged(false);pendingNotice();
    if(blockedRecovery){detail("복구본과 서버 버전이 다릅니다. 서버 최신본과 비교하기 전에는 저장할 수 없습니다. 내용을 복사하거나 복구 목록에서 다시 열 수 있습니다.");notify("저장 충돌: 복구본의 기준 버전이 다릅니다.",true);}
    else detail("이 기기의 복구본을 불러왔습니다. 확인 후 저장하세요.");
  }
  function updateCounts(){ $("editorCounts").textContent="제목 "+$("postTitle").value.length+"/180 · 요약 "+$("postExcerpt").value.length+"/350 · 본문 "+$("postBody").value.length.toLocaleString()+"/50,000"; }
  function markChanged(schedule=true){
    updateCounts();
    if(!user||!workId)return;
    dirty=true;$("editorSavedAt").textContent="저장되지 않은 변경사항";
    if(!blockedRecovery)detail("마지막 서버 저장: "+savedTime());
    clearTimeout(stashTimer);stashTimer=setTimeout(stash,400);
    clearTimeout(autosaveTimer);
    if(schedule!==false&&!importManual&&!blockedRecovery&&(!current||current.status==="draft"))autosaveTimer=setTimeout(()=>savePost("draft",true),2600);
  }
  function selectPost(item,confirmDirty=true,newId=null){
    if(busy&&confirmDirty)return false;
    if(confirmDirty&&(dirty||hasPending())){
      if(!confirm("저장하지 않은 변경사항이 있어요. 복구본을 보관하고 다른 글로 이동할까요?"))return false;
      if(!stash()&&!confirm("복구본을 저장하지 못했습니다. 그래도 이동할까요?"))return false;
    }
    clearTimeout(autosaveTimer);clearTimeout(stashTimer);clearPreviewFile();
    clearImportReview();importManual=false;current=item||null;workId=newId||item?.id||crypto.randomUUID();dirty=false;pendingFiles={};blockedRecovery=false;applyForm(item);pendingNotice();updateCounts();
    const trashed=Boolean(item?.deleted_at);
    $("editorMode").textContent=item?"EDIT / "+(trashed?"TRASHED":item.status.toUpperCase()):"NEW ARTICLE";
    $("editorSavedAt").textContent=item?"마지막 저장 "+cms.dateText(item.updated_at):"아직 저장되지 않음";detail("");
    $("postForm").hidden=trashed;$("previewPanel").hidden=true;$("historyPanel").hidden=true;
    $("saveDraft").hidden=Boolean(item?.status==="published");
    $("publishPost").textContent=$("postSchedule").value?"예약·게시하기 ↗":"게시하기 ↗";
    $("trashPost").hidden=!item||trashed;$("restorePost").hidden=!trashed;$("deletePost").hidden=!trashed;
    $("historyButton").hidden=!item;$("unpublishPost").hidden=!item||item.status!=="published"||trashed;
    renderPosts();renderRecovery();return true;
  }
  function newPost(){selectPost(null);}
  function openRecovery(){
    const id=$("recoverySelect").value,v=readScratch(id);if(!v)return;
    const item=posts.find(p=>p.id===(v.id||id));
    if(!item&&v.id){notify("서버 글을 먼저 확인해 주세요. 복구본은 보존됩니다.",true);return;}
    if(item?.deleted_at){notify("휴지통의 글은 먼저 복구해 주세요.",true);return;}
    if(selectPost(item||null,true,id))restoreScratch(id,true);
  }
  function discardRecovery(){
    const id=$("recoverySelect").value;if(!id||!confirm("선택한 이 기기의 복구본만 삭제할까요? 서버 글은 변경되지 않습니다."))return;
    if(id===workId&&(dirty||hasPending())){notify("현재 편집 중입니다. 다른 글로 이동한 후 복구본을 삭제하세요.",true);return;}
    forget(id);
  }
  function statusName(p){
    if(p.deleted_at)return "휴지통";
    if(p.status==="draft")return "임시글";
    if(p.scheduled_at&&new Date(p.scheduled_at).getTime()>Date.now())return "예약 발행";
    return "게시됨";
  }
  function included(p){
    if(filter==="trash")return Boolean(p.deleted_at);
    if(p.deleted_at)return false;
    if(filter==="all")return true;
    if(filter==="scheduled")return statusName(p)==="예약 발행";
    if(filter==="published")return statusName(p)==="게시됨";
    return p.status==="draft";
  }
  function renderPosts(){
    const list=$("adminPostList");list.replaceChildren();
    $("postsCount").textContent=posts.filter(p=>!p.deleted_at).length+" POSTS";
    const query=$("postSearch").value.trim().toLocaleLowerCase("ko-KR");
    const selected=posts.filter(p=>included(p)&&(!query||[p.title,p.research_author,p.research_company,p.research_sector,cms.kindNames[p.kind]].some(v=>String(v||"").toLocaleLowerCase("ko-KR").includes(query))));
    if(!selected.length){list.append(node("p","sidebar-empty","표시할 글이 없습니다."));return;}
    for(const post of selected){
      const b=node("button","admin-post-item"+(current?.id===post.id?" selected":""));
      b.type="button";
      b.append(node("small","",(cms.kindNames[post.kind]||post.kind)+" / "+statusName(post)),
        node("strong","",post.title),node("time","",cms.dateText(post.updated_at)));
      b.addEventListener("click",()=>{if(selectPost(post))restoreScratch(post.id);});
      list.append(b);
    }
  }
  async function loadPosts(){
    const owner=user?.id,started=epoch;
    const {data,error}=await client.from("cms_posts").select("*")
      .order("updated_at",{ascending:false}).limit(300);
    if(error)throw error;
    if(user?.id!==owner||epoch!==started)return;
    posts=data||[];renderPosts();
  }
  function busyMode(state){
    busy=state;["saveDraft","publishPost","trashPost","restorePost","deletePost","newPost","unpublishPost","previewButton","historyButton","recoverWork","discardRecovery","discardPendingFiles"].forEach(id=>$(id).disabled=state);
  }
  async function upload(file,type="image"){
    if(!file)return null;
    const allowed={
      image:["image/jpeg","image/png","image/webp"],
      pdf:["application/pdf"],
      docx:["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    };
    if(!allowed[type]?.includes(file.type)||file.size===0||file.size>20*1024*1024)
      throw Error("업로드 파일은 JPG/PNG/WEBP/PDF/DOCX 중 해당 형식으로 20MB 이하여야 해요.");
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp",
      "application/pdf":"pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx"}[file.type];
    const path=user.id+"/"+crypto.randomUUID()+"."+ext;
    const {error}=await client.storage.from("sfc-media").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
    if(error)throw error;
    const {data}=client.storage.from("sfc-media").getPublicUrl(path);
    const url=cms.safeUrl(data.publicUrl);
    if(!url)throw Error("업로드 주소를 확인할 수 없습니다.");
    return url;
  }
  async function savePost(status,automatic=false,unpublish=false){
    if(busy||!user||!workId||current?.deleted_at)return;
    if(status==="draft"&&current?.status==="published"&&!unpublish){if(stash())detail("공개본은 유지됩니다. 수정 내용은 이 기기에만 보관됩니다.");return;}
    if(blockedRecovery){if(!automatic)notify("복구본과 서버 버전이 다릅니다. 비교 후 새로 편집해 주세요.",true);return;}
    if(automatic&&(!dirty||current?.status==="published"))return;
    if(automatic&&importManual)return;
    if(!automatic&&status==="draft"&&!unpublish&&!dirty&&current&&!hasPending()){detail("마지막 서버 저장: "+savedTime());return;}
    clearTimeout(autosaveTimer);
    let draft;
    try{draft=readPost();}catch(e){if(!automatic)notify(e.message,true);return;}
    if(draft.title.length<3||draft.body.length===0){
      if(stash())detail("이 기기에만 저장됨 · 제목 3자 이상과 본문이 필요합니다.");
      if(!automatic)notify("제목은 최소 3자, 본문은 1자 이상 입력해야 합니다.",true);return;
    }
    if(!validUrl($("postCoverUrl").value.trim())||!validUrl($("postAttachmentUrl").value.trim())){
      if(!automatic)notify("이미지와 첨부파일 주소는 https:// URL만 허용돼요.",true);
      return;
    }
    const fingerprint=JSON.stringify(editorFields.map(id=>$(id).value));
    const imageFile=$("postCoverFile").files[0],pdfFile=$("postPdfFile").files[0],owner=user.id,started=epoch,id=workId;
    const names=fileNames();
    if(status==="published"){
      if(importManual){notify("가져온 연구 초안을 먼저 임시저장하고 검수해 주세요.",true);return;}
      if((names.postCoverFile&&!imageFile)||(names.postPdfFile&&!pdfFile)){notify("복구된 파일을 재선택하거나 첨부 선택을 취소해 주세요.",true);return;}
      if(draft.scheduled_at&&Date.parse(draft.scheduled_at)>Date.now()&&(imageFile||pdfFile||draft.cover_url||draft.attachment_url)){notify("예약 발행에 공개 파일을 미리 연결할 수 없습니다. 파일 없이 예약하거나 공개 시점에 연결하세요.",true);return;}
      if((imageFile||pdfFile||draft.cover_url||draft.attachment_url)&&!confirm("첨부파일 공개 허가를 확인했나요? 공개 URL은 게시 취소 후에도 접근 가능할 수 있습니다."))return;
    }
    const active=()=>user?.id===owner&&epoch===started&&workId===id;
    let saved=false;
    busyMode(true);stash();if(status==="published")$("postForm").inert=true;$("editorSavedAt").textContent="저장 중";detail("서버 저장 요청 중");
    try{
      if(status==="published"){
        const img=await upload(imageFile,"image");if(!active())return;
        const pdf=await upload(pdfFile,"pdf");if(!active())return;
        if(img)draft.cover_url=img;
        if(pdf)draft.attachment_url=pdf;
      }
      const payload={...draft,status};
      // Keep the planned date in the form; draft rows intentionally have no server schedule.
      let response;
      if(current){
        response=await client.from("cms_posts").update(payload).eq("id",current.id)
          .eq("updated_at",current.updated_at).select("*").maybeSingle();
        if(!response.error&&!response.data){const conflict=Error("다른 관리자가 수정했을 수 있어요. 최신 글을 다시 확인해 주세요.");conflict.isConflict=true;throw conflict;}
      }else{
        response=await client.from("cms_posts").insert({...payload,id,author_id:owner}).select("*").single();
      }
      if(response.error)throw response.error;
      if(!active())return;
      if(!response.data)throw Error("서버 저장 결과를 확인할 수 없습니다.");
      current=response.data;saved=true;importManual=false;
      if(JSON.stringify(editorFields.map(id=>$(id).value))===fingerprint
        &&$("postCoverFile").files[0]===imageFile&&$("postPdfFile").files[0]===pdfFile){
        dirty=false;forget();
        // Do not reset inputs: a draft trigger clears scheduled_at, not the editor intention.
        $("postCoverUrl").value=draft.cover_url||"";$("postAttachmentUrl").value=draft.attachment_url||"";
        if(status==="published"){$("postCoverFile").value="";$("postPdfFile").value="";pendingFiles={};}
      }
      $("editorMode").textContent="EDIT / "+statusName(current);
      stash();pendingNotice();
      $("editorSavedAt").textContent=dirty?"저장되지 않은 변경사항":automatic?"자동 임시저장 완료":"서버에 저장됨";
      detail("마지막 서버 저장: "+savedTime()+(hasPending()?" · 파일은 아직 저장되지 않음":""));
      $("saveDraft").hidden=status==="published";
      $("unpublishPost").hidden=status!=="published";
      $("trashPost").hidden=false;$("historyButton").hidden=false;
      $("publishPost").textContent=status==="published"?"변경사항 게시 ↗":"게시하기 ↗";
      try{await loadPosts();}catch(e){if(active())notify("글은 저장됐지만 목록 갱신 실패: "+e.message,true);}
      if(active()&&!automatic)notify(status==="published"?(current.scheduled_at&&new Date(current.scheduled_at)>new Date()?"예약 발행이 저장되었습니다.":"공개 게시되었습니다."):"임시저장이 완료되었습니다.");
    }catch(e){if(active()){clearTimeout(autosaveTimer);$("editorSavedAt").textContent="저장 실패";detail((e.isConflict?"저장 충돌":navigator.onLine?"서버 저장 실패":"오프라인")+" · 입력 유지 · 마지막 서버 저장: "+savedTime());stash();notify((automatic?"자동저장":"저장")+" 실패: "+(e.message||e),true);}}
    finally{
      if(active()){$("postForm").inert=false;busyMode(false);}
      if(active()&&saved&&dirty&&current?.status==="draft"){
        clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>savePost("draft",true),3500);
      }
    }
  }
  async function changeDeleted(restore=false){
    if(!current||busy)return;
    if(!restore&&!confirm("글을 휴지통으로 이동할까요? 공개 화면에서는 즉시 사라져요."))return;
    if(dirty||hasPending()){notify("미저장 변경사항을 먼저 저장하거나 다른 글로 이동해 주세요.",true);return;}
    const started=epoch,owner=user?.id,id=current.id;
    const active=()=>epoch===started&&user?.id===owner&&current?.id===id;
    busyMode(true);$("postForm").inert=true;
    try{
      const {data,error}=await client.from("cms_posts")
        .update({deleted_at:restore?null:new Date().toISOString()})
        .eq("id",current.id).eq("updated_at",current.updated_at)
        .select("*").maybeSingle();
      if(error)throw error;
      if(!data)throw Error("글이 다른 곳에서 수정됐습니다. 새로고침해 주세요.");
      if(!active())return;
      await loadPosts();if(!active())return;selectPost(data,false);
      notify(restore?"게시글을 복구했습니다.":"게시글을 휴지통으로 이동했습니다.");
    }catch(e){if(active())notify((restore?"복구":"삭제")+" 실패: "+e.message,true);}
    finally{if(epoch===started){$("postForm").inert=false;busyMode(false);}}
  }
  async function purgePost(){
    if(!current?.deleted_at||busy)return;
    if(!confirm("완전히 삭제할까요? 게시글 본문은 되돌릴 수 없어요."))return;
    const started=epoch,owner=user?.id,id=current.id;
    const active=()=>epoch===started&&user?.id===owner&&current?.id===id;
    busyMode(true);$("postForm").inert=true;
    try{
      const {data,error}=await client.from("cms_posts").delete().eq("id",current.id)
        .eq("updated_at",current.updated_at).select("id").maybeSingle();
      if(error)throw error;
      if(!data)throw Error("글이 다른 곳에서 수정됐습니다. 새로고침해 주세요.");
      if(!active())return;
      forget();await loadPosts();if(!active())return;selectPost(null,false);
      notify("게시글이 영구 삭제되었습니다. 첨부 파일과 수정 이력은 별도 정리가 필요할 수 있어요.");
    }catch(e){if(active())notify("삭제 실패: "+e.message,true);}
    finally{if(epoch===started){$("postForm").inert=false;busyMode(false);}}
  }
  async function loadHistory(){
    if(!current||busy)return;
    const id=current.id,started=epoch;
    const {data,error}=await client.from("cms_post_revisions")
      .select("id,post_id,snapshot,recorded_at").eq("post_id",id)
      .order("id",{ascending:false}).limit(40);
    if(epoch!==started||current?.id!==id)return;
    if(error){notify("이력 조회 실패: "+error.message,true);return;}
    $("historyPanel").hidden=false;
    const holder=$("historyList");holder.replaceChildren();
    for(const revision of data||[]){
      const item=node("button","studio-history-item");
      item.type="button";
      const stamp=cms.dateText(revision.recorded_at);
      item.append(node("strong","","Revision #"+revision.id),node("small","",stamp+" · "+(revision.snapshot?.title||"제목 없음")));
      item.addEventListener("click",()=>{
        if(busy||epoch!==started||current?.id!==id)return;
        if(current.deleted_at){notify("휴지통의 글은 먼저 복구해 주세요.",true);return;}
        if(!confirm("이 버전을 편집기에 불러올까요? 저장하기 전에는 실제 글이 변경되지 않습니다."))return;
        if((dirty||hasPending())&&!confirm("현재 편집 내용이 이 버전으로 대체됩니다. 계속할까요?"))return;
        pendingFiles={};applyForm(revision.snapshot);pendingNotice();markChanged(false);$("historyPanel").hidden=true;
        notify("과거 버전을 편집기에 불러왔어요. 내용을 확인한 후 저장하세요.");
      });
      holder.append(item);
    }
    if(!holder.childElementCount)holder.append(node("p","sidebar-empty","수정 이력이 없습니다."));
  }
  function preview(){
    let v;try{v=readPost();}catch(e){notify(e.message,true);return;}
    $("previewTitle").textContent=v.title||"제목 없음";
    $("previewExcerpt").textContent=v.excerpt||"";
    cms.renderBody($("previewBody"),v.body);
    const notes=$("previewResearchNotes"),meta=$("previewResearchMeta");
    notes.replaceChildren();
    if(v.kind==="research"){
      meta.textContent=[v.research_sector,v.research_company,v.research_author].filter(Boolean).join(" / ");
      if(v.research_method){
        const head=document.createElement("h2"),text=document.createElement("p");
        head.textContent="분석 방법";text.textContent=v.research_method;
        notes.append(head,text);
      }
      if(v.research_limitations){
        const head=document.createElement("h2"),text=document.createElement("p");
        head.textContent="가정과 한계";text.textContent=v.research_limitations;
        notes.append(head,text);
      }
    }else meta.textContent="";
    clearPreviewFile();const file=$("postPdfFile").files[0];
    if(file&&file.type==="application/pdf"&&file.size>0&&file.size<=20*1024*1024){previewUrl=URL.createObjectURL(file);$("previewLocalPdf").href=previewUrl;$("previewLocalPdf").hidden=false;}
    $("postForm").hidden=true;$("previewPanel").hidden=false;
  }
  function clearSession(preserve=true){
    if(preserve&&user&&(dirty||hasPending()))stash();
    epoch++;clearTimeout(autosaveTimer);clearTimeout(stashTimer);clearPreviewFile();
    user=null;posts=[];current=null;workId=null;dirty=false;pendingFiles={};blockedRecovery=false;importManual=false;closeImport();clearImportReview();
    $("postForm").inert=false;busyMode(false);applyForm(null);pendingNotice();renderRecovery();$("adminPostList").replaceChildren();$("historyList").replaceChildren();$("previewBody").replaceChildren();$("previewTitle").textContent="";$("previewExcerpt").textContent="";$("previewResearchMeta").textContent="";$("previewResearchNotes").replaceChildren();$("studioAccount").textContent="";detail("");visible("studioLogin");
  }
  async function checkUser(){
    if(recovering)return;
    if(checking)return checking;
    const started=epoch;
    checking=(async()=>{
      const {data,error}=await client.auth.getUser();
      if(epoch!==started)return;
      if(error||!data.user){clearSession();return;}
      const verified=data.user;
      const result=await client.from("cms_admins").select("user_id,email").eq("user_id",verified.id).maybeSingle();
      if(epoch!==started)return;
      if(result.error)throw result.error;
      if(!result.data){
        clearSession();await client.auth.signOut();visible("studioLogin");
        notify("승인된 최고관리자 계정이 아닙니다.",true);return;
      }
      const changedUser=user?.id!==verified.id;
      if(changedUser)clearSession();
      user=verified;const confirmedEpoch=epoch;
      $("studioAccount").textContent=(verified.email||"최고관리자")+" · SUPERADMIN";
      if(changedUser){migrateLegacy();await loadPosts();if(epoch!==confirmedEpoch||user?.id!==verified.id)return;selectPost(null,false);}
      visible("studioPanel");
      window.dispatchEvent(new Event("sfc:admin-ready"));
    })().catch(e=>{clearSession();notify("권한 확인 실패: "+(e.message||e),true);})
      .finally(()=>{checking=null;});
    return checking;
  }
  async function start(){
    if(!cms?.configured()){visible("studioSetup");return;}
    try{
      client=await cms.getClient();
      client.auth.onAuthStateChange(event=>{
        if(event==="PASSWORD_RECOVERY"){clearSession();recovering=true;visible("studioReset");return;}
        if(event==="SIGNED_OUT"){clearSession();return;}
        if((event==="SIGNED_IN"||event==="TOKEN_REFRESHED")&&!recovering)setTimeout(()=>checkUser(),0);
      });
      await checkUser();
    }catch(e){visible("studioLogin");notify("연결 실패: "+e.message,true);}
  }
  $("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();const button=$("loginForm").querySelector('button[type="submit"]');
    if(!client)return notify("인증 서버 연결을 확인해 주세요.",true);
    button.disabled=true;
    try{
      const {error}=await client.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
      if(error)throw error;
      $("loginPassword").value="";
      await checkUser();
    }catch(e){notify("로그인 실패: 이메일, 비밀번호, 계정 승인을 확인해 주세요.",true);}
    finally{button.disabled=false;}
  });
  $("forgotPassword").addEventListener("click",async()=>{
    if(!client)return;
    const email=$("loginEmail").value.trim();
    if(!email)return notify("이메일을 입력해 주세요.",true);
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    notify(error?"메일 요청 실패: "+error.message:"해당 계정이 있다면 재설정 메일을 전송합니다.",Boolean(error));
  });
  $("resetForm").addEventListener("submit",async event=>{
    event.preventDefault();if(!client)return;
    if($("resetPassword").value.length<12)return notify("비밀번호는 12자 이상이어야 해요.",true);
    const {error}=await client.auth.updateUser({password:$("resetPassword").value});
    if(error)return notify("변경 실패: "+error.message,true);
    $("resetPassword").value="";recovering=false;await client.auth.signOut();
    visible("studioLogin");notify("비밀번호를 변경했습니다. 다시 로그인해 주세요.");
  });
  $("studioLogout").addEventListener("click",async()=>{
    if(busy)return;
    const owner=user?.id;if(!owner)return;
    if((dirty||hasPending()||snapshots(owner).length)&&!confirm("로그아웃하면 이 계정의 이 기기 복구본과 미저장 편집 내용이 삭제됩니다. 서버 저장본은 유지됩니다. 계속할까요?"))return;
    clearTimeout(autosaveTimer);clearTimeout(stashTimer);
    const {error}=await client.auth.signOut();
    if(error){notify("로그아웃 실패: "+error.message,true);return;}
    for(const v of snapshots(owner))forget(v.workId,owner);
    clearSession(false);notify("로그아웃했습니다.");
  });
  document.querySelectorAll("[data-pane]").forEach(button=>button.addEventListener("click",()=>{
    if(busy)return;
    if((dirty||hasPending())&&button.dataset.pane!=="posts"){
      if(!confirm("저장되지 않은 글이 있어요. 다른 메뉴로 이동할까요?"))return;
      if(!stash()&&!confirm("복구본을 저장하지 못했습니다. 그래도 이동할까요?"))return;
    }
    if(button.dataset.pane!=="posts")closeImport();showPane(button.dataset.pane);
  }));
  document.querySelectorAll(".sidebar-tabs button").forEach(b=>b.addEventListener("click",()=>{
    filter=b.dataset.status;
    document.querySelectorAll(".sidebar-tabs button").forEach(x=>x.classList.toggle("selected",x===b));
    renderPosts();
  }));
  $("postKind").addEventListener("change",()=>$("researchFields").hidden=$("postKind").value!=="research");
  $("postSchedule").addEventListener("change",()=>$("publishPost").textContent=$("postSchedule").value?"예약·게시하기 ↗":"게시하기 ↗");
  editorFields.forEach(id=>$(id).addEventListener("input",markChanged));
  ["postCoverFile","postPdfFile"].forEach(id=>$(id).addEventListener("change",()=>{delete pendingFiles[id];pendingNotice();markChanged();}));
  $("discardPendingFiles").addEventListener("click",()=>{if(busy)return;pendingFiles={};$("postCoverFile").value="";$("postPdfFile").value="";pendingNotice();markChanged();});
  $("recoverWork").addEventListener("click",openRecovery);
  $("discardRecovery").addEventListener("click",discardRecovery);
  window.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"&&user&&!document.querySelector('[data-pane-view="posts"]').hidden){event.preventDefault();if(!busy)void savePost("draft");}});
  $("newPost").addEventListener("click",newPost);
  $("postSearch").addEventListener("input",renderPosts);
  const importer=window.SFC_RESEARCH_IMPORTER;
  function resetImportResult(){importCandidate=null;importRevision++;$("applyImport").disabled=true;$("importResult").replaceChildren();}
  function closeImport(){resetImportResult();$("importText").value="";$("importFile").value="";$("importPanel").hidden=true;}
  function clearImportReview(){$("importReviewContent").replaceChildren();$("importReview").hidden=true;}
  function reviewLines(container,result){
    container.replaceChildren();
    function line(text){container.append(node("p","",text));}
    for(const warning of result.warnings)line("검토 필요: "+warning);
    if(result.source?.filename)line("원본: "+result.source.filename);
    for(const v of result.evidence||[])line("근거(미검증): "+[v.claim,v.locator,v.value,v.unit,v.period,v.short_excerpt].filter(Boolean).join(" · "));
    for(const v of result.references||[])line("참고자료: "+[v.citation,v.locator].filter(Boolean).join(" · "));
    for(const v of result.issues||[])line("검토 항목: "+[v.category,v.message,v.locator].filter(Boolean).join(" · "));
  }
  $("openImporter").addEventListener("click",()=>{if(!user||busy)return;closeImport();$("importPrompt").value=importer.prompt;$("importPanel").hidden=false;$("closeImporter").focus();});
  $("closeImporter").addEventListener("click",()=>{closeImport();$("openImporter").focus();});
  $("copyImportPrompt").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(importer.prompt);notify("분석 지침을 복사했습니다.");}catch(_){$("importPrompt").focus();$("importPrompt").select();notify("선택된 지침을 직접 복사하세요.");}});
  $("importText").addEventListener("input",resetImportResult);
  $("importFile").addEventListener("change",async()=>{
    resetImportResult();const revision=importRevision,started=epoch,file=$("importFile").files[0];
    if(!file)return;
    if(file.size>1000000||!/\.json$/i.test(file.name)){notify("1MB 이하 JSON 파일을 선택하세요.",true);return;}
    try{const value=await file.text();if(epoch!==started||revision!==importRevision||!user)return;
      if(value.length>600000){notify("JSON 글자 수 제한을 초과했습니다.",true);return;}$("importText").value=value;
    }catch(e){if(epoch===started&&revision===importRevision)notify("파일을 읽지 못했습니다.",true);}
  });
  $("validateImport").addEventListener("click",()=>{
    if(!user||busy)return;resetImportResult();
    const result=importer.parse($("importText").value);
    if(!result.ok){for(const message of result.errors)$("importResult").append(node("p","",message));return;}
    importCandidate=result;reviewLines($("importResult"),result);
    $("importResult").prepend(node("p","","형식 검사 완료 · 제목: "+result.article.title+" · 본문 "+result.article.body.length+"자. 원문 검수는 필요합니다."));
    $("applyImport").disabled=false;
  });
  $("applyImport").addEventListener("click",()=>{
    if(!user||busy||!importCandidate)return;const result=importCandidate;
    if(!confirm("현재 게시물은 변경하지 않고 새 연구 임시글에 적용할까요?"))return;
    if(!selectPost(null))return;
    applyForm({...result.article,kind:"research"});
    importManual=true;markChanged(false);stash();reviewLines($("importReviewContent"),result);$("importReview").hidden=false;
    detail("가져온 초안 · 확인 후 임시저장하세요. 자동저장은 첫 수동 저장 이후 시작됩니다.");
    closeImport();$("postTitle").focus();
  });
  document.querySelectorAll("[data-format]").forEach(button=>button.addEventListener("click",()=>{
    if(busy||!user)return;const field=$("postBody"),start=field.selectionStart,end=field.selectionEnd;
    const from=start===0?0:field.value.lastIndexOf("\n",start-1)+1;
    const selection=field.value.slice(from,end);
    const replacement=selection.split("\n").map(line=>button.dataset.format+line.replace(/^(?:#{1,3}|[-*])\s+/,"")).join("\n");
    if(field.value.length-(end-from)+replacement.length>field.maxLength){notify("본문 글자 수 제한을 초과합니다.",true);return;}
    field.setRangeText(replacement,from,end,"end");field.focus();markChanged();
  }));
  $("focusEditor").addEventListener("click",()=>{const on=$("focusEditor").getAttribute("aria-pressed")!=="true";$("focusEditor").setAttribute("aria-pressed",String(on));$("focusEditor").textContent=on?"집중 모드 종료":"집중 모드";document.querySelector(".studio-editor").classList.toggle("focused",on);});
  $("previewWidth").addEventListener("click",()=>{const on=$("previewWidth").getAttribute("aria-pressed")!=="true";$("previewWidth").setAttribute("aria-pressed",String(on));$("previewWidth").textContent=on?"기본 폭 미리보기":"모바일 폭 미리보기";$("previewPanel").classList.toggle("mobile-preview",on);});
  $("saveDraft").addEventListener("click",()=>savePost("draft"));
  $("publishPost").addEventListener("click",()=>{if(confirm("“"+($("postTitle").value.trim()||"제목 없는 글")+"” 글을 "+($("postSchedule").value?"예약 발행":"공개 게시")+"할까요? 공개 승인 여부를 확인해 주세요."))void savePost("published");});
  $("unpublishPost").addEventListener("click",()=>{if(confirm("공개 게시를 취소할까요? 기존 공개 파일 URL은 접근 가능할 수 있습니다."))void savePost("draft",false,true);});
  $("trashPost").addEventListener("click",()=>changeDeleted(false));
  $("restorePost").addEventListener("click",()=>changeDeleted(true));
  $("deletePost").addEventListener("click",purgePost);
  $("historyButton").addEventListener("click",loadHistory);
  $("historyClose").addEventListener("click",()=>$("historyPanel").hidden=true);
  $("insertResearchOutline")?.addEventListener("click",()=>{
    const field=$("postBody");
    if(field.value.trim()){
      notify("기존 본문을 보호하기 위해 빈 편집기에만 템플릿을 삽입할 수 있습니다.",true);
      field.focus();return;
    }
    field.value=[
      "# 연구 질문",
      "분석하려는 질문과 범위를 작성해 주세요.",
      "",
      "## 분석 방법과 자료",
      "분석 방법과 사용한 자료의 출처를 작성해 주세요.",
      "",
      "## 핵심 근거",
      "검토한 재무 자료와 주요 관찰 사항을 작성해 주세요.",
      "",
      "## 주요 가정 및 검증",
      "가정의 근거와 민감한 변수를 작성해 주세요.",
      "",
      "## 해석과 한계",
      "가능한 다른 해석과 분석상 제약을 작성해 주세요.",
      "",
      "## 참고자료",
      "원문 자료의 제목, 발행기관, 날짜와 URL을 작성해 주세요."
    ].join("\n");
    field.dispatchEvent(new Event("input",{bubbles:true}));
    field.focus();
    notify("연구 구성 템플릿을 입력했습니다. 안내 문구를 실제 분석 내용으로 교체하세요.");
  });
  $("previewButton").addEventListener("click",preview);
  $("closePreview").addEventListener("click",()=>{clearPreviewFile();$("previewPanel").hidden=true;$("postForm").hidden=false;});
  $("postForm").addEventListener("submit",event=>event.preventDefault());
  window.addEventListener("beforeunload",event=>{
    if(dirty||hasPending()){stash();event.preventDefault();event.returnValue="";}
  });
  window.SFC_STUDIO=Object.freeze({
    getClient:()=>client,getUser:()=>user,notify,upload,showPane
  });
  start();
})();
