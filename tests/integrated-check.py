"""SFC v2.5/v2.6 mock integration regression. No live Auth/RLS writes."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright, expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
checks=0
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def page(mode='anonymous',width=1440):
   ctx=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
   ctx.add_init_script(path=str(ROOT/'tests/fixtures/supabase-mock.js'))
   ctx.add_init_script("window.mock.mode='"+mode+"'")
   x=ctx.new_page();x.on('dialog',lambda d:d.accept());return x
  def ok(label):
   global checks
   checks+=1;print('PASS',label)
  for width in [360,390,768,1440]:
   x=page('anonymous',width);errors=[];x.on('pageerror',lambda e:errors.append(str(e)))
   x.goto(base+'/#research')
   expect(x.locator('#researchWorkbench')).to_be_visible()
   expect(x.locator('#archiveResults .archive-report')).to_have_count(4)
   expect(x.locator('#archiveMode')).to_contain_text('예시 자료 · 공식 발행 전')
   assert x.locator('#archiveResults .archive-report-label').filter(has_text='DEMO / EQUITY RESEARCH').count()>=1
   x.locator('#archiveSectors button[data-value="케이스"]').click()
   expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
   x.locator('#archiveSectors button[data-value="교육자료"]').click()
   expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
   x.locator('#archiveSectors button[data-value="all"]').click()
   x.locator('#archiveGridButton').click()
   expect(x.locator('#archiveGridButton')).to_have_attribute('aria-pressed','true')
   assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   x.evaluate("navigate('activities')")
   expect(x.locator('#journeyContext')).to_be_visible()
   x.locator('#scheduleTabs [data-value="research"]').click()
   expect(x.locator('#journeyCurrent')).to_have_text('최종 연구')
   expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(2)
   x.evaluate("navigate('recruitment')")
   expect(x.locator('#recruitmentStatusTrack [data-recruit-state="planned"]')).to_have_attribute('aria-current','step')
   assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   assert not errors,errors
   x.context.close()
   ok(f'archive stages, Activities and recruitment state responsive {width}px')
  x=page()
  x.goto(base+'/#research')
  # Publish nine mock items; verifies server-side range and metadata-only loading.
  x.evaluate("""async()=>{
   mock.rows=Array.from({length:9},(_,i)=>({
     id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
     title:'Sample publication '+(i+1),kind:'research',
     status:'published',deleted_at:null,scheduled_at:null,
     published_at:'2026-11-'+String(25-i).padStart(2,'0')+'T00:00:00Z',
     excerpt:'Evidence summary '+(i+1),research_sector:i%2?'소비재':'반도체',
     research_company:'기업 '+(i+1),research_author:'Research Team',
     research_method:'자료의 근거를 확인했습니다.',
     research_limitations:'미래 예측에는 불확실성이 있습니다.',
     body:'# 연구 질문\\n\\n기업의 가치에 영향을 주는 요인은?\\n\\n## 분석 근거\\n- 재무제표',
     cover_url:'',attachment_url:'https://example.invalid/sample.pdf',
     updated_at:'2026-11-20T00:00:00Z'
   }));
   await SFC_PUBLIC.load();
  }""")
  x.wait_for_function("SFC_PLATFORM.mode==='live' && document.querySelector('#archiveCount').textContent.includes('9 REPORTS')",timeout=10000)
  expect(x.locator('#archiveResults .archive-report')).to_have_count(6)
  expect(x.locator('#archiveNext')).to_be_enabled()
  x.locator('#archiveNext').click()
  expect(x.locator('#archiveResults .archive-report')).to_have_count(3)
  expect(x.locator('#archivePage')).to_have_text('2 / 2')
  x.locator('#archivePrev').click()
  expect(x.locator('#archivePage')).to_have_text('1 / 2')
  ok('live archive server-side pagination 6 + 3 mock rows')
  x.locator('#archiveSearch').fill('publication 1')
  x.wait_for_timeout(450)
  expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
  x.locator('#archiveSearch').fill('')
  x.wait_for_timeout(450)
  x.locator('#archiveResults .archive-report').first.click()
  x.wait_for_function("document.querySelector('#cmsPostTitle').textContent.includes('Sample publication')",timeout=7000)
  expect(x.locator('#post.reader-active')).to_be_visible()
  assert x.locator('#readerToc button').count()>=3
  expect(x.locator('#readerOverviewText')).to_contain_text('Evidence summary')
  x.locator('.reader-pdf-trigger').click()
  expect(x.locator('#researchPdfDialog')).to_be_visible()
  x.locator('#researchPdfClose').click()
  expect(x.locator('#researchPdfDialog')).not_to_be_visible()
  assert x.evaluate('mock.calls.length===0')
  ok('lazy public Reader, TOC, PDF preview and zero public writes')
  x.context.close()
  x=page('admin');x.goto(base+'/admin.html')
  expect(x.locator('#studioPanel')).to_be_visible()
  x.locator('#newPost').click()
  x.locator('#postKind').select_option('research')
  expect(x.locator('#insertResearchOutline')).to_be_visible()
  x.locator('#insertResearchOutline').click()
  assert '연구 질문' in x.locator('#postBody').input_value()
  original=x.locator('#postBody').input_value()
  x.locator('#insertResearchOutline').click()
  assert x.locator('#postBody').input_value()==original
  x.locator('#postTitle').fill('테스트 리서치 제목')
  x.locator('#postExcerpt').fill('이 연구의 핵심 질문입니다.')
  x.locator('#researchMethod').fill('금융 분석과 공시를 비교했습니다.')
  x.locator('#researchLimitations').fill('비교 가능한 표본이 제한적입니다.')
  x.locator('#previewButton').click()
  expect(x.locator('#previewBody .cms-research-notes').filter(has=x.get_by_role('heading',name='분석 방법',exact=True))).to_contain_text('금융 분석과 공시를 비교했습니다.')
  expect(x.locator('#previewBody .cms-research-notes').filter(has=x.get_by_role('heading',name='가정과 한계',exact=True))).to_contain_text('비교 가능한 표본')
  ok('Studio template preserves existing text and previews methodology and limits')
  x.context.close()
  x=page()
  x.goto(base+'/#reader-demo-0')
  expect(x.locator('#post.reader-demo')).to_be_visible()
  expect(x.locator('#cmsPostTitle')).to_contain_text('반도체 산업')
  expect(x.locator('#cmsPostMeta')).to_contain_text('DEMONSTRATION')
  assert x.locator('#readerToc button').count()>=3
  ok('direct deep link to clearly labeled demo Reader')
  x.context.close()
  # R5: full synthetic editorial-to-public workflow in separate contexts.
  import json
  from datetime import datetime, timedelta
  x=page('admin');x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
  x.locator('#studioHelp summary').click();expect(x.locator('#studioHelp')).to_contain_text('직접 AI 분석은 연결되지 않았습니다.')
  x.locator('#studioHelp summary').click();x.locator('#openImporter').click()
  payload={'schema_version':'0.1','kind':'research','source':{'filename':'TEST ONLY'},'article':{'title':'TEST ONLY full workflow','body':'# 연구 질문\\n합성 본문','research_author':'Synthetic team'},'evidence':[],'references':[],'issues':[]}
  x.locator('#importText').fill(json.dumps(payload));x.locator('#validateImport').click();x.locator('#applyImport').click()
  x.locator('#postExcerpt').fill('TEST ONLY overview');x.locator('#previewButton').click();expect(x.locator('#previewTitle')).to_have_text('TEST ONLY full workflow')
  x.locator('#closePreview').click();x.locator('#saveDraft').click();expect(x.locator('#editorSavedAt')).to_have_text('서버에 저장됨')
  def publish():
   x.locator('#publishPost').click();expect(x.locator('#confirmPublication')).to_be_disabled()
   for checkbox in x.locator('#publicationChecks input').all(): checkbox.check()
   x.locator('#confirmPublication').click()
  publish();expect(x.locator('#editorMode')).to_contain_text('게시됨')
  post_id=x.evaluate("mock.rows.find(r=>r.title==='TEST ONLY full workflow').id")
  y=page('anonymous');y.goto(base+'/#research')
  def sync(rows=None):
   if rows is None: rows=x.evaluate('mock.rows')
   y.evaluate('rows=>{mock.rows=rows;return SFC_PUBLIC.load()}',rows)
  sync();expect(y.locator('#archiveResults .archive-report')).to_have_count(1)
  y.locator('#archiveResults .archive-report').first.click();expect(y.locator('#cmsPostTitle')).to_have_text('TEST ONLY full workflow')
  x.locator('#unpublishPost').click();expect(x.locator('#editorMode')).to_contain_text('임시글')
  sync();expect(y.locator('#cmsPostTitle')).to_have_text('게시글을 찾을 수 없습니다.')
  y.evaluate("location.hash='research'");expect(y.locator('#archiveResults .archive-report')).to_have_count(0)
  x.locator('#postSchedule').fill((datetime.now()+timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'));publish();expect(x.locator('#editorMode')).to_contain_text('예약 발행')
  sync();expect(y.locator('#archiveResults .archive-report')).to_have_count(0)
  reached=x.evaluate('mock.rows');next(r for r in reached if r['id']==post_id)['scheduled_at']='2000-01-01T00:00:00Z'
  sync(reached);expect(y.locator('#archiveResults .archive-report')).to_have_count(1)
  x.locator('#trashPost').click();expect(x.locator('#restorePost')).to_be_visible();sync();expect(y.locator('#archiveResults .archive-report')).to_have_count(0)
  x.locator('#restorePost').click()
  for checkbox in x.locator('#publicationChecks input').all(): checkbox.check()
  x.locator('#confirmPublication').click();expect(x.locator('#postForm')).to_be_visible()
  sync();expect(y.locator('#archiveResults .archive-report')).to_have_count(0)
  assert y.evaluate('mock.calls.length===0')
  ok('R5 import/edit/preview/publish/withdraw/schedule/trash/restore mock workflow')
  x.context.close();y.context.close()
  # R6: real query pagination and grouped filters above the old 400-row cap.
  x=page('anonymous');x.goto(base+'/#research')
  x.evaluate("""async()=>{mock.rows=Array.from({length:405},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),kind:'research',status:'published',deleted_at:null,scheduled_at:null,title:i===404?'A&B 한국':'TEST research '+i,research_sector:i===404?'Late sector':i%2?'IT':' it ',published_at:'2026-11-01T00:00:00Z',excerpt:''}));await SFC_PUBLIC.load();}""")
  expect(x.locator('#archiveSectors button').filter(has_text='Late sector')).to_be_visible()
  x.locator('#archiveSectors button').filter(has_text='Late sector').click();expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
  x.locator('#archiveSearch').fill('A&B');expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
  x.locator('#archiveSearch').fill('%%%');expect(x.locator('#archiveResults .archive-report')).to_have_count(0)
  x.locator('#archiveReset').click();expect(x.locator('#archiveResults .archive-report')).to_have_count(6)
  x.locator('#archiveNext').click();expect(x.locator('#archivePage')).to_have_text('2 / 68')
  x.go_back();expect(x.locator('#archivePage')).to_have_text('1 / 68')
  assert x.evaluate('mock.calls.length===0')
  ok('R6 405 public rows, late sector, punctuation and history navigation');x.context.close()
  # R8 keyboard skip navigation, lazy PDF, native Escape and lab-only layout metrics.
  x=page('anonymous',360)
  x.context.add_init_script("""window.lab={lcp:null,cls:0};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.lab.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.lab.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch(e){}""")
  # Root entry must stay fragment-free; the skip link is the first DOM link.
  x.goto(base+'/');x.bring_to_front()
  assert x.evaluate("location.hash==='' && document.querySelector('a[href]').id==='skipMain'")
  # Record the actual keyboard path (browser may choose a different initial
  # focus origin). Require real Tab navigation, not locator.focus().
  focus_path=[]
  for _ in range(60):
   x.keyboard.press('Tab')
   current=x.evaluate("document.activeElement.id || document.activeElement.tagName")
   focus_path.append(current)
   if current=='skipMain':break
  assert focus_path[-1]=='skipMain',focus_path
  print('R8 keyboard traversal:',focus_path)
  assert x.locator('#skipMain').evaluate("e=>getComputedStyle(e).clipPath==='none' && e.getBoundingClientRect().top>=0")
  x.keyboard.press('Enter')
  expect(x.locator('#main-content')).to_be_focused();assert x.evaluate("location.hash===''")
  assert x.locator('#researchPdfFrame').get_attribute('src') is None
  assert x.locator('#applicationFrame').get_attribute('src') is None
  x.evaluate("""async()=>{mock.rows=[{id:'00000000-0000-4000-8000-000000000099',kind:'research',status:'published',deleted_at:null,scheduled_at:null,published_at:'2026-11-01T00:00:00Z',title:'TEST ONLY PDF',excerpt:'Fixture',body:'## TEST',attachment_url:'https://example.invalid/test.pdf'}];await SFC_PUBLIC.load();location.hash='post-00000000-0000-4000-8000-000000000099';}""")
  expect(x.locator('#cmsPostTitle')).to_have_text('TEST ONLY PDF')
  assert x.locator('#researchPdfFrame').get_attribute('src') is None
  x.locator('.reader-pdf-trigger').click();expect(x.locator('#researchPdfDialog')).to_be_visible()
  expect(x.locator('#researchPdfClose')).to_be_focused();x.keyboard.press('Escape')
  expect(x.locator('#researchPdfDialog')).to_be_hidden();expect(x.locator('.reader-pdf-trigger')).to_be_focused()
  assert x.locator('#researchPdfFrame').get_attribute('src') is None
  assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  print('R8 lab-only metrics (mock/local, external blocked):',x.evaluate('window.lab'))
  ok('R8 keyboard, focus return, PDF on demand and 360px');x.context.close()
  browser.close()
finally:
 server.shutdown()
print(str(checks)+' additional integrated browser scenarios passed; live Supabase/Auth/RLS NOT tested')