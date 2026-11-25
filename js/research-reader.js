"use strict";
/* SFC Research Reader: safe content rendering, on-demand detail, no fake findings. */
(function(){
  const $=id=>document.getElementById(id);
  const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
  const dialog=$("researchPdfDialog");
  const toc=$("readerToc");
  function clear(){
    $("post")?.classList.remove("reader-active");
    toc?.replaceChildren();if(toc)toc.hidden=true;
    const summary=$("readerOverview");if(summary)summary.hidden=true;
    const actions=$("readerActions");if(actions)actions.hidden=true;
    $("cmsPostBody")?.replaceChildren();$("cmsPostAssets")?.replaceChildren();
  }
  function status(title,message){
    clear();
    $("cmsPostTitle").textContent=title;
    $("cmsPostMeta").textContent=message||"";
  }
  function render(article,cms){
    clear();
    const body=$("cmsPostBody"),assets=$("cmsPostAssets");
    const research=article.kind==="research";
    $("post").classList.toggle("reader-active",research);
    $("cmsPostTitle").textContent=article.title;
    $("cmsPostMeta").textContent=[cms.kindNames[article.kind]||article.kind,
      article.research_sector,article.research_company,article.research_author,
      cms.dateText(article.published_at)].filter(Boolean).join(" / ");
    cms.renderBody(body,article.body||"");
    if(research){
      $("readerOverview").hidden=false;
      $("readerOverviewText").textContent=article.excerpt||"연구 개요가 별도로 제공되지 않았습니다. 본문을 확인해 주세요.";
      const method=String(article.research_method||"").trim();
      const limits=String(article.research_limitations||"").trim();
      if(method){const section=node("section","cms-research-notes");section.append(node("h2","","분석 방법"),node("p","",method));body.append(section);}
      if(limits){const section=node("section","cms-research-notes");section.append(node("h2","","가정과 한계"),node("p","",limits));body.append(section);}
      if(!body.children.length)body.append(node("p","","연구 본문은 아직 등록되지 않았습니다. 원문 파일을 확인해 주세요."));
      const heading=node("span","","CONTENTS / RESEARCH");toc.append(heading);
      const overview=node("button","","01 / 연구 개요");
      overview.type="button";overview.addEventListener("click",()=>scrollToSection($("readerOverview")));
      toc.append(overview);
      [...body.querySelectorAll("h2,h3")].forEach((h,i)=>{
        h.id="reader-heading-"+i;
        const button=node("button","",String(i+2).padStart(2,"0")+" / "+h.textContent);
        button.type="button";button.dataset.level=h.tagName.slice(1);
        button.addEventListener("click",()=>scrollToSection(h));
        toc.append(button);
      });
      toc.hidden=false;$("readerActions").hidden=false;
    }else if(article.excerpt){
      body.prepend(node("p","cms-post-deck",article.excerpt));
    }
    const cover=cms.safeUrl(article.cover_url),pdf=cms.safeUrl(article.attachment_url);
    if(cover){
      const image=node("img","cms-post-cover");
      image.src=cover;image.alt="게시글 대표 이미지";image.loading="lazy";
      assets.append(image);
    }
    if(pdf){
      const link=node("a","cms-download","PDF 원문 열기 ↗");
      link.href=pdf;link.target="_blank";link.rel="noopener noreferrer";assets.append(link);
      if(research){
        const preview=node("button","reader-pdf-trigger","PREVIEW / PDF 미리보기 ↗");
        preview.type="button";preview.addEventListener("click",()=>openPdf(pdf));
        assets.append(preview);
      }
    }
  }
  function scrollToSection(el){
    el?.scrollIntoView({behavior:window.SFC_MOTION?.reduced()?"instant":"smooth",block:"start"});
  }
  function openPdf(url){
    if(!dialog)return;
    const safe=window.SFC_CMS?.safeUrl(url);
    if(!safe)return;
    $("researchPdfFrame").src=safe+"#toolbar=0";
    $("researchPdfDownload").href=safe;
    dialog.showModal();$("researchPdfClose").focus({preventScroll:true});
  }
  $("researchPdfClose")?.addEventListener("click",()=>dialog.close());
  dialog?.addEventListener("close",()=>$("researchPdfFrame").removeAttribute("src"));
  dialog?.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  $("readerCopyLink")?.addEventListener("click",async()=>{
    const feedback=$("readerShareFeedback");
    try{await navigator.clipboard.writeText(location.href);feedback.textContent="링크를 복사했습니다.";}
    catch(_error){feedback.textContent="링크 복사 기능을 사용할 수 없습니다.";}
  });
  window.SFC_READER=Object.freeze({clear,status,render});
})();
