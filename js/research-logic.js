"use strict";
(function(root){
  const normalized=v=>String(v??"").normalize("NFKC").trim().replace(/\s+/gu," ").toLocaleLowerCase("ko");
  const safeSearch=v=>String(v??"").normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu," ").trim().replace(/\s+/gu," ").slice(0,60);
  function sectorGroups(values){
    const groups=new Map();
    for(const value of values){if(typeof value!=="string"||!normalized(value)||value.length>100)continue;const key=normalized(value);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(value);}
    return [...groups.values()].map(s=>{const values=[...s].sort((a,b)=>a.localeCompare(b,"ko")||(a<b?-1:a>b?1:0));return {label:values[0].trim().replace(/\s+/g," "),values};}).sort((a,b)=>a.label.localeCompare(b.label,"ko")||(a.label<b.label?-1:a.label>b.label?1:0));
  }
  function visible(row,now=Date.now()){
    return row?.kind==="research"&&row.status==="published"&&row.deleted_at==null&&(row.scheduled_at==null||(Number.isFinite(Date.parse(row.scheduled_at))&&Date.parse(row.scheduled_at)<=now));
  }
  function related(current,rows,limit=3,now=Date.now()){
    const company=normalized(current?.research_company),sector=normalized(current?.research_sector);
    if(!current?.id||(!company&&!sector))return [];
    const seen=new Set([current.id]);const candidates=[];
    for(const row of rows){if(!visible(row,now)||!row.id||seen.has(row.id))continue;seen.add(row.id);const rank=company&&normalized(row.research_company)===company?2:sector&&normalized(row.research_sector)===sector?1:0;if(rank)candidates.push({id:row.id,rank,reason:rank===2?"same-company":"same-sector",published_at:row.published_at});}
    return candidates.sort((a,b)=>b.rank-a.rank||(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0)||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(0,Math.min(10,limit))).map(({id,reason})=>({id,reason}));
  }
  root.SFC_RESEARCH_LOGIC=Object.freeze({normalized,safeSearch,sectorGroups,visible,related});
})(typeof window==="object"?window:globalThis);
