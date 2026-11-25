import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const script=fs.readFileSync(new URL('../js/v2.8-motion.js',import.meta.url),'utf8');
const calls=[];
let reduced=false;
function el(name){
  return {
    name,
    getClientRects(){return [1]},
    animate(frames,options){
      const entry={name,frames,options,cancelled:false,
        cancel(){this.cancelled=true}};
      calls.push(entry);
      return entry;
    }
  };
}
const dom={
  heroHeading:el('heroHeading'),
  heroDescription:el('heroDescription'),
  heroButton:el('heroButton')
};
const stages=[
  {paths:[Object.assign(el('observe-path'),{getTotalLength:()=>110})],rects:[]},
  {paths:[el('analyze-trend')],rects:[el('analyze-bar-1'),el('analyze-bar-2')]},
  {paths:[el('value-line-1'),el('value-line-2')],rects:[el('value-frame')]},
  {paths:[el('defend-text'),el('defend-guide')],rects:[el('defend-sheet-1'),el('defend-sheet-2')]}
].map((s,i)=>({
  querySelectorAll(selector){
    if(selector==='path[stroke]')return s.paths;
    if(selector==='rect')return s.rects;
    return [];
  },
  querySelector(selector){return selector==='rect[stroke]'?s.rects[0]||null:null}
}));
const sandbox={
  window:{SFC_MOTION:{reduced:()=>reduced}},
  document:{
    getElementById:id=>dom[id]||null,
    querySelector:selector=>{
      const m=selector.match(/data-experience-visual="(\d+)"/);
      return m?stages[Number(m[1])]:null;
    }
  },
  requestAnimationFrame:fn=>fn()
};
vm.runInNewContext(script,sandbox,{filename:'js/v2.8-motion.js'});
const api=sandbox.window.SFC_V28;
assert.ok(Object.isFrozen(api));

const home={id:'home'};
api.enter(home);
assert.deepEqual(calls.map(c=>c.options.duration),[440,310,300]);
assert.deepEqual(calls.map(c=>c.options.delay),[0,70,115]);
api.enter(home);assert.equal(calls.length,3,'Hero intro once per visit');
api.slide(el('slide-copy'));
assert.equal(calls.at(-1).options.duration,275);
const first=calls.length;
api.stage(0);
assert.equal(calls.length,first+1);
assert.equal(calls.at(-1).options.duration,410);
const observed=calls.at(-1);
api.stage(1);
assert.equal(observed.cancelled,true,'switching stage cancels old graphics');
assert.deepEqual(calls.slice(-3).map(c=>c.options.duration),[270,270,340]);
api.stage(2);
assert.equal(calls.at(-1).options.duration,280);
api.stage(3);
assert.ok(calls.slice(-4).some(c=>c.name==='defend-sheet-1'));

const rows=[el('r1'),el('r2'),el('r3'),el('r4')];
const root={
  closest:()=>({}),
  querySelectorAll:()=>rows
};
const before=calls.length;
api.firstList(root,'.archive-report',4);
assert.equal(calls.length-before,4);
api.firstList(root,'.archive-report',4);
assert.equal(calls.length-before,4,'list intro only once');
assert.ok(calls.slice(-4).every(c=>c.options.duration===240));
assert.equal(Math.max(...calls.slice(-4).map(c=>c.options.delay)),96);

const action=Object.assign(el('action'),{dataset:{state:'planned'}});
api.recruitment(action);const count=calls.length;
assert.equal(calls.length,count,'initial planned state is immediate');
action.dataset.state='open';api.recruitment(action);
assert.equal(calls.at(-1).options.duration,200);
api.recruitment(action);
assert.equal(calls.length,count+1,'unchanged state does not replay animation');

reduced=true;
const beforeReduced=calls.length;
api.slide(el('reduced-slide'));
api.stage(1);
api.firstList({closest:()=>({}),querySelectorAll:()=>[el('reduced-card')]},'.archive-report',1);
assert.equal(calls.length,beforeReduced,'reduced motion does not create animation');
console.log('PASS: 28 v2.8 choreography/interrupt/reduced-motion unit assertions');
