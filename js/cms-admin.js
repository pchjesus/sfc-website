"use strict";
(function(){
  const cms=window.SFC_CMS;
  const $=id=>document.getElementById(id);
  let client=null,user=null,posts=[],current=null,busy=false,dirty=false,filter="all",checking=null,recovering=false;
  let autosaveTimer=null,stashTimer=null,toastTimer=null;
  const recoveryKey="sfc-editor-draft-v2";
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
  function stash(){
    if(!dirty)return;
    try{sessionStorage.setItem(recoveryKey,JSON.stringify({id:current?.id||null,values:readPost(),savedAt:Date.now()}));}catch(_){}
  }
  function forget(){try{sessionStorage.removeItem(recoveryKey);}catch(_){}}
  function restoreScratch(id){
    let snapshot;
    try{snapshot=JSON.parse(sessionStorage.getItem(recoveryKey)||"null");}catch(_){}
    if(!snapshot||snapshot.id!==id)return;
    if(!confirm("이전에 저장되지 않은 편집 내용이 있어요. 복구할까요?")){forget();return;}
    applyForm(snapshot.values);markChanged();
  }
  function markChanged(){
    dirty=true;$("editorSavedAt").textContent="저장되지 않은 변경사항";
    clearTimeout(stashTimer);stashTimer=setTimeout(stash,400);
    clearTimeout(autosaveTimer);
    if(!current||current.status==="draft")autosaveTimer=setTimeout(()=>savePost("draft",true),2600);
  }
  function selectPost(item,confirmDirty=true){
    if(confirmDirty&&dirty&&!confirm("저장하지 않은 변경사항이 있어요. 다른 글로 이동할까요?"))return false;
    current=item||null;dirty=false;applyForm(item);
    const trashed=Boolean(item?.deleted_at);
    $("editorMode").textContent=item?"EDIT / "+(trashed?"TRASHED":item.status.toUpperCase()):"NEW ARTICLE";
    $("editorSavedAt").textContent=item?"마지막 저장 "+cms.dateText(item.updated_at):"아직 저장되지 않음";
    $("postForm").hidden=trashed;$("previewPanel").hidden=true;$("historyPanel").hidden=true;
    $("saveDraft").hidden=Boolean(item?.status==="published");
    $("publishPost").textContent=$("postSchedule").value?"예약·게시하기 ↗":"게시하기 ↗";
    $("trashPost").hidden=!item||trashed;
    $("restorePost").hidden=!trashed;
    $("deletePost").hidden=!trashed;
    $("historyButton").hidden=!item;
    $("unpublishPost").hidden=!item||item.status!=="published"||trashed;
    renderPosts();return true;
  }
  function newPost(){
    if(selectPost(null))restoreScratch(null);
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
    const selected=posts.filter(included);
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
    const {data,error}=await client.from("cms_posts").select("*")
      .order("updated_at",{ascending:false}).limit(300);
    if(error)throw error;
    posts=data||[];renderPosts();
  }
  function busyMode(state){
    busy=state;["saveDraft","publishPost","trashPost","restorePost","deletePost","newPost","unpublishPost"].forEach(id=>$(id).disabled=state);
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
  async function savePost(status,automatic=false){
    if(busy||!user||current?.deleted_at)return;
    if(automatic&&current?.status==="published")return;
    let draft;
    try{draft=readPost();}catch(e){if(!automatic)notify(e.message,true);return;}
    if(draft.title.length<3||draft.body.length===0){
      if(!automatic)notify("제목은 최소 3자, 본문은 1자 이상 입력해야 합니다.",true);return;
    }
    if(!validUrl($("postCoverUrl").value.trim())||!validUrl($("postAttachmentUrl").value.trim())){
      if(!automatic)notify("이미지와 첨부파일 주소는 https:// URL만 허용돼요.",true);
      return;
    }
    if(automatic&&($("postCoverFile").files.length||$("postPdfFile").files.length))return;
    const fingerprint=JSON.stringify(draft);
    busyMode(true);
    try{
      if(!automatic){
        const img=await upload($("postCoverFile").files[0],"image");
        const pdf=await upload($("postPdfFile").files[0],"pdf");
        if(img)draft.cover_url=img;
        if(pdf)draft.attachment_url=pdf;
      }
      const payload={...draft,status};
      if(status!=="published")payload.scheduled_at=null;
      let response;
      if(current){
        response=await client.from("cms_posts").update(payload).eq("id",current.id)
          .eq("updated_at",current.updated_at).select("*").maybeSingle();
        if(!response.error&&!response.data)throw Error("다른 관리자가 수정했을 수 있어요. 최신 글을 다시 확인해 주세요.");
      }else{
        response=await client.from("cms_posts").insert({...payload,author_id:user.id}).select("*").single();
      }
      if(response.error)throw response.error;
      current=response.data;
      if(!automatic||JSON.stringify(readPost())===fingerprint){
        dirty=false;forget();
        if(!automatic)applyForm(current);
      }
      $("editorMode").textContent="EDIT / "+statusName(current);
      $("editorSavedAt").textContent=automatic?"자동 임시저장 완료":"서버에 저장됨";
      $("saveDraft").hidden=status==="published";
      $("unpublishPost").hidden=status!=="published";
      $("trashPost").hidden=false;$("historyButton").hidden=false;
      $("publishPost").textContent=status==="published"?"변경사항 게시 ↗":"게시하기 ↗";
      await loadPosts();
      if(!automatic)notify(status==="published"?(current.scheduled_at&&new Date(current.scheduled_at)>new Date()?"예약 발행이 저장되었습니다.":"공개 게시되었습니다."):"임시저장이 완료되었습니다.");
    }catch(e){if(!automatic)$("editorSavedAt").textContent="저장 실패";notify((automatic?"자동저장":"저장")+" 실패: "+(e.message||e),true);}
    finally{
      busyMode(false);
      if(automatic&&dirty&&current?.status==="draft"){
        clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>savePost("draft",true),3500);
      }
    }
  }
  async function changeDeleted(restore=false){
    if(!current||busy)return;
    if(!restore&&!confirm("글을 휴지통으로 이동할까요? 공개 화면에서는 즉시 사라져요."))return;
    busyMode(true);
    try{
      const {data,error}=await client.from("cms_posts")
        .update({deleted_at:restore?null:new Date().toISOString()})
        .eq("id",current.id).eq("updated_at",current.updated_at)
        .select("*").maybeSingle();
      if(error)throw error;
      if(!data)throw Error("글이 다른 곳에서 수정됐습니다. 새로고침해 주세요.");
      await loadPosts();selectPost(data,false);
      notify(restore?"게시글을 복구했습니다.":"게시글을 휴지통으로 이동했습니다.");
    }catch(e){notify((restore?"복구":"삭제")+" 실패: "+e.message,true);}
    finally{busyMode(false);}
  }
  async function purgePost(){
    if(!current?.deleted_at||busy)return;
    if(!confirm("완전히 삭제할까요? 게시글 본문은 되돌릴 수 없어요."))return;
    busyMode(true);
    try{
      const {error}=await client.from("cms_posts").delete().eq("id",current.id);
      if(error)throw error;
      forget();current=null;await loadPosts();selectPost(null,false);
      notify("게시글이 영구 삭제되었습니다. 첨부 파일과 수정 이력은 별도 정리가 필요할 수 있어요.");
    }catch(e){notify("삭제 실패: "+e.message,true);}
    finally{busyMode(false);}
  }
  async function loadHistory(){
    if(!current)return;
    const id=current.id;
    const {data,error}=await client.from("cms_post_revisions")
      .select("id,post_id,snapshot,recorded_at").eq("post_id",id)
      .order("id",{ascending:false}).limit(40);
    if(error){notify("이력 조회 실패: "+error.message,true);return;}
    $("historyPanel").hidden=false;
    const holder=$("historyList");holder.replaceChildren();
    for(const revision of data||[]){
      const item=node("button","studio-history-item");
      item.type="button";
      const stamp=cms.dateText(revision.recorded_at);
      item.append(node("strong","","Revision #"+revision.id),node("small","",stamp+" · "+(revision.snapshot?.title||"제목 없음")));
      item.addEventListener("click",()=>{
        if(current?.id!==id)return;
        if(current.deleted_at){notify("휴지통의 글은 먼저 복구해 주세요.",true);return;}
        if(!confirm("이 버전을 편집기에 불러올까요? 저장하기 전에는 실제 글이 변경되지 않습니다."))return;
        applyForm(revision.snapshot);markChanged();$("historyPanel").hidden=true;
        notify("과거 버전을 편집기에 불러왔어요. 내용을 확인한 후 저장하세요.");
      });
      holder.append(item);
    }
    if(!holder.childElementCount)holder.append(node("p","sidebar-empty","수정 이력이 없습니다."));
  }
  function preview(){
    const v=readPost();
    $("previewTitle").textContent=v.title||"제목 없음";
    $("previewExcerpt").textContent=v.excerpt||"";
    cms.renderBody($("previewBody"),v.body);
    $("postForm").hidden=true;$("previewPanel").hidden=false;
  }
  async function checkUser(){
    if(recovering)return;
    if(checking)return checking;
    checking=(async()=>{
      const {data,error}=await client.auth.getUser();
      if(error||!data.user){user=null;visible("studioLogin");return;}
      const verified=data.user;
      const result=await client.from("cms_admins").select("user_id,email").eq("user_id",verified.id).maybeSingle();
      if(result.error)throw result.error;
      if(!result.data){
        user=null;await client.auth.signOut();visible("studioLogin");
        notify("승인된 최고관리자 계정이 아닙니다.",true);return;
      }
      const changedUser=user?.id!==verified.id;
      user=verified;
      $("studioAccount").textContent=(verified.email||"최고관리자")+" · SUPERADMIN";
      visible("studioPanel");
      if(changedUser){await loadPosts();selectPost(null,false);restoreScratch(null);}
      window.dispatchEvent(new Event("sfc:admin-ready"));
    })().catch(e=>{visible("studioLogin");notify("권한 확인 실패: "+(e.message||e),true);})
      .finally(()=>{checking=null;});
    return checking;
  }
  async function start(){
    if(!cms?.configured()){visible("studioSetup");return;}
    try{
      client=await cms.getClient();
      client.auth.onAuthStateChange(event=>{
        if(event==="PASSWORD_RECOVERY"){recovering=true;visible("studioReset");return;}
        if(event==="SIGNED_OUT"){user=null;posts=[];current=null;visible("studioLogin");return;}
        if(event==="SIGNED_IN"&&!recovering)queueMicrotask(()=>checkUser());
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
    if(dirty&&!confirm("저장되지 않은 편집 내용이 있어요. 로그아웃할까요?"))return;
    forget();user=null;await client.auth.signOut();visible("studioLogin");notify("로그아웃했습니다.");
  });
  document.querySelectorAll("[data-pane]").forEach(button=>button.addEventListener("click",()=>{
    if(dirty&&button.dataset.pane!=="posts"){
      if(!confirm("저장되지 않은 글이 있어요. 다른 메뉴로 이동할까요?"))return;
      stash();
    }
    showPane(button.dataset.pane);
  }));
  document.querySelectorAll(".sidebar-tabs button").forEach(b=>b.addEventListener("click",()=>{
    filter=b.dataset.status;
    document.querySelectorAll(".sidebar-tabs button").forEach(x=>x.classList.toggle("selected",x===b));
    renderPosts();
  }));
  $("postKind").addEventListener("change",()=>$("researchFields").hidden=$("postKind").value!=="research");
  $("postSchedule").addEventListener("change",()=>$("publishPost").textContent=$("postSchedule").value?"예약·게시하기 ↗":"게시하기 ↗");
  editorFields.forEach(id=>$(id).addEventListener("input",markChanged));
  $("newPost").addEventListener("click",newPost);
  $("saveDraft").addEventListener("click",()=>savePost("draft"));
  $("publishPost").addEventListener("click",()=>savePost("published"));
  $("unpublishPost").addEventListener("click",()=>savePost("draft"));
  $("trashPost").addEventListener("click",()=>changeDeleted(false));
  $("restorePost").addEventListener("click",()=>changeDeleted(true));
  $("deletePost").addEventListener("click",purgePost);
  $("historyButton").addEventListener("click",loadHistory);
  $("historyClose").addEventListener("click",()=>$("historyPanel").hidden=true);
  $("previewButton").addEventListener("click",preview);
  $("closePreview").addEventListener("click",()=>{$("previewPanel").hidden=true;$("postForm").hidden=false;});
  $("postForm").addEventListener("submit",event=>event.preventDefault());
  window.addEventListener("beforeunload",event=>{
    if(dirty){stash();event.preventDefault();event.returnValue="";}
  });
  window.SFC_STUDIO=Object.freeze({
    getClient:()=>client,getUser:()=>user,notify,upload,showPane
  });
  start();
})();
