import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const files=['index.html','admin.html','css/site.css','css/cms-public.css','css/cms.css',
  'js/motion.js','css/motion.css','css/editorial.css','js/about-experience.js','js/site.js','js/cms-core.js','js/cms-public.js','js/cms-admin.js','js/cms-studio.js',
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
  const scope=path==='js/cms-public.js'||path==='js/site.js'||path==='js/motion.js'?publicIds:adminIds;
  // Core and config have no hard-coded local DOM dependencies.
  if(path.includes('cms-core')||path.includes('cms-config'))continue;
  for(const id of ids)assert.ok(scope.has(id),path+' references missing DOM ID '+id);
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
assert.match(publicHtml,/src="js\/motion\.js\?v=2\.4"/);
assert.doesNotMatch(publicHtml,/id="heroPause"/);
assert.match(publicHtml,/id="heroProgress"/);
assert.match(read('js/motion.js'),/layout:550/);
assert.match(read('js/motion.js'),/recruitment:570/);
assert.match(publicHtml,/id="readingProgress"/);
assert.match(read('js/motion.js'),/prefers-reduced-motion/);
assert.match(read('js/cms-public.js'),/getPublicClient\(\)/);
assert.match(read('js/cms-public.js'),/scheduled_at\.lte/);
assert.match(publicHtml,/id="experienceLayout"/);
assert.match(publicHtml,/id="homeValueTitle"/);
assert.match(publicHtml,/class="copy-sentence"/);
assert.match(publicHtml,/href="css\/editorial\.css\?v=2\.4\.1"/);
assert.match(read('css/editorial.css'),/text-wrap:pretty/);
assert.match(read('js/motion.js'),/function filterRows\(/);
assert.match(read('js/site.js'),/motion\.filterRows\(root,selectedStage\)/);
assert.match(read('js/cms-public.js'),/motion\.filterRows\(root,liveStage\)/);
assert.match(read('css/editorial.css'),/scrollbar-gutter:stable/);
console.log('PASS: static structure, client syntax, referenced IDs, access, stable curriculum filtering and editorial contracts');
