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
   expect(x.locator('#archiveMode')).to_contain_text('DEMONSTRATION')
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
  expect(x.locator('#previewResearchNotes')).to_contain_text('비교 가능한 표본')
  ok('Studio template preserves existing text and previews methodology and limits')
  x.context.close()
  browser.close()
finally:
 server.shutdown()
print(str(checks)+' additional integrated browser scenarios passed; live Supabase/Auth/RLS NOT tested')