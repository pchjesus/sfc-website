"use strict";
/* SFC v2.8.2 — cinematic editorial motion, faithful to the existing design.
 * Page identity is revealed through spatial composition, not speed alone.
 * State, copy, and actions remain available even before all motion completes.
 */
(function(){
  const motion=window.SFC_MOTION;
  const ease="cubic-bezier(.42,0,.58,1)"; // opacity builds across the whole duration
  const settle="cubic-bezier(.42,0,.58,1)";
  const reduced=()=>motion?.reduced?.()||false;
  const active=new WeakMap(), observed=new WeakSet(), firstLists=new WeakSet();
  const stageAnimations=[];
  const viewSeen=new WeakSet();
  let sceneId=0;
  let routeAnimations=[];
  const isMobile=()=>window.innerWidth<=760;
  function tween(el,frames,duration=950,delay=0,easing=ease){
    if(!el||reduced()||!el.animate||!el.getClientRects().length)return null;
    const prior=active.get(el);
    if(prior)try{prior.cancel()}catch(_){}
    const a=el.animate(frames,{duration,delay,easing,fill:"backwards"}); // no flash before delay
    active.set(el,a);
    a.finished.then(()=>{if(active.get(el)===a)active.delete(el)},()=>{});
    return a;
  }
  function gather(el,side="up",delay=0,duration=1720){
    const distance=isMobile()?28:side==="up"?58:side==="short"?22:86;
    const x=side==="left"?-distance:side==="right"?distance:0;
    const y=side==="up"||side==="short"?distance:0;
    // Nearly invisible -> prolonged fade -> fully assembled reading position.
    return tween(el,[
      {opacity:0,transform:`translate3d(${x}px,${y}px,0) scale(.972)`,offset:0},
      {opacity:.035,transform:`translate3d(${x*.94}px,${y*.94}px,0) scale(.974)`,offset:.14},
      {opacity:.20,transform:`translate3d(${x*.66}px,${y*.66}px,0) scale(.985)`,offset:.38},
      {opacity:.68,transform:`translate3d(${x*.20}px,${y*.20}px,0) scale(.997)`,offset:.73},
      {opacity:.94,transform:"translate3d(0,0,0) scale(1)",offset:.93},
      {opacity:1,transform:"none",offset:1}
    ],duration,delay);
  }
  function underline(el,delay=0){
    // One brief line accent, never a false progress indicator.
    return gather(el,"left",delay,1500);
  }
  function sequence(root,selector,side="up",options={}){
    if(!root)return;
    const {step=155,base=0,max=5,duration=1630}=options;
    [...root.querySelectorAll(selector)].slice(0,max).forEach((el,i)=>
      gather(el,typeof side==="function"?side(i):side,base+i*step,duration));
  }
  function firstList(root,selector,cap=5){
    if(!root||firstLists.has(root)||!root.closest(".view.active"))return;
    const rows=[...root.querySelectorAll(selector)].slice(0,cap);
    if(!rows.length)return;
    firstLists.add(root);
    rows.forEach((el,i)=>gather(el,i%2?"right":"left",i*145,1720));
  }
  // Route composition runs each time the visitor enters a tab: the old v2.7
  // sense of a new scene returning, without waiting to navigate or use it.
  function enter(root){
    if(!root)return;
    sceneId++;
    routeAnimations.forEach(a=>{try{a.cancel()}catch(_){}});
    routeAnimations=[];
    if(reduced())return;
    const track=a=>{if(a)routeAnimations.push(a);return a};
    // Restore a gentle whole-scene settle that v2.8 mistakenly removed.
    track(tween(root,[
      {opacity:.06,transform:"translate3d(0,15px,0)",offset:0},
      {opacity:.18,transform:"translate3d(0,12px,0)",offset:.28},
      {opacity:.58,transform:"translate3d(0,5px,0)",offset:.63},
      {opacity:.92,transform:"translate3d(0,0,0)",offset:.9},
      {opacity:1,transform:"none",offset:1}
    ],1420,0,settle));
    const head=root.querySelector(".page-head");
    if(head){
      track(gather(head.querySelector(".eyebrow"),"left",60,1147));
      track(gather(head.querySelector("h1"),"left",100,1736));
      track(gather(head.querySelector("p"),"right",210,1659));
    }
    switch(root.id){
      case "home":
        track(gather(root.querySelector(".hero-top"),"up",80,1318));
        track(gather(root.querySelector("#heroNumber"),"left",120,1178));
        track(gather(root.querySelector("#heroHeading"),"left",160,1845));
        track(gather(root.querySelector("#heroDescription"),"right",350,1628));
        track(gather(root.querySelector("#heroButton"),"up",520,1473));
        track(gather(root.querySelector(".hero-controls"),"right",610,1488));
        break;
      case "about":
        track(gather(root.querySelector(".about-photo-panel h2"),"left",230,1736));
        sequence(root,".about-photo-panel .about-approved-copy .about-line","right",
          {step:95,base:310,max:3,duration:1628});
        break;
      case "research":
        track(gather(root.querySelector(".archive-intro"),"right",310,1535));
        track(gather(root.querySelector(".archive-search-row"),"left",400,1535));
        track(gather(root.querySelector(".archive-controls"),"right",470,1550));
        requestAnimationFrame(()=>firstList(root.querySelector("#archiveResults"),".archive-report",5));
        break;
      case "activities":
        track(gather(root.querySelector(".schedule-header"),"left",300,1473));
        track(gather(root.querySelector("#journeyContext"),"right",360,1674));
        const stageButtons=[...root.querySelectorAll("#scheduleTabs button")];
        stageButtons.forEach((b,i)=>track(gather(b,i<2?"left":"right",520+i*95,1473)));
        [...root.querySelectorAll("#scheduleList>.session:not([hidden]),#scheduleList>.cms-session:not([hidden])")]
          .slice(0,4).forEach((row,i)=>track(tween(row,[
            {opacity:0,clipPath:"inset(0 0 26% 0)",offset:0},
            {opacity:.12,clipPath:"inset(0 0 20% 0)",offset:.3},
            {opacity:.58,clipPath:"inset(0 0 6% 0)",offset:.72},
            {opacity:1,clipPath:"inset(0 0 0 0)",offset:1}
          ],1640,660+i*175)));
        break;
      case "people":
        track(gather(root.querySelector(".people-editorial-lead h2"),"left",230,1674));
        track(gather(root.querySelector(".people-editorial-lead p"),"right",340,1612));
        people();
        break;
      case "recruitment":
        track(gather(root.querySelector(".recruit-intro-copy"),"left",240,1690));
        track(gather(root.querySelector(".recruit-fact-grid"),"right",320,1721));
        track(gather(root.querySelector("#recruitActionCard"),"up",480,1752));
        break;
      case "updates":
        track(gather(root.querySelector(".updates-section-heading"),"left",300,1457));
        track(gather(root.querySelector("#updatesFilters"),"right",410,1488));
        requestAnimationFrame(()=>firstList(root.querySelector("#updatesList"),".cms-card",5));
        break;
      case "post":
      case "detail":
        track(gather(root.querySelector(".cms-post-head,.detail-masthead"),"left",220,1783));
        track(gather(root.querySelector(".reader-layout,.detail-body"),"right",350,1519));
        break;
    }
    watch(root);
  }
  function slide(copy){
    // The image remains the dominant 1250ms crossfade; copy gently catches up.
    gather(copy,"up",0,1490);
  }
  function visible(el){
    if(!el)return false;
    if(el.matches(".page-head")||el.id==="heroHeading")return true;
    const root=el.closest(".view");
    if(!root)return false;
    if(el.matches("#home .home-value-copy")){
      gather(el.querySelector("h2"),"left",0,1705);
      gather(el.querySelector("p"),"right",150,1488);
      gather(el.querySelector(".home-value-link"),"up",280,1349);
      return true;
    }
    if(el.matches("#home .home-section")){
      gather(el.querySelector(".section-head"),"left",0,1333);
      gather(el.querySelector(".featured-photo"),"left",100,1798);
      gather(el.querySelector(".featured-copy"),"right",220,1829);
      return true;
    }
    if(el.matches("#home .process-layout")){
      gather(el.querySelector("h2"),"left",0,1690);
      sequence(el,".process-point","right",{base:150,step:120,max:3,duration:1550});
      return true;
    }
    if(el.matches("#home .join-layout")){
      gather(el.querySelector("p,h2"),"left",0,1535);
      gather(el.querySelector("a,button"),"right",160,1612);
      return true;
    }
    if(el.matches("#about .about-photo-panel"))return true; // Enter() owns first scene
    if(el.matches("#about .about-reason")){
      const parent=el.parentElement;
      const idx=[...parent.children].indexOf(el);
      gather(el,idx===0?"left":idx===2?"right":"up",idx*105,1628);
      const svg=el.querySelector("svg");
      tween(svg,[
        {opacity:0,transform:"scale(.94)",offset:0},
        {opacity:.18,transform:"scale(.955)",offset:.38},
        {opacity:.75,transform:"scale(.99)",offset:.82},
        {opacity:1,transform:"none",offset:1}
      ],1460,160);
      return true;
    }
    if(el.matches("#about .about-section-heading")){
      gather(el.querySelector("h2"),"left",0,1612);
      gather(el.querySelector("p"),"right",145,1473);
      return true;
    }
    if(el.matches("#people .people-editorial-lead"))return true;
    if(el.matches("#people .people-next-link")){
      gather(el,"up",0,1535);return true;
    }
    if(el.matches("#recruitment .recruit-intro")||el.matches("#recruitment #recruitActionCard"))return true;
    if(el.matches("#recruitment .recruitment-process")){
      sequence(el,".process-step",i=>i%2?"right":"left",
        {step:125,base:0,max:4,duration:1659});return true;
    }
    return false;
  }
  // Secondary content enters on scroll. It never rearranges information.
  const watchSelectors={
    about:".experience-layout",
    activities:".session-list",
    people:".team-node",
    recruitment:".recruitment-process,.recruitment-faq-heading",
    updates:""
  };
  const intersection=typeof IntersectionObserver!=="undefined"
    ?new IntersectionObserver(entries=>{
      for(const {target,isIntersecting} of entries){
        if(!isIntersecting)continue;
        intersection.unobserve(target);
        if(reduced()||!target.closest(".view.active"))continue;
        if(target.matches(".team-node")){
          const i=[...target.parentElement.children].indexOf(target);
          gather(target,i%2?"right":"left",Math.min(i*85,250),1643);
        }else if(target.matches(".experience-layout")){
          gather(target.querySelector(".experience-selector"),"left",0,1628);
          gather(target.querySelector(".experience-panel"),"right",190,1798);
        }else if(target.matches(".recruitment-process")){
          sequence(target,".process-step",i=>i%2?"right":"left",{base:90,step:120,duration:1581});
        }else if(target.matches(".recruitment-faq-heading")){
          gather(target,"left",0,1426);
        }else if(target.matches(".session-list")){
          // The top rows have the route-composition reveal. The list itself
          // stays static so expanded content and filter state are preserved.
        }else if(target.matches(".cms-card")){
          gather(target,"up",0,1426);
        }
      }
    },{threshold:.10,rootMargin:"0px 0px -8% 0px"}):null;
  function watch(root){
    if(!intersection||!root)return;
    const selector=watchSelectors[root.id];
    if(!selector)return;
    root.querySelectorAll(selector).forEach(el=>{
      if(observed.has(el))return;
      observed.add(el);
      intersection.observe(el);
    });
  }
  function people(){
    const list=document.getElementById("roleList");
    if(!list)return;
    // Actual CMS members are inserted dynamically; observe newly created DOM.
    watch(document.getElementById("people"));
  }
  function stage(index){
    stageAnimations.splice(0).forEach(a=>{try{a.cancel()}catch(_){}});
    if(reduced())return;
    const group=document.querySelector('[data-experience-visual="'+index+'"]');
    if(!group)return;
    const step=(el,frames,duration=1420,delay=0)=>{
      const a=tween(el,frames,duration,delay);
      if(a)stageAnimations.push(a);
    };
    const highlight=[
      {opacity:0,transform:"translateY(16px)",offset:0},
      {opacity:.12,transform:"translateY(13px)",offset:.32},
      {opacity:.62,transform:"translateY(4px)",offset:.72},
      {opacity:1,transform:"none",offset:1}
    ];
    if(index===0){
      [...group.querySelectorAll("path[stroke]")].forEach((path,i)=>{
        let length=0;try{length=path.getTotalLength()}catch(_){}
        if(length<1)return;
        step(path,[{opacity:0,strokeDasharray:length+" "+length,strokeDashoffset:length,offset:0},
          {opacity:.20,strokeDasharray:length+" "+length,strokeDashoffset:length*.75,offset:.4},
          {opacity:1,strokeDasharray:length+" "+length,strokeDashoffset:0,offset:1}],1500,i*140);
      });
      [...group.querySelectorAll("rect,circle")].slice(0,4).forEach((r,i)=>
        step(r,highlight,1330,160+i*110));
    }else if(index===1){
      [...group.querySelectorAll("rect")].forEach((r,i)=>
        step(r,[{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"none"}],1440,i*110));
      [...group.querySelectorAll("path[stroke]")].forEach((p,i)=>
        step(p,highlight,1570,220+i*100));
    }else if(index===2){
      [...group.querySelectorAll("path[stroke]")].forEach((p,i)=>step(p,highlight,1620,i*120));
      [...group.querySelectorAll("rect[stroke]")].slice(0,3).forEach((r,i)=>
        step(r,[{opacity:0},{opacity:1}],1360,240+i*105));
    }else if(index===3){
      [...group.querySelectorAll("rect")].slice(0,4).forEach((r,i)=>
        step(r,[{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"none"}],1500,i*100));
      [...group.querySelectorAll("path[stroke]")].slice(0,4).forEach((p,i)=>
        step(p,[{opacity:0},{opacity:1}],1360,240+i*95));
    }
  }
  function recruitment(action){
    if(!action)return;
    const status=action.dataset.state;
    if(!action.dataset.v28State){action.dataset.v28State=status;return}
    if(action.dataset.v28State===status)return;
    action.dataset.v28State=status;
    // Color/background already reflect the truthful recruitment state.
    tween(action,[{filter:"brightness(1.075)"},{filter:"brightness(1)"}],720);
  }
  const api={enter,visible,slide,stage,people,firstList,recruitment,watch};
  window.SFC_V28=Object.freeze(api);
})();
