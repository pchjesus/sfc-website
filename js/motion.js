"use strict";
/* Shared motion system: persistent controls, keyed reflow, visible-only animation. */
(function(){
  const media=matchMedia("(prefers-reduced-motion: reduce)");
  const ease="cubic-bezier(.4,0,.2,1)";
  const timing=Object.freeze({page:520,recruitment:570,reveal:780,unveil:950,layout:550,modal:410,close:300,hero:720});
  let pageAnimation=null;
  const running=new WeakMap();
  const handlers=new WeakMap();
  const seen=new WeakSet();
  let observer;
  const reduced=()=>media.matches;
  function play(el,frames,options){
    if(reduced()||!el.animate)return null;
    return el.animate(frames,{easing:ease,...options});
  }
  function stop(root){
    const state=running.get(root);
    if(!state)return;
    state.animations.forEach(a=>a.cancel());
    state.ghosts.forEach(el=>el.remove());
    running.delete(root);
  }
  function capture(root){
    const map=new Map();
    [...root.children].forEach(el=>{
      if(el.dataset.motionKey)map.set(el.dataset.motionKey,{el,rect:el.getBoundingClientRect(),opacity:Number(getComputedStyle(el).opacity)});
    });
    return {rect:root.getBoundingClientRect(),map};
  }
  function transition(root,mutate,{animate=true,exit=true}={}){
    const before=capture(root),interrupted=running.has(root);
    const can=animate&&!reduced()&&root.getClientRects().length>0&&before.rect.width>0&&before.map.size>0;
    // Snapshot the old list in its original layout, not individual fixed-position
    // buttons. This keeps the grid/typography intact in disjoint filter swaps.
    const snapshot=can&&exit&&!interrupted?root.cloneNode(true):null;
    stop(root);
    mutate();
    if(!can)return;
    const after=capture(root),animations=[],ghosts=[];
    const run=(el,frames,opts)=>{const a=play(el,frames,opts);if(a)animations.push(a);return a};
    const retained=[...after.map.keys()].filter(k=>before.map.has(k));
    const removed=[...before.map.keys()].filter(k=>!after.map.has(k));
    const added=[...after.map.keys()].filter(k=>!before.map.has(k));
    const disjoint=retained.length===0;
    if(snapshot&&removed.length){
      snapshot.removeAttribute("id");
      snapshot.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
      snapshot.classList.add("motion-snapshot");
      snapshot.dataset.motionSnapshot="true";
      snapshot.inert=true;snapshot.setAttribute("aria-hidden","true");
      // Shared rows stay real and travel; only removed rows appear in the exit layer.
      [...snapshot.children].forEach(el=>{
        if(!removed.includes(el.dataset.motionKey))el.style.visibility="hidden";
      });
      const wrapper=document.createElement("div");
      wrapper.className="motion-snapshot-layer";
      wrapper.inert=true;wrapper.setAttribute("aria-hidden","true");
      Object.assign(wrapper.style,{top:(before.rect.top+scrollY)+"px",left:(before.rect.left+scrollX)+"px",width:before.rect.width+"px",height:before.rect.height+"px"});
      Object.assign(snapshot.style,{width:"100%",margin:"0",height:"auto",transform:"none"});
      wrapper.append(snapshot);document.body.append(wrapper);ghosts.push(wrapper);
      // Direction-independent dissolve, so A→B and B→A are identical in rhythm.
      const a=run(wrapper,[{opacity:1,offset:0},{opacity:0,offset:.48},{opacity:0,offset:1}],{duration:timing.layout,fill:"forwards"});
      a?.finished.then(()=>wrapper.remove(),()=>wrapper.remove());
    }
    for(const [key,next] of after.map){
      const old=before.map.get(key);
      if(old){
        const dx=old.rect.left-next.rect.left,dy=old.rect.top-next.rect.top;
        if(Math.abs(dx)+Math.abs(dy)>1||old.opacity<.99)
          run(next.el,[{transform:"translate("+dx+"px,"+dy+"px)",opacity:old.opacity},{transform:"translate(0,0)",opacity:1}],{duration:timing.layout});
      }else{
        // No vertical replacement gesture for unrelated results, irrespective
        // of whether their counts are equal or different.
        const move=disjoint?"none":"translateY(6px)";
        run(next.el,[{opacity:0,transform:move,offset:0},{opacity:0,transform:move,offset:interrupted?.12:.30},{opacity:1,transform:"none",offset:1}],{duration:timing.layout,fill:"backwards"});
      }
    }
    if(Math.abs(before.rect.height-after.rect.height)>1){
      run(root,[{height:before.rect.height+"px"},{height:after.rect.height+"px"}],{duration:timing.layout});
    }
    const state={animations,ghosts};running.set(root,state);
    Promise.allSettled(animations.map(a=>a.finished)).then(()=>{
      if(running.get(root)===state){ghosts.forEach(x=>x.remove());running.delete(root);}
    });
  }
  function reconcile(root,nodes,opts={}){
    const focus=document.activeElement,inside=root.contains(focus);
    const focusKey=inside?focus.closest("[data-motion-key]")?.dataset.motionKey:null;
    transition(root,()=>{
      const existing=new Map([...root.children].filter(x=>x.dataset.motionKey).map(x=>[x.dataset.motionKey,x]));
      const wanted=new Set();
      nodes.forEach((node,i)=>{
        const key=node.dataset.motionKey;
        const prior=existing.get(key);
        const chosen=opts.reuse===false?node:opts.reuse==="equal"?(prior?.isEqualNode(node)?prior:node):prior||node;
        wanted.add(chosen);
        if(root.children[i]!==chosen)root.insertBefore(chosen,root.children[i]||null);
      });
      [...root.children].forEach(node=>{if(!wanted.has(node))node.remove();});
    },opts);
    if(inside&&focusKey&&!root.contains(document.activeElement)){
      const row=[...root.children].find(x=>x.dataset.motionKey===focusKey);
      const next=row?.matches("button,a,input")?row:row?.querySelector("button,a,input");
      next?.focus({preventScroll:true});
    }
  }
  // Curriculum-only filtering: keep a single instance of every session in
  // document order. No FLIP translateX, no ghost clones, no DOM regeneration.
  const filterAnimations=new WeakMap();
  function filterRows(root,stage){
    if(!root)return;
    const first=root.dataset.filtered!=="true";
    const canAnimate=!first&&!reduced()&&root.getClientRects().length>0;
    const nowActive=el=>stage==="all"||el.dataset.stage===stage;
    for(const row of [...root.children]){
      const desired=nowActive(row);
      const priorActive=row.dataset.active==="true";
      const running=filterAnimations.get(row);
      if(!first&&desired===priorActive)continue;
      row.dataset.active=String(desired);
      row.inert=!desired;
      row.setAttribute("aria-hidden",String(!desired));
      if(first||!canAnimate){
        running?.cancel();
        filterAnimations.delete(row);
        row.hidden=!desired;
        row.style.overflow="";
        continue;
      }
      const current=running&&!row.hidden?row.getBoundingClientRect().height:null;
      const startOpacity=running?Number(getComputedStyle(row).opacity):desired?0:1;
      running?.cancel();
      row.hidden=false;row.style.overflow="";
      // Compute target height in normal flow. Existing expanded accordions
      // remain expanded, and their height is not guessed via max-height.
      const natural=row.getBoundingClientRect().height;
      const start=Number.isFinite(current)?current:(desired?0:natural);
      const end=desired?natural:0;
      const animation=play(row,[
        {height:start+"px",opacity:startOpacity},
        {height:end+"px",opacity:desired?1:0}
      ],{duration:timing.layout,fill:"both"});
      if(!animation){row.hidden=!desired;continue;}
      filterAnimations.set(row,animation);
      row.style.overflow="hidden";
      animation.finished.then(()=>{
        if(filterAnimations.get(row)!==animation)return;
        filterAnimations.delete(row);
        row.hidden=!desired;
        row.style.overflow="";
        // A finished fill:both WAAPI animation remains visible to
        // getAnimations() and may retain layout effects until canceled.
        animation.cancel();
      },()=>{});
    }
    root.dataset.filtered="true";
  }
  function controls(root,items,current,onSelect){
    handlers.set(root,onSelect);
    const key=JSON.stringify(items);
    if(root.dataset.controlKey!==key){
      root.replaceChildren();
      items.forEach(([value,label])=>{
        const button=document.createElement("button");button.type="button";button.dataset.value=value;button.textContent=label;
        if(root.classList.contains("cms-filters"))button.classList.add("cms-filter");
        button.addEventListener("click",()=>handlers.get(root)?.(value));root.append(button);
      });
      root.dataset.controlKey=key;
    }
    root.querySelectorAll("button").forEach(button=>{
      const on=button.dataset.value===current;
      button.classList.toggle("selected",on);button.classList.toggle("active",on);
      button.setAttribute("aria-pressed",String(on));
    });
    root.classList.add("motion-controls");
    const active=root.querySelector('[aria-pressed="true"]');
    if(active){
      const rr=root.getBoundingClientRect(),br=active.getBoundingClientRect();
      root.style.setProperty("--indicator-x",(br.left-rr.left+root.scrollLeft)+"px");
      root.style.setProperty("--indicator-w",br.width+"px");
    }
  }
  function accordion(root,selector,active){
    root.querySelectorAll(selector).forEach(row=>{
      const on=row===active;
      row.classList.toggle("open",on);
      const b=row.querySelector("button");
      const panel=b?.getAttribute("aria-controls")?document.getElementById(b.getAttribute("aria-controls")):null;
      b?.setAttribute("aria-expanded",String(on));
      if(panel){panel.setAttribute("aria-hidden",String(!on));panel.inert=!on;}
    });
  }
  function reveal(root=document.querySelector(".view.active")){
    if(!root)return;
    if(!observer&&"IntersectionObserver" in window)observer=new IntersectionObserver(entries=>{
      for(const e of entries)if(e.isIntersecting){
        const el=e.target;observer.unobserve(el);
        if(seen.has(el))continue;seen.add(el);
        el.classList.add("visible");
        let kind=el.dataset.motion||"rise";
        if(innerWidth<760&&(kind==="left"||kind==="right"))kind="rise";
        const starts={rise:"translateY(14px)",left:"translateX(-18px)",right:"translateX(18px)",scale:"scale(.985)",fade:"translateY(0)"};
        const recruitment=el.closest("#recruitment");
        const duration=recruitment?timing.recruitment:timing.reveal;
        if(kind==="unveil")play(el,[{opacity:.3,clipPath:"inset(0 0 9% 0)"},{opacity:1,clipPath:"inset(0 0 0 0)"}],{duration:timing.unveil});
        else play(el,[{opacity:.28,transform:starts[kind]||starts.rise},{opacity:1,transform:"none"}],{duration,delay:Math.min((Number(el.dataset.motionDelay)||0)*1.25,150),fill:"backwards"});
      }
    },{threshold:.06});
    root.querySelectorAll(".reveal,[data-motion]").forEach(el=>{
      if(seen.has(el))return;
      if(reduced()||!observer){seen.add(el);el.classList.add("visible");return;}
      observer.observe(el);
    });
    // Re-measure tab underline after hidden pages become visible.
    root.querySelectorAll(".motion-controls").forEach(group=>{
      const a=group.querySelector('[aria-pressed="true"]');
      if(a){const r=group.getBoundingClientRect(),b=a.getBoundingClientRect();group.style.setProperty("--indicator-x",(b.left-r.left+group.scrollLeft)+"px");group.style.setProperty("--indicator-w",b.width+"px");}
    });
  }
  function page(root){
    if(!root)return;
    pageAnimation?.cancel();
    pageAnimation=play(root,[{opacity:.35},{opacity:.85,offset:.58},{opacity:1}],{duration:root.id==="recruitment"?timing.recruitment:timing.page});
    reveal(root);
  }
  window.SFC_MOTION=Object.freeze({reduced,timing,play,reconcile,transition,filterRows,controls,accordion,reveal,page,stop});
  media.addEventListener?.("change",()=>{if(reduced()){document.getAnimations().forEach(a=>a.cancel());document.querySelectorAll(".reveal,[data-motion]").forEach(el=>el.classList.add("visible"));}});
  window.addEventListener("resize",()=>reveal(),{passive:true});
})();
