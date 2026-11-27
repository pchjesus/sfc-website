document.getElementById("previewSwitch").addEventListener("click",()=>{location.hash=window.mock.mode==="developer"?"admin":"developer";location.reload();});
document.getElementById("previewReset").addEventListener("click",()=>{if(confirm("모의 데이터를 초기화할까요?")){try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith("sfc-test-workspace:"))sessionStorage.removeItem(k);}}catch(_){}location.reload();}});
document.getElementById("studioLogout").addEventListener("click",()=>{location.reload();});
