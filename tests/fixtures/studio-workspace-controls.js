document.getElementById("previewSwitch").addEventListener("click",()=>{location.hash=window.mock.mode==="developer"?"admin":"developer";location.reload();});
document.getElementById("previewReset").addEventListener("click",()=>{if(confirm("모의 데이터를 초기화할까요?")){try{sessionStorage.setItem("sfc-test-workspace:reset-next","1");}catch(_){}location.reload();}});
document.getElementById("studioLogout").addEventListener("click",()=>{location.reload();});
