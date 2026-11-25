import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../js/v2.8-motion.js',import.meta.url),'utf8');
const calls=[];
let reduced=false;
function el(name){
  return {
    name,dataset:{},
    getClientRects(){return [1]},
    animate(frames,options){
      const call={name,frames,options,cancelled:false,
        finished:Promise.resolve(),
        cancel(){this.cancelled=true}};
      calls.push(call);return call;
    },
    querySelector(selector){return el(name+':'+selector)},
    querySelectorAll(){return []},
    closest(){return {className:'view active'}}
  };
}
const group=[
  {paths:[Object.assign(el('observe-path'),{getTotalLength:()=>110})],rects:[]},
  {paths:[el('analyze-trend')],rects:[el('analyze-bar-1'),el('analyze-bar-2')]},
  {paths:[el('value-line-1'),el('value-line-2')],rects:[el('value-frame')]},
  {paths:[el('defend-text')],rects:[el('defend-sheet-1'),el('defend-sheet-2')]}
].map((s)=>{
  const e=el('stage');
  e.querySelectorAll=selector=>{
    if(selector==='path[stroke]')return s.paths;
    if(selector==='rect'||selector==='rect,circle'||selector==='rect[stroke]')return s.rects;
    return [];
  };
  return e;
});
const sandbox={
  window:{innerWidth:1440,SFC_MOTION:{reduced:()=>reduced}},
  document:{
    getElementById:id=>id==='roleList'?el('roleList'):null,
    querySelector:selector=>{
      const match=selector.match(/data-experience-visual="(\d+)"/);
      return match?group[Number(match[1])]:null;
    }
  },
  requestAnimationFrame:fn=>fn()
};
vm.runInNewContext(code,sandbox,{filename:'js/v2.8-motion.js'});
const motion=sandbox.window.SFC_V28;
assert.ok(Object.isFrozen(motion));
const home=el('home-root');home.id='home';
home.querySelector=s=>el('home:'+s);
motion.enter(home);
assert.equal(calls.filter(c=>c.name==='home-root').at(-1).options.duration,920);
assert.ok(calls.some(c=>c.name==='home:#heroHeading'&&c.options.duration===1190));
assert.ok(calls.some(c=>c.name==='home:#heroDescription'&&c.options.delay===350));
const firstCount=calls.length;
motion.enter(home);
assert.equal(calls.length,firstCount*2,'route revisit must restore composition');
assert.ok(calls.some(c=>c.cancelled),'interrupted animations must be cancelled');
motion.slide(el('slide-copy'));
assert.equal(calls.at(-1).options.duration,800,'slide copy follows longer photo crossfade');
const beforeStage=calls.length;
motion.stage(0);
assert.equal(calls.length,beforeStage+1,'Observe reveals its relationship line');
assert.equal(calls.at(-1).options.duration,940);
const observeAnimation=calls.at(-1);
motion.stage(1);
assert.equal(observeAnimation.cancelled,true,'reselecting stage cancels obsolete paths');
assert.ok(calls.some(c=>c.name==='analyze-bar-2'&&c.options.duration===840));
motion.stage(2);
assert.ok(calls.some(c=>c.name==='value-line-1'&&c.options.duration===1020));
motion.stage(3);
assert.ok(calls.some(c=>c.name==='defend-sheet-1'&&c.options.duration===930));

const rows=[el('report-1'),el('report-2'),el('report-3'),el('report-4')];
const results=el('results');results.querySelectorAll=()=>rows;
const beforeList=calls.length;
motion.firstList(results,'.archive-report',4);
assert.equal(calls.length-beforeList,4);
assert.deepEqual(calls.slice(-4).map(c=>c.options.delay),[0,92,184,276]);
motion.firstList(results,'.archive-report',4);
assert.equal(calls.length-beforeList,4,'first-list motion not repeated during filtering');

const planned=el('action');planned.dataset.state='planned';
const beforeStatus=calls.length;
motion.recruitment(planned);
assert.equal(calls.length,beforeStatus,'status truth must be available without motion');
planned.dataset.state='open';motion.recruitment(planned);
assert.equal(calls.at(-1).options.duration,720);
motion.recruitment(planned);
assert.equal(calls.length,beforeStatus+1);

reduced=true;
const beforeReduced=calls.length;
motion.slide(el('no-motion-slide'));
motion.stage(1);
motion.enter(el('reduced-home'));
assert.equal(calls.length,beforeReduced,'reduced motion disables decoration');
console.log('PASS: v2.8.2 scene arrival, stage choreography, cancellation, list-once, state and reduced motion');
