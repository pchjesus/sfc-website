import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../js/v2.8-motion.js',import.meta.url),'utf8');
let reduced=false;
const all=[];
function node(name){
  return {name,dataset:{},
    getClientRects(){return [1]},
    closest(){return {id:"home",className:"view active"}},
    querySelector(sel){return node(name+"/"+sel)},
    querySelectorAll(){return []},
    animate(frames,options){
      const a={name,frames,options,cancelled:false,finished:Promise.resolve(),
        cancel(){this.cancelled=true}};
      all.push(a);return a;
    }};
}
function root(id,config={}){
  const el=node("root-"+id);
  el.id=id;
  el.dataset={};
  el.querySelector=sel=>config[sel]||node(id+":"+sel);
  el.querySelectorAll=sel=>config[sel+"[]"]||[];
  return el;
}
function actionsFor(prefix){return all.filter(a=>a.name.startsWith(prefix))}
function last(name){return all.filter(a=>a.name===name).at(-1)}
function assertSignature(el,kind){assert.equal(el.dataset.motionSignature,kind)}
const stageElements=[
  {rects:[node("observe-node")],paths:[Object.assign(node("observe-edge"),{getTotalLength:()=>100})]},
  {rects:[node("analyze-bar")],paths:[Object.assign(node("analyze-trend"),{getTotalLength:()=>100})]},
  {rects:[Object.assign(node("value-frame"),{getTotalLength:()=>80})],
   paths:[Object.assign(node("value-line"),{getTotalLength:()=>100})]},
  {rects:[node("defend-paper")],paths:[Object.assign(node("defend-line"),{getTotalLength:()=>100})]}
].map((items,i)=>{
  const e=node("stage"+i);
  e.querySelectorAll=sel=>{
    if(sel==="rect"||sel==="rect[stroke]")return items.rects;
    if(sel==="path[stroke]")return items.paths;
    return [];
  };
  e.querySelector=sel=>sel==="rect[stroke]"?items.rects[0]:node("stage"+i+":"+sel);
  return e;
});
const context={
  window:{SFC_MOTION:{reduced:()=>reduced}},
  innerWidth:1440,
  document:{
    getElementById:()=>null,
    querySelector:sel=>{
      const n=sel.match(/data-experience-visual="(\d+)"/);
      return n?stageElements[Number(n[1])]:null;
    }
  },
  requestAnimationFrame:fn=>fn()
};
vm.runInNewContext(code,context,{filename:"v28-motion.js"});
const api=context.window.SFC_V28;
assert.ok(Object.isFrozen(api));
assert.equal(new Set(Object.values(api.signatures)).size,7,"Each public tab requires a unique visual grammar");

const home=root("home",{
  ".hero-photo.active":node("hero-photo"),
  "#heroHeading":node("hero-title"),
  "#heroDescription":node("hero-description"),
  "#heroButton":node("hero-cta"),
  ".hero-controls":node("hero-controls")
});
api.enter(home);
assertSignature(home,"photographic-typographic-mask");
assert.equal(last("hero-title").frames[0].clipPath,"inset(90% 0 0 0)");
assert.equal(last("hero-title").options.duration,1260);
assert.equal(last("hero-title").options.fill,"backwards");
assert.equal(last("hero-photo").options.duration,1180);
const before=all.length;
api.enter(home);
assert.ok(all.length>before,"Route revisit must still have an arrival scene");
assert.ok(all.slice(0,before).some(a=>a.cancelled),"Obsolete scene effects must be cancelled");
api.slide(node("slide-copy"));
assert.equal(last("slide-copy").options.duration,930);

const about=root("about",{".about-photo-panel":node("about-photo-panel")});
api.enter(about);
assertSignature(about,"diagram-connect-and-column-reveal");
assert.equal(last("about-photo-panel").frames[0].clipPath,"inset(0 54% 0 46%)");

const rows=[node("report-1"),node("report-2")];
const archive=node("archive-root");
archive.querySelectorAll=()=>rows;
archive.closest=()=>({className:"view active"});
const research=root("research",{"#archiveResults":archive});
api.enter(research);
assertSignature(research,"workspace-expand-and-spatial-flip");
assert.equal(last("research:.archive-search-row").frames[0].clipPath,"inset(0 54% 0 46%)");
assert.equal(last("report-1").frames[0].clipPath,"inset(0 0 100% 0)");
assert.equal(last("report-1").options.duration,1090);
const beforeList=all.length;
api.firstList(archive,".archive-report");
assert.equal(all.length,beforeList,"First-list reveal must not repeat after filtering");

const timelineRows=[node("week01"),node("week02")];
const activity=root("activities",{
  "#scheduleTabs button[]":[node("tab1"),node("tab2")],
  '#scheduleList>.session:not([hidden]),#scheduleList>.cms-session:not([hidden])[]':timelineRows
});
api.enter(activity);
assertSignature(activity,"fifteen-week-timeline-drop");
assert.equal(last("week01").frames[0].clipPath,"inset(0 0 100% 0)");
assert.equal(last("tab1").frames[0].clipPath,"inset(45% 43% 45% 43%)");

const people=root("people");
api.enter(people);
assertSignature(people,"typographic-index-print");
assert.equal(last("people:.page-head/h1").frames[0].clipPath,"inset(0 100% 0 0)");

const facts=[node("fact01"),node("fact02"),node("fact03"),node("fact04")];
const recruitment=root("recruitment",{".recruit-fact[]":facts});
api.enter(recruitment);
assertSignature(recruitment,"fact-grid-center-bloom");
assert.equal(last("fact01").frames[0].clipPath,"inset(45% 43% 45% 43%)");
assert.equal(last("recruitment:#recruitActionCard").frames[0].clipPath,"inset(0 0 100% 0)");

const news=node("news");
news.closest=selector=>selector==="#research"?null:({className:"view active",id:"updates"});
news.querySelectorAll=()=>[node("post1")];
const updates=root("updates",{"#updatesList":news});
api.enter(updates);
assertSignature(updates,"publication-line-ink");
assert.equal(last("updates:.updates-section-heading").frames[0].clipPath,"inset(0 100% 0 0)");
assert.equal(last("post1").frames[0].clipPath,"inset(0 100% 0 0)");

api.stage(0);
assert.equal(last("observe-edge").options.duration,850);
const edge=last("observe-edge");
api.stage(1);
assert.equal(edge.cancelled,true);
assert.ok(last("analyze-bar").frames[0].transform.includes("scaleY"));
api.stage(2);
assert.equal(last("value-line").options.duration,950);
api.stage(3);
assert.equal(last("defend-paper").frames[0].clipPath,"inset(0 0 100% 0)");

const action=node("recruit-action");
action.dataset.state="planned";
const count=all.length;
api.recruitment(action);
assert.equal(all.length,count);
action.dataset.state="open";
api.recruitment(action);
assert.equal(last("recruit-action").options.duration,380);

for(const a of all){
  assert.ok(a.options.duration<=1360,"Only ambient photo CSS may exceed 1.36s: "+a.name);
  assert.equal(a.options.fill,"backwards");
}
reduced=true;
const beforeReduced=all.length;
api.enter(root("home"));
api.slide(node("reduced-slide"));
api.stage(0);
assert.equal(all.length,beforeReduced,"Reduced-motion preference disables nonessential animations");
console.log("PASS: seven distinct motion signatures, mid-tempo timing, stage meaning, interruptions and reduced-motion");
