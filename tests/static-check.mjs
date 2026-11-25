import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const files=['index.html','admin.html','assets/sangmyung-university-mark.svg','css/v2.7-review.css','css/v2.8-motion.css','js/v2.8-motion.js','css/site.css','css/cms-public.css','css/cms.css',
  'js/motion.js','css/motion.css','css/editorial.css','css/integrated.css','css/people-recruitment.css','js/about-experience.js','js/visual-story.js','js/people-recruitment.js','js/research-platform.js','js/research-reader.js','js/site.js','js/cms-core.js','js/cms-public.js','js/cms-admin.js','js/cms-studio.js',
  'js/cms-config.js','sql/sfc-cms.sql','sql/sfc-roles-v1.4.sql',
  'sql/sfc-integrated-2.0.sql','robots.txt','sitemap.xml'];
for(const path of files){assert.ok(read(path).length>0,path+' missing or empty');}
const publicHtml=read('index.html'),adminHtml=read('admin.html');
function verifyIds(html,label){
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,label+' has duplicate element IDs');
  for(const name of ['div','section','dialog','form']){
    const opened=html.split('<'+name+' ').length-1+html.split('<'+name+'>').length-1;
    const closed=html.split('</'+name+'>').length-1;
    assert.equal(opened,closed,label+' '+name+' unbalanced');
  }
  return new Set(ids);
}
const publicIds=verifyIds(publicHtml,'index.html'),adminIds=verifyIds(adminHtml,'admin.html');
for(const path of files.filter(s=>s.endsWith('.js'))){
  const js=read(path);
  new vm.Script(js,{filename:path});
  const ids=[...js.matchAll(/\$\("([\w-]+)"\)/g)].map(x=>x[1]);
  const scope=['js/cms-public.js','js/site.js','js/motion.js','js/visual-story.js','js/people-recruitment.js','js/research-platform.js','js/research-reader.js'].includes(path)?publicIds:adminIds;
  // Core and config have no hard-coded local DOM dependencies.
  if(path.includes('cms-core')||path.includes('cms-config'))continue;
  // Research workbench controls are declared in a trusted static template
  // and inserted before any event handler binds to them.
  const generated=path==='js/research-platform.js'
    ?new Set([...js.matchAll(/id="([A-Za-z0-9-]+)"/g)].map(x=>x[1]))
    :new Set();
  for(const id of ids)assert.ok(scope.has(id)||generated.has(id),
    path+' references missing DOM ID '+id);
  console.log('OK JavaScript:',path);
}
assert.match(publicHtml,/class="header-login"[^>]+href="admin.html"/,'Header login absent');
assert.doesNotMatch(publicHtml,/ADMIN LOGIN/,'Footer login should be removed');
assert.match(publicHtml,/id="applicationDialog"/);
assert.match(publicHtml,/id="applicationTrigger"/);
assert.match(publicHtml,/id="homeLiveResearch"/);
assert.match(adminHtml,/data-pane="recruitment"/);
assert.match(adminHtml,/data-pane="access"/);
assert.doesNotMatch(adminHtml,/value="member"|value="admin"/,'Role selector should not exist');
const migration=read('sql/sfc-integrated-2.0.sql');
assert.match(migration,/drop column if exists role/);
assert.match(migration,/create or replace function sfc_private\.is_superadmin/);
assert.match(migration,/existing_count>=3/);
assert.match(migration,/enable row level security/g);
assert.match(migration,/create table if not exists public\.cms_post_revisions/);
assert.match(migration,/status='published' and deleted_at is null/);
assert.match(migration,/scheduled_at<=now\(\)/);
assert.ok(read('js/cms-config.js').includes('sb_publishable_'),'Public config should contain publishable key');
assert.doesNotMatch(read('js/cms-config.js'),/sb_secret_[A-Za-z0-9]/);
assert.doesNotMatch(read('js/cms-config.js'),/service_role\s*:\s*["']/);
assert.match(publicHtml,/src="js\/motion\.js\?v=2\.8\.0"/);
assert.match(publicHtml,/src="js\/v2\.8-motion\.js\?v=2\.8\.0"/);
assert.doesNotMatch(publicHtml,/id="heroPause"/);
assert.match(publicHtml,/id="heroProgress"/);
assert.match(read('js/motion.js'),/layout:355/);
assert.match(read('js/motion.js'),/recruitment:320/);
assert.match(publicHtml,/id="readingProgress"/);
assert.match(read('js/motion.js'),/prefers-reduced-motion/);
assert.match(read('js/cms-public.js'),/getPublicClient\(\)/);
assert.match(read('js/cms-public.js'),/scheduled_at\.lte/);
assert.match(publicHtml,/id="experienceLayout"/);
assert.match(publicHtml,/data-about-intro/);
assert.match(publicHtml,/class="about-manual-lines"/);
assert.match(publicHtml,/js\/about-experience\.js\?v=2\.8\.0/);
assert.match(read('css/editorial.css'),/#about \.about-manual-lines \.about-line\{display:block\}/);
assert.match(read('js/about-experience.js'),/copy\.replaceChildren/);
assert.match(publicHtml,/id="homeValueTitle"/);
assert.ok(publicHtml.includes('about-approved-copy'),'Approved three-line About introduction required');
assert.match(publicHtml,/href="css\/editorial\.css\?v=2\.4\.2"/);
assert.match(read('css/editorial.css'),/text-wrap:pretty/);
assert.match(read('js/motion.js'),/function filterRows\(/);
assert.match(read('js/site.js'),/motion\.filterRows\(root,selectedStage\)/);
assert.match(read('js/cms-public.js'),/motion\.filterRows\(root,liveStage\)/);
assert.match(read('css/editorial.css'),/scrollbar-gutter:stable/);
assert.match(publicHtml,/id="researchWorkbench"/);
assert.match(publicHtml,/id="readerToc"/);
assert.match(publicHtml,/id="journeyContext"/);
assert.match(publicHtml,/id="recruitmentStatusTrack"/);
assert.match(publicHtml,/src="js\/research-platform\.js\?v=2\.8\.0"/);
assert.match(publicHtml,/src="js\/research-reader\.js\?v=2\.6-preview"/);
assert.match(publicHtml,/src="js\/visual-story\.js\?v=2\.8\.0"/);
assert.match(read('js/research-platform.js'),/\.range\(from,from\+limit-1\)/);
assert.match(read('js/cms-public.js'),/\.maybeSingle\(\)/);
assert.match(read('js/cms-public.js'),/\.limit\(80\)/);
assert.match(adminHtml,/id="insertResearchOutline"/);
assert.match(read('js/cms-admin.js'),/research_method/);
assert.match(publicHtml,/id="peopleGraph"/);
assert.doesNotMatch(publicHtml,/id="peopleSpotlight"/);
assert.match(publicHtml,/id="recruitActionCard"/);
assert.match(publicHtml,/id="recruitmentProcess"/);
assert.doesNotMatch(publicHtml,/id="processDetail"/);
assert.match(publicHtml,/href="css\/people-recruitment\.css\?v=2\.6\.5-preview"/);
assert.match(publicHtml,/src="js\/people-recruitment\.js\?v=2\.8\.0"/);
assert.match(read('js/cms-public.js'),/SFC_PEOPLE_RECRUITMENT\.setPeople/);
assert.match(read('js/cms-public.js'),/SFC_PEOPLE_RECRUITMENT\?\.syncRecruitment/);
assert.doesNotMatch(publicHtml,/data-process-step=/);
assert.match(read('js/people-recruitment.js'),/team-node-description/);
assert.match(read('css/people-recruitment.css'),/process-step p/);
assert.match(read('css/people-recruitment.css'),/prefers-reduced-motion:reduce/);
assert.ok(publicHtml.includes('assets/sangmyung-university-mark.svg'),'Footer university mark must be local');
assert.ok(!publicHtml.includes('smuLogo')&&!publicHtml.includes('smu-mark-header'),'Header logo comparison switch must not ship');
assert.ok(!publicHtml.includes('class="hero-identity"'),'Hero identity caption must remain removed');
assert.ok(read('js/research-platform.js').includes('demo?"DEMO / "+item.type.toUpperCase()'),'Research DEMO adjacent type should remain');
assert.ok(publicHtml.includes('about-approved-copy'),'Approved About copy must remain');
assert.ok(!read('js/motion.js').includes('pageAnimation=play(root'),'Universal page fade must be removed');
assert.ok(read('js/v2.8-motion.js').includes('function stage(index)'),'About SVG stage choreography missing');
assert.ok(read('js/v2.8-motion.js').includes('function firstList('),'List entrance contract missing');
assert.ok(read('js/research-platform.js').includes('reconcile(results,children,{reuse:"equal",exit:false})'),'Research should not clone ghost rows');
assert.ok(read('js/site.js').includes('window.SFC_V28?.slide(copy)'),'Hero must use short slide transition');
assert.ok(read('js/people-recruitment.js').includes('window.SFC_V28?.people()'),'Dynamic People list must be observed');
assert.ok(publicHtml.includes('href="css/v2.8-motion.css?v=2.8.0"'),'Motion styles should be last');
assert.ok(!publicHtml.includes('smu-mark-header'),'University mark must remain footer-only');
console.log('PASS: v2.8 motion contracts, public UI and security');
