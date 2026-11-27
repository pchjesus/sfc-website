"use strict";
/* Local-only backup inspection. Never accepts a client or writes to a database. */
(function(root){
  const tables=Object.freeze(["cms_posts","cms_post_revisions","cms_site_settings","cms_people","cms_sessions","cms_admins"]);
  const keyFor={cms_post_revisions:"id",cms_site_settings:"key",cms_admins:"user_id"};
  const maxBytes=20*1024*1024;
  const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
  const nonempty=v=>typeof v==="string"&&v.trim().length>0;
  const validDate=v=>typeof v==="string"&&Number.isFinite(Date.parse(v));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function canonical(v){
    if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
    if(object(v))return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
    return JSON.stringify(v);
  }
  async function digest(t){
    const bytes=new TextEncoder().encode(canonical(t));
    if(!root.crypto?.subtle)throw Error("체크섬 계산을 지원하지 않는 환경입니다.");
    return Array.from(new Uint8Array(await root.crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
  }
  function safeStructure(raw){
    const stack=[[raw,0]];let count=0;
    while(stack.length){const [v,depth]=stack.pop();if(++count>1000000||depth>35)return false;
      if(v&&typeof v==="object"){for(const k of Object.keys(v)){if(["__proto__","prototype","constructor"].includes(k))return false;stack.push([v[k],depth+1]);}}
    }return true;
  }
  async function inspect(text){
    const errors=[],warnings=[],counts={};
    const issue=(arr,msg)=>{if(arr.length<50)arr.push(msg);};
    const fail=msg=>({ok:false,errors:[msg],warnings,counts,checksum:"not-checked"});
    if(typeof text!=="string"||text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)return fail("백업 파일은 최대 20MiB입니다.");
    let data;try{data=JSON.parse(text);}catch(_){return fail("유효한 JSON 파일이 아닙니다.");}
    if(!object(data)||!safeStructure(data))return fail("JSON 구조 또는 깊이 제한을 확인하세요.");
    const version=data.format;
    if(!["sfc-cms-export-v1","sfc-cms-export-v2"].includes(version)||data.project!=="sfc-website"||!object(data.tables))return fail("지원하지 않는 백업 형식 또는 프로젝트입니다.");
    if(!validDate(data.exported_at))issue(errors,"백업 생성 시각이 잘못되었거나 누락되었습니다.");
    for(const k of Object.keys(data))if(!["format","project","exported_at","tables","checksum"].includes(k))issue(errors,"알 수 없는 최상위 필드");
    const ids={};
    for(const table of tables){
      const rows=data.tables[table];
      if(!own(data.tables,table)||!Array.isArray(rows)||rows.length>10000){issue(errors,table+": 필수 배열 또는 최대 10,000행 제한 확인");continue;}
      counts[table]=rows.length;ids[table]=new Set();
      for(const [i,row] of rows.entries()){
        const at=table+"["+i+"]";
        if(!object(row)){issue(errors,at+": 객체가 필요합니다.");continue;}
        const id=row[keyFor[table]||"id"];
        if(!nonempty(id)&&!(table==="cms_post_revisions"&&Number.isSafeInteger(id)&&id>0)){issue(errors,at+": 식별자 누락");continue;}
        const key=String(id);if(ids[table].has(key))issue(errors,at+": 중복 식별자");ids[table].add(key);
        if(table==="cms_posts"&&(!nonempty(row.title)||typeof row.body!=="string"||!["research","notice","activity"].includes(row.kind)||!["draft","published"].includes(row.status)))issue(errors,at+": 게시글 필수 필드/상태 오류");
        if(table==="cms_post_revisions"&&(!nonempty(row.post_id)||!object(row.snapshot)||row.snapshot.id!==row.post_id))issue(errors,at+": 이력 참조 또는 스냅샷 오류");
        if(table==="cms_site_settings"&&(!["site","recruitment"].includes(row.key)||!object(row.value)))issue(errors,at+": 설정 구조 오류");
        if(table==="cms_people"&&(!nonempty(row.name)||typeof row.visible!=="boolean"||!Number.isSafeInteger(row.sort_order)))issue(errors,at+": 인물 필수 필드 오류");
        if(table==="cms_sessions"&&(!nonempty(row.title)||!nonempty(row.week_label)||!["foundation","application","research"].includes(row.stage)||typeof row.visible!=="boolean"||!Number.isSafeInteger(row.sort_order)))issue(errors,at+": 교육과정 필수 필드 오류");
        if(table==="cms_admins"&&(!nonempty(row.email)||!row.email.includes("@")))issue(errors,at+": 관리자 식별정보 누락");
      }
    }
    for(const k of Object.keys(data.tables))if(!tables.includes(k))issue(errors,"지원하지 않는 백업 테이블");
    for(const [i,row] of (Array.isArray(data.tables.cms_post_revisions)?data.tables.cms_post_revisions:[]).entries())if(object(row)&&nonempty(row.post_id)&&ids.cms_posts&&!ids.cms_posts.has(row.post_id))issue(warnings,"이력 "+(i+1)+": 현재 게시글 참조 없음(영구 삭제 이력일 수 있음)");
    if(ids.cms_site_settings&&["site","recruitment"].some(k=>!ids.cms_site_settings.has(k)))issue(warnings,"일부 사이트 설정 행이 누락되었습니다.");
    if((counts.cms_admins||0)>3)issue(errors,"운영 관리자 정원(3명)을 초과했습니다.");
    let checksum="not-provided";
    if(version==="sfc-cms-export-v2"){
      if(!object(data.checksum)||data.checksum.algorithm!=="SHA-256"||typeof data.checksum.value!=="string"||!/^([a-f0-9]{64})$/.test(data.checksum.value)){checksum="invalid";issue(errors,"체크섬 형식 누락 또는 오류");}
      else if(errors.length===0){try{checksum=await digest({format:data.format,project:data.project,exported_at:data.exported_at,tables:data.tables})===data.checksum.value?"match":"mismatch";if(checksum!=="match")issue(errors,"체크섬 불일치: 백업 내용이 변경되었을 수 있습니다.");}catch(_){checksum="unavailable";issue(errors,"체크섬을 계산하지 못했습니다.");}}
    }else issue(warnings,"이전 v1 백업은 체크섬이 없습니다.");
    issue(warnings,"파일 원본·Auth 계정은 포함되지 않습니다. 검사 통과는 운영 복원 가능성이나 진위 보증이 아닙니다.");
    return {ok:errors.length===0,errors,warnings,counts,checksum};
  }
  async function seal(tablesData,exportedAt=new Date().toISOString()){
    const data={format:"sfc-cms-export-v2",project:"sfc-website",exported_at:exportedAt,tables:tablesData};
    if(!safeStructure(data))throw Error("백업 구조 제한을 초과했습니다.");
    if(new TextEncoder().encode(JSON.stringify(data)).length>maxBytes)throw Error("백업 20MiB 한도를 초과했습니다.");
    const value=await digest(data);return {...data,checksum:{algorithm:"SHA-256",value}};
  }
  root.SFC_BACKUP=Object.freeze({tables,maxBytes,inspect,seal,canonical});
})(typeof window==="object"?window:globalThis);
