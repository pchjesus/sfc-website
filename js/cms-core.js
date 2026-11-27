"use strict";
/* Shared browser-only CMS adapter. All authorization is enforced by Supabase RLS,
 * never by this client-side file. No secret keys are used or accepted here. */
(function(){
  const config=window.SFC_CMS_CONFIG||{};
  const sdkUrl="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.js";
  let pending=null,client=null,publicClient=null;
  function configured(){
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||"")
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||"");
  }
  function getClient(){
    if(!configured())return Promise.resolve(null);
    if(client)return Promise.resolve(client);
    if(pending)return pending;
    pending=new Promise((resolve,reject)=>{
      if(window.supabase&&typeof window.supabase.createClient==="function"){
        client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        resolve(client);return;
      }
      const script=document.createElement("script");
      script.src=sdkUrl;script.async=true;script.crossOrigin="anonymous";
      script.onload=()=>{
        try{
          if(!window.supabase||typeof window.supabase.createClient!=="function")throw new Error("Supabase SDK is unavailable");
          client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
          resolve(client);
        }catch(error){reject(error);}
      };
      script.onerror=()=>reject(new Error("인증 라이브러리를 불러올 수 없습니다. 네트워크를 확인해 주세요."));
      document.head.appendChild(script);
    }).catch(error=>{pending=null;throw error;});
    return pending;
  }
  async function getPublicClient(){
    if(!configured())return null;
    await getClient(); // Load the pinned SDK once. Never reuse an authenticated client for public content.
    if(!publicClient)publicClient=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return publicClient;
  }
  function safeUrl(candidate){
    if(!candidate||typeof candidate!=="string")return "";
    try{
      const parsed=new URL(candidate);
      return parsed.protocol==="https:"&&parsed.username===""&&parsed.password===""?parsed.href:"";
    }catch(_error){return "";}
  }
  function renderBody(element,raw){
    element.replaceChildren();
    const lines=String(raw||"").replace(/\r\n/g,"\n").split("\n");
    let paragraph=[],bullet=null;
    const flush=()=>{
      if(paragraph.length){
        const p=document.createElement("p");p.textContent=paragraph.join("\n");
        element.appendChild(p);paragraph=[];
      }
      bullet=null;
    };
    for(const line of lines){
      const trimmed=line.trim();
      if(!trimmed){flush();continue;}
      const heading=/^(#{1,3})\s+(.+)$/.exec(trimmed);
      if(heading){
        flush();
        const h=document.createElement(heading[1].length===1?"h2":"h3");
        h.textContent=heading[2];element.appendChild(h);
      }else if(/^[-*]\s+/.test(trimmed)){
        if(paragraph.length)flush();
        if(!bullet){bullet=document.createElement("ul");element.appendChild(bullet);}
        const li=document.createElement("li");li.textContent=trimmed.slice(2);bullet.appendChild(li);
      }else{
        bullet=null;paragraph.push(line);
      }
    }
    flush();
  }
  const kindNames={research:"Research",notice:"공지사항",activity:"활동 소식"};
  function dateText(iso){
    if(!iso)return "예정";
    const dt=new Date(iso);
    return Number.isNaN(dt.valueOf())?"":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(dt);
  }
  // Both public Reader and private unsaved preview use the same semantic DOM.
  // This renderer never creates an image, iframe, external link or network request.
  function renderArticle(article,{title,meta,body,overview,overviewText,toc,idPrefix="reader",scroll}){
    const n=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
    const research=article.kind==="research";
    title.textContent=article.title||"제목 없음";
    meta.textContent=[kindNames[article.kind]||article.kind,article.research_sector,article.research_company,article.research_author,dateText(article.published_at)].filter(Boolean).join(" / ");
    renderBody(body,article.body||"");
    overview.hidden=!research;overviewText.textContent="";
    toc.replaceChildren();toc.hidden=!research;
    if(research){
      overviewText.textContent=article.excerpt||"연구 개요가 별도로 제공되지 않았습니다. 본문을 확인해 주세요.";
      for(const [label,value] of [["분석 방법",article.research_method],["가정과 한계",article.research_limitations]]){
        const valueText=String(value||"").trim();
        if(valueText){const section=n("section","cms-research-notes");section.append(n("h2","",label),n("p","",valueText));body.append(section);}
      }
      if(!body.children.length)body.append(n("p","","연구 본문은 아직 등록되지 않았습니다. 원문 파일을 확인해 주세요."));
      toc.append(n("span","","CONTENTS / RESEARCH"));
      const add=(label,target,level)=>{const button=n("button","",label);button.type="button";if(level)button.dataset.level=level;button.addEventListener("click",()=>scroll(target));toc.append(button);};
      add("01 / 연구 개요",overview);
      [...body.querySelectorAll("h2,h3")].forEach((h,i)=>{h.id=idPrefix+"-heading-"+i;add(String(i+2).padStart(2,"0")+" / "+h.textContent,h,h.tagName.slice(1));});
    }else if(article.excerpt){body.prepend(n("p","cms-post-deck",article.excerpt));}
    return research;
  }
  window.SFC_CMS=Object.freeze({configured,getClient,getPublicClient,safeUrl,renderBody,renderArticle,kindNames,dateText});
})();
