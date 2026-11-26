"use strict";
/* SFC v2.8.4: One shared optical tempo, seven different page signatures.
 * Shared: 0->1 opacity in ~1.2s, backwards fill during entrance delays,
 * interruptions cancel. Unique: image/typography, diagrams, spatial reflow,
 * weekly timeline, typeset index, facts/steps, publication ink.
 * This module NEVER rewrites editorial text, CMS state or navigation.
 */
(function(){
  const motion=window.SFC_MOTION;
  const reduced=()=>motion?.reduced?.()||false;
  const ease="cubic-bezier(.40,0,.20,1)";
  const moving=new WeakMap();
  const stages=[];
  const enteredLists=new WeakSet();
  const watched=new WeakSet();
  let scene=[];
  const mobile=()=>innerWidth<760;
  const opt=(duration=1190,delay=0)=>({duration,delay,easing:ease,fill:"backwards"});
  function animate(el,frames,duration=1190,delay=0){
    if(!el||reduced()||!el.animate||!el.getClientRects().length)return null;
    const old=moving.get(el);
    try{old?.cancel()}catch(_){}
    const animation=el.animate(frames,opt(duration,delay));
    moving.set(el,animation);
    animation.finished.then(()=>{
      if(moving.get(el)===animation)moving.delete(el);
    },()=>{});
    return animation;
  }
  function track(animation){if(animation)scene.push(animation);return animation}
  function fade(el,d=1000,delay=0){
    return animate(el,[
      {opacity:0,offset:0},{opacity:.12,offset:.23},
      {opacity:.68,offset:.68},{opacity:1,offset:1}
    ],d,delay);
  }
  function float(el,d=1170,delay=0,from=21){
    const y=mobile()?Math.min(from,12):from;
    return animate(el,[
      {opacity:0,transform:`translate3d(0,${y}px,0)`,offset:0},
      {opacity:.17,transform:`translate3d(0,${y*.8}px,0)`,offset:.28},
      {opacity:.78,transform:"translate3d(0,2px,0)",offset:.78},
      {opacity:1,transform:"none",offset:1}
    ],d,delay);
  }
  // Text rises INSIDE a local mask (no off-canvas zigzag).
  function typeMask(el,d=1220,delay=0){
    return animate(el,[
      {opacity:0,clipPath:"inset(90% 0 0 0)",offset:0},
      {opacity:.20,clipPath:"inset(70% 0 0 0)",offset:.27},
      {opacity:.76,clipPath:"inset(8% 0 0 0)",offset:.79},
      {opacity:1,clipPath:"inset(0 0 0 0)",offset:1}
    ],d,delay);
  }
  // Information is 'printed' left-to-right: no object translation.
  function ink(el,d=1190,delay=0){
    return animate(el,[
      {opacity:0,clipPath:"inset(0 100% 0 0)",offset:0},
      {opacity:.28,clipPath:"inset(0 76% 0 0)",offset:.34},
      {opacity:.84,clipPath:"inset(0 11% 0 0)",offset:.82},
      {opacity:1,clipPath:"inset(0 0 0 0)",offset:1}
    ],d,delay);
  }
  // Editorial rows open down the reading flow.
  function dropReveal(el,d=1150,delay=0){
    return animate(el,[
      {opacity:0,clipPath:"inset(0 0 100% 0)",offset:0},
      {opacity:.18,clipPath:"inset(0 0 75% 0)",offset:.28},
      {opacity:.78,clipPath:"inset(0 0 12% 0)",offset:.76},
      {opacity:1,clipPath:"inset(0 0 0 0)",offset:1}
    ],d,delay);
  }
  // Center-out expansion of factual groups; geometry and column widths stay fixed.
  function bloom(el,d=1240,delay=0){
    return animate(el,[
      {opacity:0,clipPath:"inset(45% 43% 45% 43%)",transform:"scale(.973)",offset:0},
      {opacity:.17,clipPath:"inset(33% 28% 33% 28%)",transform:"scale(.984)",offset:.30},
      {opacity:.76,clipPath:"inset(5% 3% 5% 3%)",transform:"scale(.997)",offset:.79},
      {opacity:1,clipPath:"inset(0 0 0 0)",transform:"none",offset:1}
    ],d,delay);
  }
  function sweep(el,d=1160,delay=0){
    return animate(el,[
      {opacity:0,clipPath:"inset(0 54% 0 46%)",offset:0},
      {opacity:.20,clipPath:"inset(0 39% 0 30%)",offset:.32},
      {opacity:.76,clipPath:"inset(0 6% 0 5%)",offset:.77},
      {opacity:1,clipPath:"inset(0 0 0 0)",offset:1}
    ],d,delay);
  }
  function signature(root){
    if(!root||reduced())return;
    const head=root.querySelector(".page-head");
    if(!head)return;
    const label=head.querySelector(".eyebrow"),title=head.querySelector("h1"),copy=head.querySelector("p");
    // Shared baseline is opacity, not identical geometry or entrance direction.
    track(fade(label,680,40));
    switch(root.id){
      case "about":
        track(ink(title,1220,90));
        track(float(copy,970,180,7));
        break;
      case "research":
        track(dropReveal(title,1090,70));
        track(fade(copy,950,140));
        break;
      case "activities":
        track(float(title,1110,100,13));
        track(fade(copy,990,140));
        break;
      case "people":
        track(ink(title,1180,90));
        track(ink(copy,1160,210));
        break;
      case "recruitment":
        track(bloom(title,1190,100));
        track(fade(copy,950,220));
        break;
      case "updates":
        track(ink(title,1180,105));
        track(dropReveal(copy,1050,170));
        break;
      default:
        track(typeMask(title,1180,90));
        track(fade(copy,1000,180));
    }
  }
  const PAGE_SHAPE=Object.freeze({
    home:"photographic-typographic-mask",
    about:"diagram-connect-and-column-reveal",
    research:"workspace-expand-and-spatial-flip",
    activities:"fifteen-week-timeline-drop",
    people:"typographic-index-print",
    recruitment:"fact-grid-center-bloom",
    updates:"publication-line-ink"
  });
  function enter(root){
    if(!root)return;
    for(const a of scene){try{a.cancel()}catch(_){}}
    scene=[];
    if(reduced())return;
    // The same optical softness opens all pages, not the same stagger/slide.
    track(animate(root,[{opacity:.43},{opacity:.82,offset:.72},{opacity:1}],1100));
    root.dataset.motionSignature=PAGE_SHAPE[root.id]||"reader";
    signature(root);
    switch(root.id){
      case "home":
        track(fade(root.querySelector(".hero-top"),890,50));
        track(typeMask(root.querySelector("#heroHeading"),1260,70));
        track(fade(root.querySelector("#heroNumber"),860,90));
        track(typeMask(root.querySelector("#heroDescription"),1050,240));
        track(float(root.querySelector("#heroButton"),1090,290,14));
        track(ink(root.querySelector(".hero-controls"),1120,280));
        // Preserve all existing pictures; only apply a subtle first-view
        // exposure that never changes their identity or position.
        track(animate(root.querySelector(".hero-photo.active"),[
          {filter:"brightness(.86)",opacity:.75},
          {filter:"brightness(1)",opacity:1}
        ],1180));
        break;
      case "about":{
        const panel=root.querySelector(".about-photo-panel");
        track(sweep(panel,1280,140));
        track(typeMask(panel?.querySelector("h2"),1280,160));
        [...(panel?.querySelectorAll(".about-approved-copy .about-line")||[])].forEach((line,i)=>
          track(ink(line,1150,210+i*95)));
        // The active analytical diagram should demonstrate its own meaning
        // immediately on visiting About, not only after a tab click.
        requestAnimationFrame(()=>{
          if(root.classList?.contains("active")){
            const selected=root.querySelector('[data-experience-step][aria-selected="true"]');
            stage(Number(selected?.dataset.experienceStep||0));
          }
        });
        break;
      }
      case "research":{
        track(ink(root.querySelector(".archive-intro"),980,160));
        track(sweep(root.querySelector(".archive-search-row"),1120,130));
        track(bloom(root.querySelector(".archive-controls"),1150,210));
        requestAnimationFrame(()=>firstList(root.querySelector("#archiveResults"),".archive-report",4));
        break;
      }
      case "activities":{
        track(dropReveal(root.querySelector(".schedule-header"),1000,180));
        track(sweep(root.querySelector("#journeyContext"),1130,180));
        const buttons=[...root.querySelectorAll("#scheduleTabs button")];
        buttons.forEach((button,i)=>track(bloom(button,1060,215+i*60)));
        const rows=[...root.querySelectorAll("#scheduleList>.session:not([hidden]),#scheduleList>.cms-session:not([hidden])")].slice(0,4);
        rows.forEach((row,i)=>track(dropReveal(row,1110,350+i*130)));
        break;
      }
      case "people":
        track(typeMask(root.querySelector(".people-editorial-lead h2"),1120,140));
        track(fade(root.querySelector(".people-editorial-lead p"),1050,190));
        people();
        break;
      case "recruitment":{
        track(typeMask(root.querySelector(".recruit-intro-copy h2"),1170,130));
        track(fade(root.querySelector("#recruitMessage"),990,210));
        [...root.querySelectorAll(".recruit-fact")].forEach((fact,i)=>
          track(bloom(fact,1140,160+i*86)));
        track(dropReveal(root.querySelector("#recruitActionCard"),1190,300));
        break;
      }
      case "updates":
        track(ink(root.querySelector(".updates-section-heading"),930,180));
        track(sweep(root.querySelector("#updatesFilters"),1080,250));
        requestAnimationFrame(()=>firstList(root.querySelector("#updatesList"),".cms-card",4));
        break;
      default:
        track(typeMask(root.querySelector(".cms-post-head h1,.detail-masthead h1"),1150,120));
        track(fade(root.querySelector(".reader-layout,.detail-body"),1100,190));
    }
    watch(root);
  }
  // User-triggered slider changes should remain shorter than first page entry.
  function slide(el){typeMask(el,930,0)}
  function visible(el){
    if(!el)return false;
    if(el.matches(".page-head")||el.id==="heroHeading")return true;
    if(el.matches("#home .home-value-copy")){
      typeMask(el.querySelector("h2"),1260);
      fade(el.querySelector("p"),1050,80);
      ink(el.querySelector(".home-value-link"),970,200);
      return true;
    }
    if(el.matches("#home .home-section")){
      ink(el.querySelector(".section-head"),1000);
      sweep(el.querySelector(".featured-photo"),1210,90);
      dropReveal(el.querySelector(".featured-copy"),1120,190);
      return true;
    }
    if(el.matches("#home .process-layout")){
      ink(el.querySelector("h2"),1100);
      [...el.querySelectorAll(".process-point")].forEach((point,i)=>
        dropReveal(point,980,100+i*115));
      return true;
    }
    if(el.matches("#home .join-layout")){
      sweep(el,1150);return true;
    }
    if(el.matches("#about .about-photo-panel"))return true; // enter() handles panel
    if(el.matches("#about .about-reason")){
      const svg=el.querySelector(".reason-art svg");
      bloom(svg,1090,60);
      dropReveal(el.querySelector("h3"),940,180);
      fade(el.querySelector("p"),900,220);
      return true;
    }
    if(el.matches("#about .about-section-heading")){
      ink(el,1000);return true;
    }
    if(el.matches("#people .people-editorial-lead"))return true;
    if(el.matches("#people .people-next-link")){
      ink(el,1100);return true;
    }
    if(el.matches("#recruitment .recruit-intro,#recruitment #recruitActionCard"))return true;
    if(el.matches("#recruitment .recruitment-process")){
      processSteps(el);return true;
    }
    return false;
  }
  // Search/filters are spatial; the results are editorial shelves, not zig-zags.
  function firstList(root,selector,cap=4){
    if(!root||enteredLists.has(root)||!root.closest(".view.active"))return;
    const rows=[...root.querySelectorAll(selector)].slice(0,cap);
    if(!rows.length)return;
    enteredLists.add(root);
    rows.forEach((el,i)=>{
      if(root.closest("#research"))dropReveal(el,1090,i*110);
      else ink(el,1070,i*125);
    });
  }
  function processSteps(root){
    if(!root)return;
    [...root.querySelectorAll(".process-step")].forEach((el,i)=>{
      bloom(el,1110,i*110);
      ink(el.querySelector(".process-step-no"),930,130+i*105);
    });
  }
  const watcher=typeof IntersectionObserver!=="undefined"
    ?new IntersectionObserver(entries=>{
      for(const ent of entries){
        if(!ent.isIntersecting)continue;
        watcher.unobserve(ent.target);
        if(reduced()||!ent.target.closest(".view.active"))continue;
        const el=ent.target;
        if(el.matches("#people .team-node")){
          ink(el,1190,0);
          const label=el.querySelector(".team-node-index");
          fade(label,870,120);
        }else if(el.matches("#about .experience-layout")){
          sweep(el.querySelector(".experience-figure"),1190,70);
          dropReveal(el.querySelector(".experience-description"),1110,220);
        }else if(el.matches("#recruitment .recruitment-process")){
          processSteps(el);
        }else if(el.matches("#recruitment .recruitment-faq-heading")){
          ink(el,1050);
        }
      }
    },{threshold:.08,rootMargin:"0px 0px -6% 0px"}):null;
  function watch(root){
    if(!root||!watcher)return;
    const selectors={
      about:".experience-layout",
      people:".team-node",
      recruitment:".recruitment-process,.recruitment-faq-heading"
    };
    const query=selectors[root.id];
    if(!query)return;
    root.querySelectorAll(query).forEach(el=>{
      if(watched.has(el))return;
      watched.add(el);watcher.observe(el);
    });
  }
  function people(){watch(document.getElementById("people"))}
  // Four analytical diagrams receive four distinct semantic motions.
  function stage(index){
    stages.splice(0).forEach(a=>{try{a.cancel()}catch(_){}});
    if(reduced())return;
    const group=document.querySelector('[data-experience-visual="'+index+'"]');
    if(!group)return;
    const add=a=>{if(a)stages.push(a)};
    const pathDraw=(el,d=790,delay=0)=>{
      let length=0;
      try{length=el.getTotalLength()}catch(_){}
      if(!(length>0))return;
      add(animate(el,[
        {opacity:0,strokeDasharray:length+" "+length,strokeDashoffset:length},
        {opacity:.54,strokeDasharray:length+" "+length,strokeDashoffset:length*.25,offset:.69},
        {opacity:1,strokeDasharray:length+" "+length,strokeDashoffset:0}
      ],d,delay));
    };
    switch(index){
      case 0: // Observe: node boxes, then edges connect the relationships.
        [...group.querySelectorAll("rect")].forEach((el,i)=>add(bloom(el,850,i*105)));
        [...group.querySelectorAll("path[stroke]")].forEach((el,i)=>pathDraw(el,850,220+i*80));
        break;
      case 1: // Analyze: financial bars rise from their baseline; trend follows.
        [...group.querySelectorAll("rect")].forEach((el,i)=>
          add(animate(el,[
            {opacity:0,transform:"translateY(15px) scaleY(.65)",offset:0},
            {opacity:1,transform:"none",offset:1}
          ],800,i*85)));
        [...group.querySelectorAll("path[stroke]")].forEach((el,i)=>pathDraw(el,850,260+i*80));
        break;
      case 2: // Value: compare 2 distinct estimated-value trajectories.
        [...group.querySelectorAll("path[stroke]")].forEach((el,i)=>pathDraw(el,950,i*145));
        add(bloom(group.querySelector("rect[stroke]"),800,270));
        break;
      case 3: // Defend: report pages layer front to back, then evidence lines.
        [...group.querySelectorAll("rect")].forEach((el,i)=>add(dropReveal(el,870,i*120)));
        [...group.querySelectorAll("path[stroke]")].forEach((el,i)=>pathDraw(el,870,300+i*75));
        break;
    }
  }
  function recruitment(action){
    if(!action)return;
    const state=action.dataset.state;
    if(!action.dataset.v28State){action.dataset.v28State=state;return}
    if(action.dataset.v28State===state)return;
    action.dataset.v28State=state;
    animate(action,[{filter:"brightness(1.045)"},{filter:"brightness(1)"}],380);
  }
  const api=Object.freeze({enter,visible,slide,stage,people,firstList,recruitment,
    signatures:PAGE_SHAPE});
  window.SFC_V28=api;
})();
