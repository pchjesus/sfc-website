"use strict";
/* SFC v2.8.2 — cinematic editorial motion, faithful to the existing design.
 * Page identity is revealed through spatial composition, not speed alone.
 * State, copy, and actions remain available even before all motion completes.
 */
(function(){
  const motion=window.SFC_MOTION;
  const ease="cubic-bezier(.16,1,.3,1)";
  const settle="cubic-bezier(.22,.8,.25,1)";
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
    const a=el.animate(frames,{duration,delay,easing,fill:"none"});
    active.set(el,a);
    a.finished.then(()=>{if(active.get(el)===a)active.delete(el)},()=>{});
    return a;
  }
  function gather(el,side="up",delay=0,duration=1000,fromOpacity=.48){
    const distance=isMobile()?18:side==="up"?34:side==="short"?12:52;
    const x=side==="left"?-distance:side==="right"?distance:0;
    const y=side==="up"||side==="short"?distance:0;
    return tween(el,[
      {opacity:fromOpacity,transform:`translate3d(${x}px,${y}px,0) scale(.987)`},
      {opacity:.92,transform:"translate3d(0,0,0) scale(1)",offset:.83},
      {opacity:1,transform:"none"}
    ],duration,delay);
  }
  function underline(el,delay=0){
    // One brief line accent, never a false progress indicator.
    return tween(el,[{opacity:.58,transform:"translateX(-7px)"},{opacity:1,transform:"none"}],760,delay);
  }
  function sequence(root,selector,side="up",options={}){
    if(!root)return;
    const {step=105,base=0,max=5,duration=910}=options;
    [...root.querySelectorAll(selector)].slice(0,max).forEach((el,i)=>
      gather(el,typeof side==="function"?side(i):side,base+i*step,duration));
  }
  function firstList(root,selector,cap=5){
    if(!root||firstLists.has(root)||!root.closest(".view.active"))return;
    const rows=[...root.querySelectorAll(selector)].slice(0,cap);
    if(!rows.length)return;
    firstLists.add(root);
    rows.forEach((el,i)=>gather(el,i%2?"right":"left",i*92,920,.68));
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
      {opacity:.76,transform:"translate3d(0,10px,0)"},
      {opacity:1,transform:"none"}
    ],920,0,settle));
    const head=root.querySelector(".page-head");
    if(head){
      track(gather(head.querySelector(".eyebrow"),"left",60,740,.55));
      track(gather(head.querySelector("h1"),"left",100,1120,.52));
      track(gather(head.querySelector("p"),"right",210,1070,.60));
    }
    switch(root.id){
      case "home":
        track(gather(root.querySelector(".hero-top"),"up",80,850,.56));
        track(gather(root.querySelector("#heroNumber"),"left",120,760,.48));
        track(gather(root.querySelector("#heroHeading"),"left",160,1190,.52));
        track(gather(root.querySelector("#heroDescription"),"right",350,1050,.52));
        track(gather(root.querySelector("#heroButton"),"up",520,950,.48));
        track(gather(root.querySelector(".hero-controls"),"right",610,960,.58));
        break;
      case "about":
        track(gather(root.querySelector(".about-photo-panel h2"),"left",230,1120,.55));
        sequence(root,".about-photo-panel .about-approved-copy .about-line","right",
          {step:95,base:310,max:3,duration:1050});
        break;
      case "research":
        track(gather(root.querySelector(".archive-intro"),"right",310,990,.58));
        track(gather(root.querySelector(".archive-toolbar"),"left",400,990,.55));
        track(gather(root.querySelector(".archive-filters"),"right",470,1000,.60));
        requestAnimationFrame(()=>firstList(root.querySelector("#archiveResults"),".archive-report",5));
        break;
      case "activities":
        track(gather(root.querySelector(".schedule-header"),"left",300,950,.55));
        track(gather(root.querySelector("#journeyContext"),"right",360,1080,.56));
        const stageButtons=[...root.querySelectorAll("#scheduleTabs button")];
        stageButtons.forEach((b,i)=>track(gather(b,i<2?"left":"right",520+i*95,950,.50)));
        sequence(root,"#scheduleList>.session,#scheduleList>.cms-session","up",
          {base:650,step:115,max:4,duration:950});
        break;
      case "people":
        track(gather(root.querySelector(".people-editorial-lead h2"),"left",230,1080,.55));
        track(gather(root.querySelector(".people-editorial-lead p"),"right",340,1040,.56));
        people();
        break;
      case "recruitment":
        track(gather(root.querySelector(".recruit-intro-copy"),"left",240,1090,.56));
        track(gather(root.querySelector(".recruit-fact-grid"),"right",320,1110,.55));
        track(gather(root.querySelector("#recruitActionCard"),"up",480,1130,.60));
        break;
      case "updates":
        track(gather(root.querySelector(".updates-section-heading"),"left",300,940,.56));
        track(gather(root.querySelector("#updatesFilters"),"right",410,960,.58));
        requestAnimationFrame(()=>firstList(root.querySelector("#updatesList"),".cms-card",5));
        break;
      case "post":
      case "detail":
        track(gather(root.querySelector(".cms-post-head,.detail-masthead"),"left",220,1150,.52));
        track(gather(root.querySelector(".reader-layout,.detail-body"),"right",350,980,.65));
        break;
    }
    watch(root);
  }
  function slide(copy){
    // The image remains the dominant 1250ms crossfade; copy gently catches up.
    gather(copy,"up",0,800,.55);
  }
  function visible(el){
    if(!el)return false;
    if(el.matches(".page-head")||el.id==="heroHeading")return true;
    const root=el.closest(".view");
    if(!root)return false;
    if(el.matches("#home .home-value-copy")){
      gather(el.querySelector("h2"),"left",0,1100,.51);
      gather(el.querySelector("p"),"right",150,960,.62);
      gather(el.querySelector(".home-value-link"),"up",280,870,.58);
      return true;
    }
    if(el.matches("#home .home-section")){
      gather(el.querySelector(".section-head"),"left",0,860,.57);
      gather(el.querySelector(".featured-photo"),"left",100,1160,.59);
      gather(el.querySelector(".featured-copy"),"right",220,1180,.55);
      return true;
    }
    if(el.matches("#home .process-layout")){
      gather(el.querySelector("h2"),"left",0,1090,.57);
      sequence(el,".process-point","right",{base:150,step:120,max:3,duration:1000});
      return true;
    }
    if(el.matches("#home .join-layout")){
      gather(el.querySelector("p,h2"),"left",0,990,.59);
      gather(el.querySelector("a,button"),"right",160,1040,.60);
      return true;
    }
    if(el.matches("#about .about-photo-panel"))return true; // Enter() owns first scene
    if(el.matches("#about .about-reason")){
      const parent=el.parentElement;
      const idx=[...parent.children].indexOf(el);
      gather(el,idx===0?"left":idx===2?"right":"up",idx*105,1050,.54);
      const svg=el.querySelector("svg");
      tween(svg,[{opacity:.6,transform:"scale(.955)"},{opacity:1,transform:"none"}],950,180);
      return true;
    }
    if(el.matches("#about .about-section-heading")){
      gather(el.querySelector("h2"),"left",0,1040,.56);
      gather(el.querySelector("p"),"right",145,950,.60);
      return true;
    }
    if(el.matches("#people .people-editorial-lead"))return true;
    if(el.matches("#people .people-next-link")){
      gather(el,"up",0,990,.62);return true;
    }
    if(el.matches("#recruitment .recruit-intro")||el.matches("#recruitment #recruitActionCard"))return true;
    if(el.matches("#recruitment .recruitment-process")){
      sequence(el,".process-step",i=>i%2?"right":"left",
        {step:125,base:0,max:4,duration:1070});return true;
    }
    return false;
  }
  // Secondary content enters on scroll. It never rearranges information.
  const watchSelectors={
    about:".experience-layout",
    activities:".session-list",
    people:".team-node",
    recruitment:".recruitment-process,.recruitment-faq-heading,.process-step",
    updates:".cms-card"
  };
  const intersection=typeof IntersectionObserver!=="undefined"
    ?new IntersectionObserver(entries=>{
      for(const {target,isIntersecting} of entries){
        if(!isIntersecting)continue;
        intersection.unobserve(target);
        if(reduced()||!target.closest(".view.active"))continue;
        if(target.matches(".team-node")){
          const i=[...target.parentElement.children].indexOf(target);
          gather(target,i%2?"right":"left",Math.min(i*85,250),1060,.60);
        }else if(target.matches(".experience-layout")){
          gather(target.querySelector(".experience-selector"),"left",0,1050,.56);
          gather(target.querySelector(".experience-panel"),"right",190,1160,.56);
        }else if(target.matches(".recruitment-process")){
          sequence(target,".process-step",i=>i%2?"right":"left",{base:90,step:120,duration:1020});
        }else if(target.matches(".recruitment-faq-heading")){
          gather(target,"left",0,920,.60);
        }else if(target.matches(".session-list")){
          // The top rows have the route-composition reveal. The list itself
          // stays static so expanded content and filter state are preserved.
        }else if(target.matches(".cms-card")){
          gather(target,"up",0,920,.65);
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
    const step=(el,frames,duration=790,delay=0)=>{
      const a=tween(el,frames,duration,delay);
      if(a)stageAnimations.push(a);
    };
    const highlight=[{opacity:.3,transform:"translateY(8px)"},{opacity:1,transform:"none"}];
    if(index===0){
      [...group.querySelectorAll("path[stroke]")].forEach((path,i)=>{
        let length=0;try{length=path.getTotalLength()}catch(_){}
        if(length<1)return;
        step(path,[{opacity:.55,strokeDasharray:length+" "+length,strokeDashoffset:length},
          {opacity:1,strokeDasharray:length+" "+length,strokeDashoffset:0}],940,i*105);
      });
      [...group.querySelectorAll("rect,circle")].slice(0,4).forEach((r,i)=>
        step(r,highlight,780,160+i*110));
    }else if(index===1){
      [...group.querySelectorAll("rect")].forEach((r,i)=>
        step(r,[{opacity:.35,transform:"translateY(8px)"},{opacity:1,transform:"none"}],840,i*110));
      [...group.querySelectorAll("path[stroke]")].forEach((p,i)=>
        step(p,highlight,950,220+i*100));
    }else if(index===2){
      [...group.querySelectorAll("path[stroke]")].forEach((p,i)=>step(p,highlight,1020,i*120));
      [...group.querySelectorAll("rect[stroke]")].slice(0,3).forEach((r,i)=>
        step(r,[{opacity:.42},{opacity:1}],800,240+i*105));
    }else if(index===3){
      [...group.querySelectorAll("rect")].slice(0,4).forEach((r,i)=>
        step(r,[{opacity:.40,transform:"translateY(10px)"},{opacity:1,transform:"none"}],930,i*100));
      [...group.querySelectorAll("path[stroke]")].slice(0,4).forEach((p,i)=>
        step(p,[{opacity:.35},{opacity:1}],800,240+i*95));
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
