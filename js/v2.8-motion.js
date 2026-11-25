"use strict";
/* SFC v2.8 / motion choreography
 * One signature motion per page. No content is gated behind animation.
 * All state changes are rendered by the existing modules before decoration.
 */
(function(){
  const motion=window.SFC_MOTION;
  const ease="cubic-bezier(.22,1,.36,1)";
  const reduced=()=>motion?.reduced?.()||false;
  const entered=new WeakSet();
  const lists=new WeakSet();
  const observed=new WeakSet();
  const elements=new WeakSet();
  const activeStageAnimations=[];
  const roleObserver="IntersectionObserver" in window
    ?new IntersectionObserver(entries=>{
       for(const entry of entries){
         if(!entry.isIntersecting)continue;
         roleObserver.unobserve(entry.target);
         if(reduced())continue;
         const label=entry.target.querySelector(".team-node-index");
         soft(label,[{opacity:.62,transform:"translateY(2px)"},{opacity:1,transform:"none"}],220);
       }
     },{threshold:.12}):null;

  function soft(el,frames,duration=280,delay=0){
    if(!el||reduced()||!el.animate||!el.getClientRects().length)return null;
    // Does not retain filled styles: cancellation, tab switches and reduced
    // motion always leave content in the fully readable DOM state.
    return el.animate(frames,{duration,delay,easing:ease});
  }
  function showOnce(el){
    if(!el||elements.has(el))return false;
    elements.add(el);return true;
  }
  function enter(root){
    if(!root||entered.has(root))return;
    entered.add(root);
    if(root.id==="home"){
      const h=document.getElementById("heroHeading");
      const p=document.getElementById("heroDescription");
      const c=document.getElementById("heroButton");
      soft(h,[{opacity:.72,transform:"translateY(6px)"},{opacity:1,transform:"none"}],440);
      soft(p,[{opacity:.77},{opacity:1}],310,70);
      soft(c,[{opacity:.78,transform:"translateY(3px)"},{opacity:1,transform:"none"}],300,115);
    }else if(root.id==="research"){
      requestAnimationFrame(()=>firstList(document.getElementById("archiveResults"),".archive-report",4));
    }else if(root.id==="updates"){
      requestAnimationFrame(()=>firstList(document.getElementById("updatesList"),".cms-card",3));
    }else if(root.id==="people"){
      people();
    }
  }
  function slide(copy){
    // Only the changed copy settles; the photo is already crossfading.
    soft(copy,[{opacity:.62,transform:"translateY(3px)"},{opacity:1,transform:"none"}],350);
  }
  function visible(el){
    if(!el)return false;
    if(el.id==="heroHeading")return true; // Handled by enter(home).
    if(el.matches("#home .home-value-copy")){
      const heading=el.querySelector("h2");
      soft(heading,[{opacity:.78,transform:"translateY(4px)"},{opacity:1,transform:"none"}],360);
      return true;
    }
    if(el.matches("#home .home-section")){
      const link=el.querySelector(".featured-copy .line-link");
      soft(link,[{opacity:.7,transform:"translateX(-3px)"},{opacity:1,transform:"none"}],300);
      return true;
    }
    if(el.matches("#home .process-layout")){
      const numbers=[...el.querySelectorAll(".process-point>span")];
      numbers.forEach((n,i)=>soft(n,[{opacity:.6},{opacity:1}],230,Math.min(i*40,100)));
      return true;
    }
    if(el.matches("#home .join-layout"))return true;
    if(el.matches("#about .about-photo-panel")){
      const heading=el.querySelector("h2");
      soft(heading,[{opacity:.8},{opacity:1}],350);
      [...el.querySelectorAll(".about-approved-copy .about-line")].forEach((row,i)=>{
        soft(row,[{opacity:.75},{opacity:1}],290,i*48);
      });
      return true;
    }
    if(el.matches("#about .about-reason")){
      const svg=el.querySelector("svg");
      const target=svg?.querySelector("path[stroke],rect[stroke]");
      soft(target,[{opacity:.5},{opacity:1}],270);
      return true;
    }
    if(el.matches("#people .people-editorial-lead")||el.matches("#people .people-next-link"))return true;
    if(el.matches("#recruitment .recruit-intro")){
      [...el.querySelectorAll(".recruit-fact")].forEach((fact,i)=>{
        soft(fact,[{borderColor:"#e6edf0"},{borderColor:"#c4d2da"}],240,i*35);
      });
      return true;
    }
    if(el.matches("#recruitment #recruitActionCard"))return true;
    // Only information-revealing interactions receive meaningful motion.
    return false;
  }
  function firstList(root,selector,cap){
    if(!root||lists.has(root)||!root.closest(".view.active"))return;
    const cards=[...root.querySelectorAll(selector)].slice(0,cap);
    if(!cards.length)return; // CMS can populate a hidden or initially empty list.
    lists.add(root);
    cards.forEach((el,i)=>{
      soft(el,[{opacity:.82,transform:"translateY(3px)"},{opacity:1,transform:"none"}],
        240,Math.min(i*32,110));
    });
  }
  function people(){
    const root=document.getElementById("roleList");
    if(!root)return;
    for(const card of root.querySelectorAll(".team-node")){
      if(!showOnce(card))continue;
      if(roleObserver)roleObserver.observe(card);
      else if(!reduced())soft(card.querySelector(".team-node-index"),[{opacity:.65},{opacity:1}],180);
    }
  }
  function stage(index){
    // SVG paths have a different semantic role in each of the four stages.
    activeStageAnimations.splice(0).forEach(a=>{try{a.cancel()}catch(_){}});
    if(reduced())return;
    const group=document.querySelector('[data-experience-visual="'+index+'"]');
    if(!group)return;
    const animate=(el,frames,duration=340,delay=0)=>{
      const anim=soft(el,frames,duration,delay);
      if(anim)activeStageAnimations.push(anim);
    };
    const opacity=[{opacity:.55},{opacity:1}];
    if(index===0){
      const paths=[...group.querySelectorAll("path[stroke]")];
      for(const path of paths){
        // Preserve the original SVG geometry: briefly draw its connections.
        if(typeof path.getTotalLength!=="function")continue;
        let len=0;try{len=path.getTotalLength()}catch(_){}
        if(len<1)continue;
        animate(path,[
          {opacity:.8,strokeDasharray:len+" "+len,strokeDashoffset:len},
          {opacity:1,strokeDasharray:len+" "+len,strokeDashoffset:0}
        ],410);
      }
    }else if(index===1){
      [...group.querySelectorAll("rect")].forEach((r,i)=>animate(r,opacity,270,i*38));
      [...group.querySelectorAll("path[stroke]")].forEach((p,i)=>animate(p,opacity,340,95+i*28));
    }else if(index===2){
      [...group.querySelectorAll("path[stroke]")].slice(0,2)
        .forEach((p,i)=>animate(p,opacity,330,i*100));
      const frame=group.querySelector("rect[stroke]");
      animate(frame,[{opacity:.5},{opacity:1}],280,140);
    }else if(index===3){
      const sheets=[...group.querySelectorAll("rect")].slice(0,2);
      sheets.forEach((r,i)=>animate(r,[{opacity:.7,transform:"translateY(2px)"},{opacity:1,transform:"none"}],320,i*70));
      [...group.querySelectorAll("path[stroke]")].slice(0,2)
        .forEach((p,i)=>animate(p,opacity,270,90+i*45));
    }
  }
  function recruitment(action){
    if(!action||reduced())return;
    const state=action.dataset.state;
    if(!action.dataset.v28State){action.dataset.v28State=state;return;}
    if(action.dataset.v28State===state)return;
    action.dataset.v28State=state;
    // State, CTA text and behavior are already synchronous; this only
    // makes the resulting surface color feel settled.
    soft(action,[{filter:"brightness(1.035)"},{filter:"brightness(1)"}],200);
  }

  window.SFC_V28=Object.freeze({enter,visible,slide,stage,people,firstList,recruitment});
})();
