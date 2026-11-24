"use strict";
(function(){
  const cms=window.SFC_CMS;
  const $=id=>document.getElementById(id);
  let client=null,user=null,posts=[],current=null,dirty=false,busy=false,filter="all",recovering=false;
  let noticeTimer=null,scratchTimer=null;
  const scratchKey="sfc-studio-editor-recovery-v1";
  const visible=id=>{
    for(const key of ["studioSetup","studioLogin","studioReset","studioPanel"])$(key).hidden=key!==id;
    $("studioLogout").hidden=id!=="studioPanel";
    $("studioAccount").hidden=id!=="studioPanel";
  };
  function notify(message,error=false){
    const el=$("studioMessage");
    el.hidden=false;el.textContent=message;el.style.background=error?"#903f36":"#192c3b";
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.hidden=true,6500);
  }
  const readForm=()=>({
    kind:$("postKind").value,title:$("postTitle").value.trim(),
    excerpt:$("postExcerpt").value.trim(),body:$("postBody").value.trim(),
    cover_url:cms.safeUrl($("postCoverUrl").value.trim())||null,
    attachment_url:cms.safeUrl($("postAttachmentUrl").value.trim())||null
  });
  function hasInvalidURL(){
    return ($("postCoverUrl").value.trim()&&!cms.safeUrl($("postCoverUrl").value.trim()))
      ||($("postAttachmentUrl").value.trim()&&!cms.safeUrl($("postAttachmentUrl").value.trim()));
  }
  function stash(){
    if(!dirty)return;
    const snapshot={id:current?.id||null,...readForm(),savedAt:Date.now()};
    try{sessionStorage.setItem(scratchKey,JSON.stringify(snapshot));}catch(_error){}
  }
  function forgetScratch(){try{sessionStorage.removeItem(scratchKey);}catch(_error){}}
  function changed(){
    dirty=true;
    $("editorSavedAt").textContent="저장되지 않은 변경사항";
    clearTimeout(scratchTimer);scratchTimer=setTimeout(stash,500);
  }
  function setEditor(item){
    current=item||null;dirty=false;
    $("postKind").value=item?.kind||"notice";
    $("postTitle").value=item?.title||"";
    $("postExcerpt").value=item?.excerpt||"";
    $("postBody").value=item?.body||"";
    $("postCoverUrl").value=item?.cover_url||"";
    $("postAttachmentUrl").value=item?.attachment_url||"";
    $("postCoverFile").value="";$("postPdfFile").value="";
    $("editorMode").textContent=item?"EDIT ARTICLE / "+item.status.toUpperCase():"NEW ARTICLE";
    $("editorSavedAt").textContent=item?"마지막 저장 "+cms.dateText(item.updated_at):"아직 저장되지 않음";
    $("deletePost").hidden=!item;$("unpublishPost").hidden=!item||item.status!=="published";
    $("publishPost").textContent=item?.status==="published"?"변경사항 게시 ↗":"게시하기 ↗";
    $("previewPanel").hidden=true;$("postForm").hidden=false;
    renderList();
  }
  function newPost(){
    if(dirty&&!window.confirm("저장하지 않은 변경사항이 있습니다. 다른 글로 이동할까요?"))return;
    setEditor(null);
    let snapshot=null;
    try{snapshot=JSON.parse(sessionStorage.getItem(scratchKey)||"null");}catch(_error){}
    if(snapshot&&snapshot.id===null&&window.confirm("이전 작업 중 임시 복구본을 발견했습니다. 복구할까요?")){
      $("postKind").value=snapshot.kind||"notice";$("postTitle").value=snapshot.title||"";
      $("postExcerpt").value=snapshot.excerpt||"";$("postBody").value=snapshot.body||"";
      $("postCoverUrl").value=snapshot.cover_url||"";$("postAttachmentUrl").value=snapshot.attachment_url||"";
      changed();
    }
  }
  function renderList(){
    const target=$("adminPostList");
    target.replaceChildren();
    const items=posts.filter(p=>filter==="all"||p.status===filter);
    $("postsCount").textContent=posts.length+" POSTS";
    if(!items.length){
      const empty=document.createElement("p");empty.className="sidebar-empty";
      empty.textContent="이 상태의 글이 없습니다.";target.append(empty);return;
    }
    items.forEach(p=>{
      const b=document.createElement("button");b.type="button";
      b.className="admin-post-item"+(current?.id===p.id?" selected":"");
      const type=document.createElement("small");
      type.textContent=(cms.kindNames[p.kind]||p.kind)+" · "+(p.status==="published"?"게시됨":"임시글");
      const title=document.createElement("strong");title.textContent=p.title;
      const stamp=document.createElement("time");stamp.textContent="수정 "+cms.dateText(p.updated_at);
      b.append(type,title,stamp);
      b.addEventListener("click",()=>{
        if(current?.id===p.id)return;
        if(dirty&&!window.confirm("저장하지 않은 변경사항이 있습니다. 이 글을 열까요?"))return;
        forgetScratch();setEditor(p);
      });
      target.append(b);
    });
  }
  async function reload(preferred){
    const {data,error}=await client.from("cms_posts")
      .select("id,kind,title,excerpt,body,status,cover_url,attachment_url,author_id,created_at,updated_at,published_at")
      .order("updated_at",{ascending:false}).limit(200);
    if(error)throw error;
    posts=data||[];
    if(preferred){
      const found=posts.find(p=>p.id===preferred);
      if(found)setEditor(found);else setEditor(null);
    }else renderList();
  }
  function setBusy(value){
    busy=value;
    ["saveDraft","publishPost","deletePost","unpublishPost","newPost"].forEach(id=>$(id).disabled=value);
  }
  async function upload(file,kind){
    if(!file)return null;
    const isImage=kind==="image";
    const mimeTypes=isImage?["image/jpeg","image/png","image/webp"]:["application/pdf"];
    const max=isImage?10*1024*1024:15*1024*1024;
    if(!mimeTypes.includes(file.type)||file.size>max||file.size===0)
      throw new Error(isImage?"이미지는 JPG·PNG·WEBP 형식으로 10MB 이하만 허용합니다.":"PDF는 15MB 이하만 허용합니다.");
    const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"})[file.type];
    const filename=user.id+"/"+crypto.randomUUID()+"."+ext;
    const {error}=await client.storage.from("sfc-media").upload(filename,file,{cacheControl:"3600",contentType:file.type,upsert:false});
    if(error)throw error;
    const {data}=client.storage.from("sfc-media").getPublicUrl(filename);
    const safe=cms.safeUrl(data.publicUrl);
    if(!safe)throw new Error("업로드 주소가 올바르지 않습니다.");
    return safe;
  }
  async function save(status){
    if(busy||!user)return;
    const draft=readForm();
    if(draft.title.length<3||draft.title.length>180){notify("제목은 3~180자로 입력해 주세요.",true);$("postTitle").focus();return;}
    if(!draft.body){notify("본문을 입력해 주세요.",true);$("postBody").focus();return;}
    if(draft.body.length>50000){notify("본문 길이가 50,000자를 초과합니다.",true);return;}
    if(hasInvalidURL()){notify("이미지 및 PDF 주소는 https://로 시작해야 합니다.",true);return;}
    setBusy(true);
    try{
      const image=await upload($("postCoverFile").files[0],"image");
      const pdf=await upload($("postPdfFile").files[0],"pdf");
      if(image)draft.cover_url=image;
      if(pdf)draft.attachment_url=pdf;
      const payload={...draft,status};
      let saved;
      if(current){
        const response=await client.from("cms_posts").update(payload)
          .eq("id",current.id).eq("updated_at",current.updated_at)
          .select("id").maybeSingle();
        if(response.error)throw response.error;
        if(!response.data)throw new Error("다른 관리자가 먼저 수정했을 수 있습니다. 새로고침 후 최신 글을 확인해 주세요.");
        saved=response.data.id;
      }else{
        const response=await client.from("cms_posts").insert({...payload,author_id:user.id})
          .select("id").single();
        if(response.error)throw response.error;
        saved=response.data.id;
      }
      forgetScratch();await reload(saved);
      notify(status==="published"?"게시글이 서버에 게시되었습니다.":"임시글이 서버에 저장되었습니다.");
    }catch(error){notify("저장 실패: "+(error.message||String(error)),true);}
    finally{setBusy(false);}
  }
  async function removePost(){
    if(!current||busy)return;
    if(!window.confirm("이 글을 영구 삭제할까요? 삭제한 게시글은 복구할 수 없습니다."))return;
    setBusy(true);
    try{
      const {error}=await client.from("cms_posts").delete().eq("id",current.id);
      if(error)throw error;
      forgetScratch();await reload();setEditor(null);notify("글이 삭제되었습니다.");
    }catch(error){notify("삭제 실패: "+error.message,true);}
    finally{setBusy(false);}
  }
  function preview(){
    const draft=readForm();
    $("previewTitle").textContent=draft.title||"제목 없음";
    $("previewExcerpt").textContent=draft.excerpt;
    cms.renderBody($("previewBody"),draft.body);
    $("postForm").hidden=true;$("previewPanel").hidden=false;
  }
  async function checkUser(){
    if(recovering)return;
    const response=await client.auth.getUser();
    if(response.error||!response.data.user){user=null;visible("studioLogin");return;}
    const candidate=response.data.user;
    const {data,error}=await client.from("cms_admins").select("user_id").eq("user_id",candidate.id).maybeSingle();
    if(error){notify("관리자 권한 확인 실패: "+error.message,true);visible("studioLogin");return;}
    if(!data){
      await client.auth.signOut();
      user=null;visible("studioLogin");notify("승인된 관리자 계정이 아닙니다.",true);return;
    }
    user=candidate;
    $("studioAccount").textContent=user.email||"관리자";
    visible("studioPanel");
    try{await reload();if(!current)setEditor(null);}
    catch(error){notify("글 목록을 불러오지 못했습니다: "+error.message,true);}
  }
  async function start(){
    if(!cms||!cms.configured()){visible("studioSetup");return;}
    try{
      client=await cms.getClient();
      client.auth.onAuthStateChange((event)=>{
        if(event==="PASSWORD_RECOVERY"){recovering=true;visible("studioReset");return;}
        if(event==="SIGNED_OUT"){user=null;visible("studioLogin");return;}
        if(event==="SIGNED_IN"&&!recovering)queueMicrotask(()=>{checkUser().catch(()=>{});});
      });
      await checkUser();
    }catch(error){visible("studioLogin");notify("인증 서비스 연결 오류: "+error.message,true);}
  }
  $("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();if(!client){notify("인증 서버가 연결되지 않았습니다.",true);return;}
    const submit=$("loginForm").querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const {error}=await client.auth.signInWithPassword({
        email:$("loginEmail").value.trim(),password:$("loginPassword").value
      });
      if(error)throw error;
      $("loginPassword").value="";
      await checkUser();
    }catch(error){notify("로그인 실패: 이메일·비밀번호 또는 계정 상태를 확인해 주세요.",true);}
    finally{submit.disabled=false;}
  });
  $("forgotPassword").addEventListener("click",async()=>{
    const email=$("loginEmail").value.trim();
    if(!email){notify("먼저 이메일을 입력해 주세요.",true);return;}
    try{
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      if(error)throw error;
      notify("등록된 계정이라면 재설정 안내 메일이 전송됩니다.");
    }catch(error){notify("메일 전송 실패: "+error.message,true);}
  });
  $("resetForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const password=$("resetPassword").value;
    if(password.length<12){notify("새 비밀번호는 12자 이상이어야 합니다.",true);return;}
    const {error}=await client.auth.updateUser({password});
    if(error){notify("비밀번호 변경 실패: "+error.message,true);return;}
    recovering=false;$("resetPassword").value="";
    await client.auth.signOut();visible("studioLogin");notify("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
  });
  $("studioLogout").addEventListener("click",async()=>{
    forgetScratch();await client.auth.signOut();user=null;visible("studioLogin");notify("로그아웃되었습니다.");
  });
  document.querySelectorAll(".sidebar-tabs button").forEach(b=>b.addEventListener("click",()=>{
    filter=b.dataset.status;
    document.querySelectorAll(".sidebar-tabs button").forEach(x=>x.classList.toggle("selected",x===b));
    renderList();
  }));
  $("newPost").addEventListener("click",newPost);
  ["postKind","postTitle","postExcerpt","postBody","postCoverUrl","postAttachmentUrl"].forEach(id=>$(id).addEventListener("input",changed));
  $("saveDraft").addEventListener("click",()=>save("draft"));
  $("publishPost").addEventListener("click",()=>save("published"));
  $("unpublishPost").addEventListener("click",()=>save("draft"));
  $("deletePost").addEventListener("click",removePost);
  $("previewButton").addEventListener("click",preview);
  $("closePreview").addEventListener("click",()=>{$("previewPanel").hidden=true;$("postForm").hidden=false;});
  window.addEventListener("beforeunload",event=>{
    if(dirty){stash();event.preventDefault();event.returnValue="";}
  });
  start();
})();
