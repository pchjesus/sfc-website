"use strict";
/* Shared motion system: persistent controls, keyed reflow, visible-only animation. */
(function(){
  const media=matchMedia("(prefers-reduced-motion: reduce)");
  const ease="cubic-bezier(.22,1,.36,1)";
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
      if(el.dataset.motionKey)map.set(el.dataset.motionKey,{el,rect:el.getBoundingClientRect()});
    });
    return {rect:root.getBoundingClientRect(),map};
  }
  function transition(root,mutate,{animate=true,exit=true}={}){
    const before=capture(root);
    stop(root);
    const can=animate&&!reduced()&&root.getClientRects().length>0&&before.rect.width>0;
    // Clone only disappearing rows, detached from flow and never interactive.
    const ghosts=[];
    mutate();
    if(!can)return;
    const after=capture(root),animations=[];
    const run=(el,frames,opts)=>{const a=play(el,frames,opts);if(a)animations.push(a);return a};
    if(exit){
      let count=0;
      for(const [key,old] of before.map){
        if(after.map.has(key)||count>=12||old.rect.bottom<0||old.rect.top>innerHeight)continue;
        const ghost=old.el.cloneNode(true);
        ghost.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
        ghost.removeAttribute("id");ghost.inert=true;ghost.setAttribute("aria-hidden","true");
        Object.assign(ghost.style,{position:"fixed",top:old.rect.top+"px",left:old.rect.left+"px",width:old.rect.width+"px",height:old.rect.height+"px",margin:"0",zIndex:"9",pointerEvents:"none",overflow:"hidden",background:getComputedStyle(root).backgroundColor==="rgba(0, 0, 0, 0)"?"#fff":getComputedStyle(root).backgroundColor});
        document.body.append(ghost);ghosts.push(ghost);count++;
        const a=run(ghost,[{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(-5px)"}],{duration:160});
        if(a)a.finished.then(()=>ghost.remove(),()=>ghost.remove());else ghost.remove();
      }
    }
    let entering=0;
    for(const [key,next] of after.map){
      const old=before.map.get(key);
      if(old){
        const dx=old.rect.left-next.rect.left,dy=old.rect.top-next.rect.top;
        const sx=next.rect.width?old.rect.width/next.rect.width:1;
        // Position continuity without scaling text during list/grid changes.
        if(Math.abs(dx)+Math.abs(dy)>1||Math.abs(sx-1)>.03)
          run(next.el,[{transform:"translate("+dx+"px,"+dy+"px)"},{transform:"translate(0,0)"}],{duration:340});
      }else if(next.rect.top<innerHeight+100){
        run(next.el,[{opacity:0,transform:"translateY(9px)"},{opacity:1,transform:"translateY(0)"}],{duration:280,delay:Math.min(entering++*24,96),fill:"backwards"});
      }
    }
    if(before.map.size&&Math.abs(before.rect.height-after.rect.height)>2){
      run(root,[{height:before.rect.height+"px"},{height:after.rect.height+"px"}],{duration:340});
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
        const starts={rise:"translateY(18px)",left:"translateX(-24px)",right:"translateX(24px)",scale:"scale(.975)",fade:"translateY(0)"};
        if(kind==="unveil")play(el,[{opacity:.5,clipPath:"inset(0 0 12% 0)"},{opacity:1,clipPath:"inset(0 0 0 0)"}],{duration:610});
        else play(el,[{opacity:.15,transform:starts[kind]||starts.rise},{opacity:1,transform:"none"}],{duration:520,delay:Math.min(Number(el.dataset.motionDelay)||0,120),fill:"backwards"});
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
    play(root,[{opacity:.65,transform:"translateY(5px)"},{opacity:1,transform:"none"}],{duration:320});
    reveal(root);
  }
  window.SFC_MOTION=Object.freeze({reduced,play,reconcile,transition,controls,accordion,reveal,page,stop});
  media.addEventListener?.("change",()=>{if(reduced()){document.getAnimations().forEach(a=>a.cancel());document.querySelectorAll(".reveal,[data-motion]").forEach(el=>el.classList.add("visible"));}});
  window.addEventListener("resize",()=>reveal(),{passive:true});
})();
