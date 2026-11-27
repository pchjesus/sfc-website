"""Run: python3 tests/browser-check.py (requires Playwright and Chromium).
Starts an ephemeral local server. All external requests are blocked; CMS is mocked.
"""
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
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 def page(mode='admin',width=1440):
  c=browser.new_context(viewport={'width':width,'height':900})
  c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  c.add_init_script(path=str(ROOT/'tests/fixtures/supabase-mock.js'))
  c.add_init_script(f"window.mock.mode='{mode}'")
  x=c.new_page();x.on('dialog',lambda d:d.accept());return x
 def ok(label):
  global checks
  checks+=1;print('PASS',label)
 for width in [1440,768,360]:
  x=page('anonymous',width);errors=[];x.on('pageerror',lambda e:errors.append(str(e)))
  x.goto(base)
  if width==360:
   assert x.locator('#menuToggle').bounding_box()['x']+x.locator('#menuToggle').bounding_box()['width']<=width
  for route in ['home','about','research','activities','people','recruitment','updates']:
   x.evaluate('(r)=>location.hash=r',route);expect(x.locator('#'+route)).to_be_visible()
   assert x.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,route)
  x.evaluate("location.hash='recruitment'");expect(x.locator('#recruitment')).to_be_visible()
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','activities')
  x.locator('#applicationTrigger').click()
  expect(x.locator('#activities')).to_be_visible()
  expect(x.locator('#applicationDialog')).not_to_be_visible()
  expect(x.locator('#applicationDownload')).to_be_hidden()
  x.evaluate("navigate('recruitment')")
  if width<=760:
   x.locator('#menuToggle').click();expect(x.locator('#menuToggle')).to_have_attribute('aria-expanded','true')
   x.keyboard.press('Escape');expect(x.locator('#menuToggle')).to_have_attribute('aria-expanded','false')
  x.evaluate("location.hash='%E0%A4%A'");x.wait_for_timeout(50);assert not errors,errors
  x.screenshot(path=f'/tmp/sfc-public-{width}.png',full_page=True)
  ok(f'public routes, overflow, dialog, malformed hash {width}px');x.context.close()
 for width in [1440,768,360]:
  x=page(width=width);x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
  for pane in ['posts','site','people','sessions','recruitment','access']:
   x.locator(f'[data-pane="{pane}"]').click()
   expect(x.locator(f'[data-pane-view="{pane}"]')).to_be_visible()
   assert x.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,pane)
  x.screenshot(path=f'/tmp/sfc-studio-{width}.png',full_page=True)
  ok(f'Studio six panes {width}px (mock)');x.context.close()
 # D3 developer UI and mock role boundary. NOT evidence of live RLS.
 for width in [1440,768,390,360]:
  x=page('developer',width);x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
  expect(x.locator('#developerTab')).to_be_visible()
  for pane in ['posts','site','people','sessions','recruitment','access','developer']:
   x.locator(f'[data-pane="{pane}"]').click();expect(x.locator(f'[data-pane-view="{pane}"]')).to_be_visible()
   assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,pane)
  expect(x.locator('#devConnection')).to_have_text('조회 성공')
  expect(x.locator('#devCounts')).to_contain_text('1 / 3')
  assert x.evaluate('mock.calls.length')==0
  x.locator('#devGoAccounts').click();expect(x.locator('#developerIdentity')).to_be_visible()
  expect(x.locator('#superadminCount')).to_have_text('1 / 3')
  ok(f'D3 developer seven panes, read-only diagnostics and separate membership {width}px');x.context.close()
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 expect(x.locator('#developerTab')).to_be_hidden()
 x.evaluate("SFC_STUDIO.showPane('developer')");expect(x.locator('[data-pane-view="developer"]')).to_be_hidden()
 x.locator('[data-pane="access"]').click();expect(x.locator('#developerIdentity')).to_be_hidden()
 ok('D3 ordinary admin has no developer UI');x.context.close()
 x=page('developer');x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('[data-pane="access"]').click();expect(x.locator('#superadminCount')).to_have_text('1 / 3')
 for i in range(2):
  x.locator('#memberEmail').fill(f'manager{i}@example.invalid');x.locator('#memberAddButton').click()
  expect(x.locator('#superadminCount')).to_have_text(f'{i+2} / 3')
 expect(x.locator('#memberAddButton')).to_be_disabled()
 assert x.evaluate("mock.developers.length===1 && mock.admins.length===3")
 x.locator('#memberList .studio-member-row').filter(has_text='manager0@example.invalid').get_by_role('button').click()
 expect(x.locator('#superadminCount')).to_have_text('2 / 3')
 x.locator('#developerTab').click();expect(x.locator('#devConnection')).to_have_text('조회 성공')
 x.evaluate("mock.mode='nonadmin';mock.authEvent('TOKEN_REFRESHED')")
 expect(x.locator('#studioLogin')).to_be_visible();expect(x.locator('#developerTab')).to_be_hidden()
 ok('D3 mock admin rotation and revoked session denied');x.context.close()
 # Standalone preview deliberately uses no production client, real network or login.
 c=browser.new_context(viewport={'width':390,'height':900});x=c.new_page();reqs=[]
 x.on('request',lambda req:reqs.append(req.url))
 c.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
 x.goto(base+'/preview/developer-studio-demo.html');expect(x.locator('#studioPanel')).to_be_visible();expect(x.locator('#developerTab')).to_be_visible()
 x.locator('#developerTab').click();expect(x.locator('#devConnection')).to_have_text('조회 성공')
 assert all(url.startswith(base) for url in reqs),reqs
 x.locator('#previewSwitch').click();expect(x.locator('#studioPanel')).to_be_visible();expect(x.locator('#developerTab')).to_be_hidden()
 assert x.evaluate("SFC_STUDIO.getRole()")== 'admin'
 ok('D3 self-contained preview starts without login, switches mock roles, zero external requests');c.close()
 # D3.1 actual standalone candidate; verify every pane tool and no external requests.
 for width in [360,390,768,1440]:
  context=browser.new_context(viewport={'width':width,'height':900},accept_downloads=True)
  x=context.new_page();x.on('dialog',lambda d:d.accept());requests=[];errors=[]
  x.on('request',lambda req:requests.append(req.url));x.on('pageerror',lambda e:errors.append(str(e)))
  context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
  x.goto(base+'/preview/developer-studio-demo.html');expect(x.locator('#studioPanel')).to_be_visible()
  x.locator('[data-pane="access"]').click();expect(x.locator('#superadminCount')).to_have_text('1 / 3')
  field=x.locator('#memberEmail').bounding_box();button=x.locator('#memberAddButton').bounding_box()
  assert abs(field['y']-button['y'])<=1 and abs(field['height']-button['height'])<=1,(width,field,button)
  assert field['height']==48,(width,field)
  assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  if width==390:
   x.locator('#memberEmail').fill('test@example.invalid');x.locator('#memberAddButton').click()
   expect(x.locator('#studioMessage')).to_contain_text('이미 등록')
   assert x.evaluate('mock.calls.length')==0
   x.locator('#memberEmail').fill('new-admin@example.invalid');x.locator('#memberAddButton').click();expect(x.locator('#superadminCount')).to_have_text('2 / 3')
   x.locator('[data-pane="posts"]').click();x.locator('#postKindFilter').select_option('research')
   expect(x.locator('#adminPostList .admin-post-item')).to_have_count(1);expect(x.locator('#postFilterSummary')).to_contain_text('1개 표시')
   x.locator('#postKindFilter').select_option('');x.locator('#postSort').select_option('title')
   expect(x.locator('#adminPostList .admin-post-item')).to_have_count(2)
   x.locator('[data-pane="site"]').click();expect(x.locator('#siteHeroDescription')).to_have_value('기업의 숫자를 읽고, 가치의 근거를 찾다.')
   x.locator('#siteHeroDescription').fill('미리보기 테스트');x.locator('#siteForm details summary').click();expect(x.locator('#sitePreview')).to_contain_text('미리보기 테스트')
   x.locator('#siteForm button[type="submit"]').click();expect(x.locator('#studioMessage')).to_contain_text('홈페이지 문구를 저장')
   x.locator('[data-pane="people"]').click();expect(x.locator('#peopleList .studio-record')).to_have_count(2)
   x.locator('#peopleVisibility').select_option('private');expect(x.locator('#peopleList .studio-record')).to_have_count(1);expect(x.locator('#peopleSummary')).to_contain_text('표시 1')
   x.locator('#peopleSearch').fill('없는 이름');expect(x.locator('#peopleList')).to_contain_text('검색 조건')
   x.locator('[data-pane="sessions"]').click();expect(x.locator('#sessionsList .studio-record')).to_have_count(3)
   x.locator('#sessionFilterStage').select_option('research');expect(x.locator('#sessionsList .studio-record')).to_have_count(1);expect(x.locator('#sessionSummaryCount')).to_contain_text('표시 1')
   x.locator('[data-pane="recruitment"]').click();expect(x.locator('#recruitTitle')).to_have_value('2027 Spring Recruitment')
   x.locator('#recruitStart').fill('2027-03-10T10:00');x.locator('#recruitEnd').fill('2027-03-09T10:00')
   expect(x.locator('#recruitDateWarning')).to_be_visible()
   x.locator('#recruitEnd').fill('2027-03-11T10:00');expect(x.locator('#recruitDateWarning')).to_be_hidden()
   x.locator('#recruitForm details summary').click();expect(x.locator('#recruitPreview')).to_contain_text('PDF: 미등록')
   x.locator('#recruitForm button[type="submit"]').click();expect(x.locator('#studioMessage')).to_contain_text('모집 설정')
   x.locator('#developerTab').click();expect(x.locator('#devConnection')).to_have_text('조회 성공')
   with x.expect_download() as d:
    x.locator('#devExport').click()
   import json
   report=json.loads(d.value.path().read_text())
   assert report['counts']['operational_admins']==2 and report['counts']['settings']==2 and 'email' not in str(report)
  assert not errors,errors
  assert all(url.startswith(base) for url in requests),requests
  ok(f'D3.1 aligned member CTA and standalone responsive preview {width}px')
  context.close()
 # R4 backup inspection is local-only, and production scratch namespace is not read in mock.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('[data-pane="access"]').click()
 x.locator('.studio-backup details summary').click()
 x.locator('#inspectBackupFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"format":"wrong"}'})
 x.locator('#inspectBackup').click();expect(x.locator('#backupInspection')).to_contain_text('검사 실패')
 assert x.evaluate('mock.calls.length===0 && mock.uploads.length===0')
 with x.expect_download() as download:
  x.locator('#exportData').click()
 raw=download.value.path().read_bytes()
 x.locator('#inspectBackupFile').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':raw})
 x.locator('#inspectBackup').click();expect(x.locator('#backupInspection')).to_contain_text('형식 검사 통과');expect(x.locator('#backupInspection')).to_contain_text('체크섬: match')
 assert x.evaluate('mock.calls.length===0 && mock.uploads.length===0')
 x.evaluate("mock.authEvent('SIGNED_OUT');mock.mode='anonymous'");expect(x.locator('#studioLogin')).to_be_visible()
 expect(x.locator('#backupInspection')).to_have_text('')
 ok('R4 local backup export, checksum inspection and session reset');x.context.close()
 x=page('developer');x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.evaluate("mock.readFailTable='cms_people'");x.locator('#developerTab').click();expect(x.locator('#devConnection')).to_have_text('조회 실패')
 with x.expect_download() as download:
  x.locator('#devExport').click()
 import json
 report=json.loads(download.value.path().read_text());assert report['query_status']=='failed' and report['deployed_sha'] is None and report['failed_queries']==[3]
 x.evaluate("mock.readFailTable=null");x.locator('#devRefresh').click();expect(x.locator('#devConnection')).to_have_text('조회 성공')
 ok('R4 diagnostic failure and retry without private error payload');x.context.close()
 c=browser.new_context(viewport={'width':390,'height':900});x=c.new_page();x.on('dialog',lambda d:d.accept());x.goto(base+'/preview/developer-studio-demo.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.evaluate("sessionStorage.setItem('sfc-editor-draft-v3:production-sentinel','keep');sessionStorage.setItem('sfc-test-workspace:test-sentinel','discard')")
 x.locator('#postTitle').fill('TEST ONLY isolated scratch');x.wait_for_timeout(500)
 assert x.evaluate("Object.keys(sessionStorage).some(k=>k.startsWith('sfc-test-workspace:sfc-editor-draft-v3:'))")
 x.locator('#previewReset').click();expect(x.locator('#studioPanel')).to_be_visible()
 assert x.evaluate("sessionStorage.getItem('sfc-editor-draft-v3:production-sentinel')==='keep' && !Object.keys(sessionStorage).some(k=>k.startsWith('sfc-test-workspace:'))")
 ok('R4 workspace reset does not touch production scratch namespace');c.close()
 # R0: a delayed read from a prior session must not repopulate a cleared pane.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.evaluate("""mock.people=[{id:'old-person',name:'Old account record',position:'TEST',visible:false,sort_order:0}];mock.deferredRead={table:'cms_people',ms:1000};mock.deferredReadStarted=false""")
 x.locator('[data-pane="people"]').click();x.wait_for_function('mock.deferredReadStarted')
 x.locator('#personName').fill('Old unsaved input')
 x.evaluate("mock.authEvent('SIGNED_OUT');mock.mode='developer';mock.people=[];mock.authEvent('SIGNED_IN',{user:{id:'developer-test'}})")
 expect(x.locator('#studioRole')).to_have_text('DEVELOPER');expect(x.locator('#studioPanel')).to_be_visible()
 x.wait_for_timeout(1100);expect(x.locator('#personName')).to_have_value('')
 expect(x.locator('#peopleList')).not_to_contain_text('Old account record')
 x.locator('[data-pane="people"]').click();expect(x.locator('#peopleSummary')).to_contain_text('전체 0')
 ok('R0 delayed old-session read and unsaved structured form cleared');x.context.close()
 # An already dispatched write may finish on the server; its old continuation
 # must not clear a new account's form, initiate another write, or show success.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('[data-pane="people"]').click();expect(x.locator('#peopleSummary')).to_contain_text('전체 0')
 x.locator('#personName').fill('Old submitted fixture');x.evaluate('mock.delay=1800')
 x.locator('#peopleForm button[type="submit"]').click();x.wait_for_function('mock.calls.length===1')
 x.evaluate("mock.authEvent('SIGNED_OUT');mock.mode='developer';mock.authEvent('SIGNED_IN',{user:{id:'developer-test'}})")
 expect(x.locator('#studioRole')).to_have_text('DEVELOPER');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('[data-pane="people"]').click();expect(x.locator('#peopleSummary')).to_contain_text('전체 ')
 x.locator('#personName').fill('New account edit')
 x.wait_for_timeout(1900);expect(x.locator('#personName')).to_have_value('New account edit')
 assert x.evaluate('mock.calls.length')==1
 expect(x.locator('#studioMessage')).not_to_contain_text('People 정보가 저장되었습니다.')
 ok('R0 delayed write cannot clear or notify newer session');x.context.close()
 x=page();downloads=[];x.on('download',lambda d:downloads.append(d.suggested_filename))
 x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('[data-pane="access"]').click();expect(x.locator('#superadminCount')).to_have_text('1 / 3')
 x.evaluate("mock.deferredRead={table:'cms_posts',ms:900};mock.deferredReadStarted=false")
 x.locator('#exportData').click();x.wait_for_function('mock.deferredReadStarted')
 x.evaluate("mock.authEvent('SIGNED_OUT');mock.mode='anonymous'")
 expect(x.locator('#studioLogin')).to_be_visible();x.wait_for_timeout(1000)
 assert not downloads,downloads;expect(x.locator('#memberList')).not_to_contain_text('test@example.invalid')
 ok('R0 backup cancelled on session loss without stale export');x.context.close()
 # R1: semantic Reader equality, explicit read-only comparison and safe duplicate.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#adminPostList button').filter(has_text='Article A').click()
 x.locator('#publishPost').click();expect(x.locator('#confirmPublication')).to_be_disabled();[c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click();expect(x.locator('#editorMode')).to_contain_text('게시됨')
 count=x.evaluate('mock.calls.length')
 x.locator('#postKind').select_option('research');x.locator('#postTitle').fill('TEST ONLY Reader parity')
 x.locator('#postBody').fill('First line')
 x.locator('#postBody').evaluate('e=>e.setSelectionRange(0,5)')
 x.locator('[data-format="# "]').click();expect(x.locator('#postBody')).to_have_value('# First line')
 x.locator('#undoFormat').click();expect(x.locator('#postBody')).to_have_value('First line')
 x.locator('#redoFormat').click();expect(x.locator('#postBody')).to_have_value('# First line')
 x.locator('#postBody').fill('# Question\n본문 <img src=x onerror=alert(1)>\n\n## Evidence\n- 첫째\n- 둘째')
 expect(x.locator('#undoFormat')).to_be_disabled()
 x.locator('#postExcerpt').fill('Synthetic overview');x.locator('#researchSector').fill('Synthetic industry')
 x.locator('#researchCompany').fill('Synthetic company');x.locator('#researchAuthor').fill('Synthetic team')
 x.locator('#researchMethod').fill('Synthetic method');x.locator('#researchLimitations').fill('Synthetic limits')
 x.locator('#postCoverUrl').fill('https://example.invalid/cover.png');x.locator('#postAttachmentUrl').fill('https://example.invalid/report.pdf')
 x.locator('#postSchedule').fill('2027-03-01T09:00')
 reqs=[];x.on('request',lambda req:reqs.append(req.url))
 x.locator('#previewButton').click();expect(x.locator('#previewOverview')).to_be_visible()
 expect(x.locator('#previewToc button')).to_have_count(5)
 assert x.locator('#previewBody img').count()==0
 expect(x.locator('#previewAssetNote')).to_contain_text('외부 파일을 자동으로 불러오지 않습니다')
 x.locator('#previewWidth').click();expect(x.locator('#previewPanel')).to_have_class(__import__('re').compile('mobile-preview'))
 assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not any('example.invalid' in url for url in reqs)
 body=x.locator('#previewBody').inner_text();toc=x.locator('#previewToc button').all_text_contents();meta=x.locator('#previewResearchMeta').inner_text()
 x2=page('anonymous');x2.goto(base+'/#home')
 x2.evaluate("""()=>{SFC_READER.render({kind:'research',title:'TEST ONLY Reader parity',excerpt:'Synthetic overview',body:'# Question\\n본문 <img src=x onerror=alert(1)>\\n\\n## Evidence\\n- 첫째\\n- 둘째',research_sector:'Synthetic industry',research_company:'Synthetic company',research_author:'Synthetic team',research_method:'Synthetic method',research_limitations:'Synthetic limits',published_at:null},SFC_CMS)}""")
 assert x2.locator('#cmsPostBody').text_content()==x.locator('#previewBody').text_content()
 assert x2.locator('#readerToc button').all_text_contents()==toc
 assert x2.locator('#cmsPostMeta').text_content()==meta
 x2.context.close()
 x.locator('#closePreview').click();x.locator('#compareServer').click();expect(x.locator('#comparisonPanel')).to_be_visible()
 assert x.locator('#comparisonRows textarea').count()>=2
 assert x.locator('#comparisonRows textarea').evaluate_all('els=>els.every(e=>e.readOnly)')
 expect(x.locator('#comparisonRows .comparison-field').filter(has=x.get_by_role('heading',name='제목',exact=True)).locator('textarea').first).to_have_value('TEST ONLY Reader parity')
 x.locator('#closeComparison').click();x.locator('#historyButton').click();expect(x.locator('#historyList .studio-history-row')).to_have_count(1)
 x.locator('#historyList .studio-history-row button').last.click();expect(x.locator('#comparisonTitle')).to_contain_text('Revision #')
 x.locator('#duplicatePost').click();expect(x.locator('#postTitle')).to_have_value('복제 · TEST ONLY Reader parity')
 expect(x.locator('#editorMode')).to_have_text('NEW ARTICLE')
 for field in ['postCoverUrl','postAttachmentUrl','postSchedule']:
  expect(x.locator('#'+field)).to_have_value('')
 assert x.evaluate('mock.calls.length')==count
 assert x.evaluate("mock.rows.find(p=>p.id==='a').status")== 'published'
 ok('R1 shared semantic preview, safe markup, format undo/redo, comparison and duplicate');x.context.close()
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#insertGeneralOutline').click()
 assert '# 안내 사항' in x.locator('#postBody').input_value()
 original=x.locator('#postBody').input_value();x.locator('#insertGeneralOutline').click()
 assert x.locator('#postBody').input_value()==original and x.evaluate('mock.calls.length')==0
 ok('R1 general template protects existing body');x.context.close()
 # R2 review cancellation and required checks (no publication writes).
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#postTitle').fill('TEST ONLY review');x.locator('#postBody').fill('Synthetic body');x.locator('#publishPost').click()
 expect(x.locator('#publicationReview')).to_be_visible();expect(x.locator('#confirmPublication')).to_be_disabled()
 [c.check() for c in x.locator('#publicationChecks input').all()];x.keyboard.press('Escape')
 expect(x.locator('#publicationReview')).not_to_be_visible();assert x.evaluate('mock.calls.length===0 && mock.uploads.length===0')
 x.locator('#postSchedule').fill('2000-01-01T09:00');x.locator('#publishPost').click();expect(x.locator('#studioMessage')).to_contain_text('미래 시각')
 assert x.evaluate('mock.calls.length===0');ok('R2 required checklist, Escape cancellation and past schedule');x.context.close()
 # R2 stale review, session change, invalid bytes and partial upload / DB failure.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#postTitle').fill('TEST ONLY stale review');x.locator('#postBody').fill('Synthetic body');x.locator('#publishPost').click()
 [c.check() for c in x.locator('#publicationChecks input').all()]
 x.evaluate("document.getElementById('postTitle').value='Changed without event'")
 x.locator('#confirmPublication').click();expect(x.locator('#studioMessage')).to_contain_text('다시 검수')
 assert x.evaluate('mock.calls.length===0')
 x.locator('#publishPost').click();x.evaluate("mock.authEvent('SIGNED_OUT');mock.mode='anonymous'")
 expect(x.locator('#studioLogin')).to_be_visible();expect(x.locator('#publicationReview')).not_to_be_visible()
 assert x.evaluate('mock.calls.length===0');ok('R2 stale review and session isolation');x.context.close()
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#postTitle').fill('TEST ONLY file failure');x.locator('#postBody').fill('Synthetic body')
 x.locator('#postCoverFile').set_input_files({'name':'test.png','mimeType':'image/png','buffer':bytes([137,80,78,71,13,10,26,10])+b'TEST'})
 x.locator('#postPdfFile').set_input_files({'name':'invalid.pdf','mimeType':'application/pdf','buffer':b'NOT PDF'})
 x.locator('#publishPost').click();[c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click()
 expect(x.locator('#studioMessage')).to_contain_text('파일 헤더')
 assert x.evaluate('mock.uploads.length===0 && mock.calls.length===0')
 x.locator('#postPdfFile').set_input_files({'name':'test.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 TEST ONLY'})
 x.evaluate('mock.uploadFailAt=2');x.locator('#publishPost').click()
 [c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click()
 expect(x.locator('#studioMessage')).to_contain_text('PDF 업로드 실패');assert x.evaluate('mock.uploads.length===2 && mock.calls.length===0')
 expect(x.locator('#postTitle')).to_have_value('TEST ONLY file failure')
 x.evaluate('mock.uploadFailAt=0;mock.fail=true');x.locator('#publishPost').click()
 [c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click()
 expect(x.locator('#studioMessage')).to_contain_text('게시물 저장 실패');assert x.evaluate('mock.uploads.length===4 && mock.calls.length===1')
 expect(x.locator('#postTitle')).to_have_value('TEST ONLY file failure');ok('R2 preflight all files, partial upload and post failure preserve input');x.context.close()
 # Anonymous/public client never restores a privileged session.
 x=page();x.goto(base);x.wait_for_function('mock.clients.length===2')
 assert x.evaluate('mock.clients[1].auth.persistSession===false && mock.clients[1].auth.detectSessionInUrl===false')
 x.evaluate("mock.settings=[{key:'recruitment',value:{status:'open',pdf_url:'https://example.invalid/blank.pdf',docx_url:'https://example.invalid/blank.docx'}}]")
 x.evaluate('SFC_PUBLIC.load()');x.evaluate("location.hash='recruitment'")
 expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','form')
 x.locator('#applicationTrigger').click();expect(x.locator('#applicationFrame')).to_have_attribute('src','https://example.invalid/blank.pdf#toolbar=0')
 expect(x.locator('#applicationDownload')).to_have_attribute('href','https://example.invalid/blank.pdf')
 expect(x.locator('#applicationDocxDownload')).to_be_visible();x.locator('#applicationClose').click()
 ok('isolated public client and configured PDF/DOCX links (fixture only)');x.context.close()
 for mode in ['anonymous','nonadmin']:
  x=page(mode);x.goto(base+'/admin.html');expect(x.locator('#studioLogin')).to_be_visible();expect(x.locator('#studioPanel')).to_be_hidden()
  assert not x.evaluate('mock.calls.length');ok(mode+' denied Studio (mock)');x.context.close()
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('First save');x.locator('#postSchedule').fill('2027-03-01T09:00')
 x.evaluate('mock.delay=700');x.locator('#saveDraft').click()
 x.wait_for_function("mock.calls.length===1 && document.querySelector('#saveDraft').disabled")
 # Dispatch during the in-flight interval, independent of sidebar layout changes.
 x.locator('.admin-post-item').filter(has_text='Article B').dispatch_event('click')
 expect(x.locator('#postTitle')).to_have_value('First save')
 x.locator('#postTitle').fill('Newer input');x.wait_for_timeout(900)
 expect(x.locator('#postTitle')).to_have_value('Newer input');expect(x.locator('#postSchedule')).to_have_value('2027-03-01T09:00')
 expect(x.locator('#editorSavedAt')).to_have_text('저장되지 않은 변경사항')
 ok('save in flight blocks selection and preserves newer input / planned time')
 x.wait_for_function("mock.calls.length===2 && mock.rows[0].title==='Newer input'",timeout=7000)
 ok('queued changes autosave after manual save')
 x.evaluate('mock.conflict=true;mock.delay=0');x.locator('#postTitle').fill('Conflicting text');x.locator('#saveDraft').click()
 expect(x.locator('#editorSavedAt')).to_have_text('저장 실패');count=x.evaluate('mock.calls.length');x.wait_for_timeout(3700)
 assert x.evaluate('mock.calls.length')==count;expect(x.locator('#postTitle')).to_have_value('Conflicting text')
 ok('optimistic conflict preserves input and stops retry loop')
 x.evaluate('mock.conflict=false;mock.fail=true');x.locator('#saveDraft').click();expect(x.locator('#studioMessage')).to_contain_text('simulated failure')
 ok('save error shown without data loss')
 x.evaluate('mock.fail=false');x.locator('#saveDraft').click();expect(x.locator('#editorSavedAt')).to_have_text('서버에 저장됨')
 x.locator('#publishPost').click();[c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click();expect(x.locator('#editorMode')).to_contain_text('예약 발행')
 assert x.evaluate("mock.rows[0].scheduled_at!==null")
 x.locator('#trashPost').click();expect(x.locator('#restorePost')).to_be_visible()
 x.locator('#restorePost').click();expect(x.locator('#confirmPublication')).to_be_disabled();[c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click();expect(x.locator('#postForm')).to_be_visible()
 ok('scheduled publish, trash and restore (mock)')
 x.locator('#unpublishPost').click();expect(x.locator('#editorMode')).to_contain_text('임시글')
 x.locator('#historyButton').click();expect(x.locator('#historyList button').first).to_be_visible()
 x.locator('#historyList button').first.click();count=x.evaluate('mock.calls.length');x.wait_for_timeout(3000)
 assert x.evaluate('mock.calls.length')==count
 ok('draft revision loads without implicit write')
 x.locator('#saveDraft').click();expect(x.locator('#editorSavedAt')).to_have_text('서버에 저장됨')
 x.locator('#trashPost').click();expect(x.locator('#deletePost')).to_be_visible()
 x.evaluate('mock.conflict=true');x.locator('#deletePost').click();expect(x.locator('#studioMessage')).to_contain_text('다른 곳에서 수정')
 assert x.evaluate('mock.rows.length')==2
 x.evaluate('mock.conflict=false');x.locator('#deletePost').click();expect(x.locator('#editorMode')).to_have_text('NEW ARTICLE')
 assert x.evaluate('mock.rows.length')==1
 ok('permanent delete detects stale version, then deletes only selected fixture')
 for mime,size in [('text/html',100),('application/pdf',0),('application/pdf',20971521)]:
  assert x.evaluate('''async v=>{try{await SFC_STUDIO.upload({type:v[0],size:v[1]},'pdf');return false;}catch(e){return true;}}''',[mime,size])
 ok('upload rejects wrong MIME, empty and oversized files')
 x.context.close()
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('Recovered local edit');x.locator('#postCoverUrl').fill('http://invalid.example')
 x.locator('#postSchedule').fill('2027-03-01T09:00');x.wait_for_timeout(500)
 x.reload();expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 expect(x.locator('#postTitle')).to_have_value('Recovered local edit')
 expect(x.locator('#postCoverUrl')).to_have_value('http://invalid.example')
 expect(x.locator('#postSchedule')).to_have_value('2027-03-01T09:00')
 ok('reload restores raw local scratch including invalid URL and schedule')
 x.context.close()
 # Declining restore must never replace the deferred snapshot.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('UNSAVED ORIGINAL')
 x.locator('#newPost').click()
 x.evaluate("window.confirm=()=>false")
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 expect(x.locator('#postTitle')).to_have_value('Article A')
 x.locator('#postTitle').fill('A different edit');x.wait_for_timeout(500)
 assert any('UNSAVED ORIGINAL' in t for t in x.locator('#recoverySelect option').all_text_contents())
 assert any('A different edit' in t for t in x.locator('#recoverySelect option').all_text_contents())
 ok('P1 declined recovery survives later edits');x.context.close()
 # P1: multi-draft session recovery, stable insert ID, draft file boundary.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('A unsaved')
 x.locator('.admin-post-item').filter(has_text='Article B').click()
 x.locator('#postTitle').fill('B unsaved')
 x.locator('#newPost').click();x.locator('#postTitle').fill('New one')
 x.locator('#newPost').click();x.locator('#postTitle').fill('New two')
 x.locator('#newPost').click()
 expect(x.locator('#recoverySelect option')).to_have_count(5)
 options=x.locator('#recoverySelect option').all_text_contents()
 assert any('A unsaved' in t for t in options) and any('B unsaved' in t for t in options)
 assert any('New one' in t for t in options) and any('New two' in t for t in options)
 x.locator('#recoverySelect').select_option(label=next(t for t in options if 'New one' in t))
 x.locator('#recoverWork').click();expect(x.locator('#postTitle')).to_have_value('New one')
 assert x.evaluate('mock.calls.length')==0
 ok('P1 independent recovery of existing and new incomplete drafts');x.context.close()

 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#postTitle').fill('TEST ONLY stable insert');x.locator('#postBody').fill('Synthetic body')
 x.evaluate('mock.loseInsertAck=true');x.locator('#saveDraft').click()
 expect(x.locator('#editorSavedAt')).to_have_text('저장 실패')
 x.locator('#saveDraft').click();expect(x.locator('#studioMessage')).to_contain_text('duplicate primary key')
 assert x.evaluate("mock.rows.filter(r=>r.title==='TEST ONLY stable insert').length") == 1
 assert x.evaluate("mock.calls[0].payload.id===mock.calls[1].payload.id")
 ok('P1 lost insert response retry does not duplicate row');x.context.close()

 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('TEST ONLY draft file')
 x.locator('#postPdfFile').set_input_files({'name':'test-only.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 TEST ONLY'})
 x.locator('#saveDraft').click();expect(x.locator('#editorSavedAt')).to_have_text('서버에 저장됨')
 assert x.evaluate('mock.uploads.length===0')
 assert x.locator('#postPdfFile').evaluate('el=>el.files.length')==1
 expect(x.locator('#editorFileNote')).to_contain_text('test-only.pdf')
 x.locator('#previewButton').click();expect(x.locator('#previewLocalPdf')).to_have_attribute('href',__import__('re').compile(r'^blob:'))
 assert x.evaluate('mock.uploads.length===0')
 x.locator('#closePreview').click()
 x.locator('#postSchedule').fill('2027-03-01T09:00');x.locator('#publishPost').click()
 expect(x.locator('#studioMessage')).to_contain_text('예약 발행에 공개 파일')
 assert x.evaluate('mock.uploads.length===0')
 x.locator('#postSchedule').fill('');x.locator('#publishPost').click()
 expect(x.locator('#confirmPublication')).to_be_disabled();[c.check() for c in x.locator('#publicationChecks input').all()];x.locator('#confirmPublication').click()
 expect(x.locator('#editorMode')).to_contain_text('게시됨')
 assert x.evaluate('mock.uploads.length===1 && mock.rows[0].status==="published"')
 x.locator('#postTitle').fill('TEST ONLY unpublished edit');x.keyboard.press('Control+s')
 assert x.evaluate('mock.rows[0].title==="TEST ONLY draft file" && mock.rows[0].status==="published"')
 ok('P1 file upload only on confirmed immediate publication; Ctrl+S never unpublishes');x.context.close()

 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('.admin-post-item').filter(has_text='Article A').click()
 x.locator('#postTitle').fill('TEST ONLY auth transition');x.evaluate('mock.delay=900')
 x.locator('#saveDraft').click();x.evaluate("mock.mode='anonymous';mock.authEvent('SIGNED_OUT')")
 expect(x.locator('#studioLogin')).to_be_visible();x.wait_for_timeout(1100)
 expect(x.locator('#postTitle')).to_have_value('')
 assert x.evaluate('document.querySelector("#adminPostList").childElementCount===0')
 ok('P1 stale save response does not repopulate editor after sign-out');x.context.close()
 # Header dimensions are matched to public homepage at standard widths.
 for width in [1440,768,390,360]:
  x=page('anonymous',width);x.goto(base)
  public_header=x.locator('.site-header').evaluate('el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el.querySelector(".brand-mark")).fontSize})')
  x.goto(base+'/admin.html');expect(x.locator('#studioLogin')).to_be_visible()
  studio_header=x.locator('.studio-header').evaluate('el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el.querySelector(".studio-brand-mark")).fontSize})')
  assert public_header==studio_header,(width,public_header,studio_header)
  expect(x.locator('#studioLogin')).to_contain_text('로그인 없이')
  assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  x.context.close()
 ok('P2 public and login header dimensions and login guidance at 4 widths')
 # P2/P3 offline import and authoring, synthetic content only.
 x=page();x.goto(base+'/admin.html');expect(x.locator('#studioPanel')).to_be_visible()
 x.locator('#postSearch').fill('Article B');expect(x.locator('.admin-post-item')).to_have_count(1)
 x.locator('#postSearch').fill('');expect(x.locator('.admin-post-item')).to_have_count(2)
 x.locator('#openImporter').click();expect(x.locator('#importPanel')).to_be_visible()
 x.locator('#importText').fill('{"schema_version":"0.1","kind":"research","status":"published"}')
 x.locator('#validateImport').click();expect(x.locator('#applyImport')).to_be_disabled()
 payload={'schema_version':'0.1','kind':'research','source':{'filename':'TEST ONLY'},'article':{'title':'TEST ONLY imported research','body':'# Research question\nSynthetic body','research_author':'Test team'},'evidence':[{'claim':'Synthetic claim','locator':'p. 1','review_status':'unverified'}],'references':[],'issues':[]}
 import json
 x.locator('#importText').fill(json.dumps(payload));x.locator('#validateImport').click()
 expect(x.locator('#applyImport')).to_be_enabled();x.locator('#importFields input[data-field="research_author"]').uncheck();x.locator('#applyImport').click()
 expect(x.locator('#researchAuthor')).to_have_value('')
 expect(x.locator('#postTitle')).to_have_value(payload['article']['title'])
 expect(x.locator('#postKind')).to_have_value('research')
 expect(x.locator('#importReviewContent')).to_contain_text('Synthetic claim')
 x.locator('#postExcerpt').fill('Synthetic excerpt');x.wait_for_timeout(2900)
 assert x.evaluate('mock.calls.length')==0
 x.locator('#previewButton').click();expect(x.locator('#previewTitle')).to_have_text(payload['article']['title'])
 x.locator('#previewWidth').click();expect(x.locator('#previewPanel')).to_have_class(__import__('re').compile('mobile-preview'))
 x.locator('#closePreview').click();x.locator('#saveDraft').click();expect(x.locator('#editorSavedAt')).to_have_text('서버에 저장됨')
 assert x.evaluate("mock.rows.some(r=>r.kind==='research' && r.title==='TEST ONLY imported research' && r.status==='draft')")
 ok('P2/P3 offline JSON validation, manual draft gate, preview, search and save');x.context.close()

 # Motion regression coverage: sample and live lists, same nodes/controls,
 # reverse selection, rapidly repeated clicks, scroll return and reduced motion.
 x=page('anonymous');x.goto(base+'/#activities')
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(11)
 x.evaluate("""()=>{window.stageButton=document.querySelector('#scheduleTabs [data-value="research"]');window.finalRow=document.querySelector('#scheduleList [data-session="10"]')}""")
 x.locator('#scheduleTabs [data-value="research"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(2)
 assert x.evaluate('stageButton===document.querySelector(\'#scheduleTabs [data-value="research"]\') && finalRow===document.querySelector(\'#scheduleList [data-session="10"]\')')
 x.locator('#scheduleTabs [data-value="application"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(5)
 x.locator('#scheduleTabs [data-value="foundation"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(4)
 x.locator('#scheduleTabs [data-value="all"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(11)
 x.evaluate("""()=>['research','all','application','foundation','research'].forEach(s=>document.querySelector('#scheduleTabs [data-value="'+s+'"]').click())""")
 expect(x.locator('#scheduleTabs [aria-pressed="true"]')).to_have_attribute('data-value','research')
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(2)
 expect(x.locator('.motion-snapshot-layer')).to_have_count(0)
 x.wait_for_function("document.querySelector('#scheduleList').getAnimations({subtree:true}).length===0")
 x.locator('#scheduleList .session[data-active=true] .session-button').first.click()
 expect(x.locator('#scheduleList .session[data-active=true] .session-button').first).to_have_attribute('aria-expanded','true')
 x.locator('#scheduleList .session[data-active=true] .session-button').last.click()
 expect(x.locator('#scheduleList .session[data-active=true] .session-button').first).to_have_attribute('aria-expanded','false')
 expect(x.locator('#scheduleList .session[data-active=true] .session-button').last).to_have_attribute('aria-expanded','true')
 ok('sample stage forward/reverse/rapid transitions preserve control and retained row identity')
 # Switch to actual CMS session fixture and then remove it.
 x.evaluate("""()=>{mock.sessions=[
  {id:'one',week_label:'01',title:'Foundation fixture',stage:'foundation',detail:'Details',summary:'Intro',sort_order:0,visible:true},
  {id:'two',week_label:'15',title:'Research fixture',stage:'research',detail:'Details',summary:'Final',sort_order:1,visible:true}];
  return SFC_PUBLIC.load()}""")
 expect(x.locator('#scheduleTabs [aria-pressed="true"]')).to_have_attribute('data-value','research')
 expect(x.locator('#scheduleList .cms-session[data-active=true]')).to_have_count(1)
 x.locator('#scheduleTabs [data-value="foundation"]').click()
 expect(x.locator('#scheduleList .cms-session[data-active=true] .cms-session-head')).to_contain_text('Foundation fixture')
 x.locator('#scheduleList .cms-session[data-active=true] .cms-session-head').click()
 expect(x.locator('#scheduleList .cms-session[data-active=true] .cms-session-head')).to_have_attribute('aria-expanded','true')
 x.evaluate('mock.sessions=[];SFC_PUBLIC.load()')
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(4)
 x.locator('#scheduleTabs [data-value="all"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(11)
 ok('CMS curriculum shares filter controls, disclosure and sample fallback')
 x.context.close()
 x=page('anonymous');x.set_viewport_size({'width':1100,'height':500});x.goto(base+'/#research')
 expect(x.locator('#researchWorkbench')).to_be_visible()
 expect(x.locator('#archiveResults .archive-report')).to_have_count(4)
 x.locator('#archiveSearch').fill('기업')
 x.wait_for_timeout(350)
 assert x.locator('#archiveResults .archive-report').count()>0
 x.locator('#archiveGridButton').click()
 expect(x.locator('#archiveResults')).to_have_class('archive-results grid')
 x.evaluate("window.scrollTo(0,Math.min(220,document.documentElement.scrollHeight-innerHeight))")
 x.locator('#archiveResults .archive-report').first.scroll_into_view_if_needed()
 x.wait_for_timeout(150);stored=x.evaluate('scrollY')
 x.locator('#archiveResults .archive-report').first.click()
 expect(x.locator('#post.reader-demo')).to_be_visible()
 expect(x.locator('#readerOverviewText')).to_contain_text('DEMONSTRATION')
 x.evaluate("navigate('research')")
 expect(x.locator('#researchWorkbench')).to_be_visible()
 expect(x.locator('#archiveSearch')).to_have_value('기업')
 expect(x.locator('#archiveGridButton')).to_have_attribute('aria-pressed','true')
 x.wait_for_timeout(350)
 actual=x.evaluate("scrollY")
 max_scroll=x.evaluate("Math.max(0,document.documentElement.scrollHeight-innerHeight)")
 assert abs(actual-min(stored,max_scroll))<16,(stored,max_scroll,actual)
 ok('integrated archive search/grid and return state')
 x.context.close()
 x=page('anonymous');x.goto(base)
 expect(x.locator('#heroPause')).to_have_count(0)
 x.locator('.hero-controls button').first.click()
 expect(x.locator('.hero-controls button').first).to_have_attribute('aria-label','1번 대표 이미지, 자동 재생 시작')
 x.locator('.hero-controls button').first.click()
 expect(x.locator('.hero-controls button').first).to_have_attribute('aria-label','1번 대표 이미지, 자동 재생 일시정지')
 widths=x.locator('.hero-controls button').evaluate_all("(els)=>els.map(e=>e.getBoundingClientRect().width)")
 assert max(widths)-min(widths)<1
 assert abs(x.locator('.hero-controls').bounding_box()['width']-x.locator('.hero-progress-track').bounding_box()['width'])<1
 x.evaluate("document.querySelectorAll('.hero-controls button')[1].click()")
 expect(x.locator('#heroButton')).to_have_attribute('data-route','research')
 x.evaluate("document.querySelector('#heroButton').click()")
 expect(x.locator('#research')).to_be_visible()
 x.emulate_media(reduced_motion='reduce')
 x.evaluate("navigate('activities')")
 x.locator('#scheduleTabs [data-value="research"]').click()
 expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(2)
 x.wait_for_timeout(100)
 assert x.evaluate("document.querySelector('#scheduleList').getAnimations({subtree:true}).length===0")
 ok('three balanced hero controls, accessible pause, CTA synchronization and reduced motion')
 x.context.close()
 # Unified archive swaps and preserved Activities stage transitions.
 x=page('anonymous');x.goto(base+'/#research')
 expect(x.locator('#archiveResults .archive-report')).to_have_count(4)
 x.locator('#archiveSectors [data-value="케이스"]').click()
 expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
 x.wait_for_function("document.querySelector('#archiveResults').getAnimations({subtree:true}).length===0")
 x.locator('#archiveSectors [data-value="교육자료"]').click()
 expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
 x.wait_for_function("document.querySelector('#archiveResults').getAnimations({subtree:true}).length===0")
 x.locator('#archiveSectors [data-value="케이스"]').click()
 expect(x.locator('#archiveResults .archive-report')).to_have_count(1)
 x.wait_for_function("document.querySelector('#archiveResults').getAnimations({subtree:true}).length===0")
 expect(x.locator('.motion-snapshot-layer')).to_have_count(0)
 ok('research 1-to-1 swaps do not leave interactive clones')
 def swap(root,control,value,expected):
  result=x.evaluate("""([root,control,value])=>{
    const b=[...document.querySelectorAll(control+' button')].find(e=>e.dataset.value===value);
    b.click();
    const list=document.querySelector(root);
    return [...list.children].filter(e=>e.dataset.active==='true').map(e=>{
      const a=e.getAnimations().find(a=>a.effect?.getKeyframes().some(k=>k.height));
      return a?{duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes().map(k=>({opacity:k.opacity,height:k.height,transform:k.transform}))}:null;
    });
  }""",[root,control,value])
  assert len(result)==expected and all(a and a['duration']==670 for a in result),result
  assert all(all(k.get('transform') in (None,'none') for k in a['frames']) for a in result),result
  expect(x.locator('.motion-snapshot-layer')).to_have_count(0)
  x.wait_for_function("(root)=>document.querySelector(root).getAnimations({subtree:true}).length===0",arg=root)
  return result[0]
 x.evaluate("navigate('activities')")
 x.locator('#scheduleTabs [data-value="application"]').click()
 x.wait_for_function("document.querySelector('#scheduleList').getAnimations({subtree:true}).length===0")
 expect(x.locator('.motion-snapshot-layer')).to_have_count(0)
 forward=swap('#scheduleList','#scheduleTabs','research',2)
 reverse=swap('#scheduleList','#scheduleTabs','application',5)
 assert forward['duration']==reverse['duration']
 assert [str(k.get('opacity')) for k in forward['frames']]==[str(k.get('opacity')) for k in reverse['frames']]
 assert str(forward['frames'][0]['opacity']) in ('0','0.0')
 assert str(forward['frames'][-1]['opacity']) in ('1','1.0')
 ok('activities disjoint 5-to-2 and 2-to-5 swaps share the same timeline')
 duration=x.evaluate("""()=>{navigate('recruitment');return document.querySelector('#recruitment').getAnimations()[0].effect.getTiming().duration}""")
 assert duration==1100,'v2.8.4 scene should settle between prior fast and slow variants'
 x.locator('#applicationTrigger').scroll_into_view_if_needed()
 # Wait for viewport-triggered transforms before positioning the mouse.
 x.wait_for_function("""()=>{const e=document.querySelector('#applicationTrigger');return [e.closest('.application-cta'),e.closest('.view')].every(n=>!n||n.getAnimations().length===0)}""")
 x.locator('#applicationTrigger').hover()
 assert x.locator('#applicationTrigger').bounding_box()['height']>=44
 ok('recruitment remains interactive during softly restored scene entrance')
 x.context.close()
 # Activities must not shift horizontally even when the document changes
 # from 5 rows to 2 rows (or the other direction) at desktop/mobile widths.
 for viewport in [1440,768,360]:
  x=page('anonymous');x.set_viewport_size({'width':viewport,'height':850});x.goto(base+'/#activities')
  root=x.locator('#scheduleList')
  initial_left=root.evaluate("el=>el.getBoundingClientRect().left")
  x.locator('#scheduleTabs [data-value="application"]').click()
  x.locator('#scheduleTabs [data-value="research"]').click()
  expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(2)
  result=x.evaluate("""async()=>{
    const root=document.querySelector('#scheduleList'),left=root.getBoundingClientRect().left;
    const rows=[...root.children];
    const states=[];
    for(let i=0;i<12;i++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      states.push({
        left:root.getBoundingClientRect().left,
        translated:rows.some(row=>row.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.transform&&k.transform.includes('translateX')))),
        ghosts:document.querySelectorAll('.motion-snapshot-layer').length
      });
    }
    return {left,states};
  }""")
  assert abs(initial_left-result['left'])<1.5,(viewport,initial_left,result)
  assert all(abs(v['left']-initial_left)<1.5 and not v['translated'] and v['ghosts']==0 for v in result['states']),result
  x.locator('#scheduleTabs [data-value="application"]').click()
  expect(x.locator('#scheduleList .session[data-active=true]')).to_have_count(5)
  assert abs(root.evaluate("el=>el.getBoundingClientRect().left")-initial_left)<1.5
  x.context.close()
 ok('activities fixed horizontal position on both transitions at 1440/768/360px')
 # v2.8 motion regression: grid reflow preserves item identities and no whole-page opacity intro.
 x=page('anonymous');x.goto(base+'/#research')
 first=x.evaluate("document.querySelector('#archiveResults .archive-report')")
 x.evaluate("""()=>{window.v28FirstReport=document.querySelector('#archiveResults .archive-report')}""")
 x.locator('#archiveGridButton').click()
 expect(x.locator('#archiveResults')).to_have_class('archive-results grid')
 assert x.evaluate("window.v28FirstReport===document.querySelector('#archiveResults .archive-report')")
 assert x.evaluate("Boolean(window.SFC_V28?.enter) && window.SFC_MOTION.timing.layout===670")
 x.locator('#archiveListButton').click()
 expect(x.locator('#archiveResults')).to_have_class('archive-results')
 x.wait_for_function("document.querySelector('#archiveResults').getAnimations({subtree:true}).length===0")
 assert x.locator('.motion-snapshot-layer').count()==0
 ok('v2.8.4: list/grid preserves DOM while restored scene plays independently')
 x.context.close()
 # Activities page title and supporting type must share the same size scale
 # as the other public tabs, rather than the older oversized default.
 for width in [1440,768,390,360]:
  x=page('anonymous',width)
  x.goto(base+'/#activities')
  activity=x.locator('#activities .page-head h1')
  research=x.locator('#research .page-head h1')
  assert abs(float(activity.evaluate("e=>getComputedStyle(e).fontSize.replace('px','')"))-
             float(research.evaluate("e=>getComputedStyle(e).fontSize.replace('px','')")))<1,(width,'font scale')
  expect(x.locator('#activities .journey-context')).to_be_visible()
  assert x.evaluate("document.documentElement.scrollWidth <= innerWidth+1"),width
  x.context.close()
 ok('Activities title scale matches Research at four desktop/mobile widths')
 # Balanced-duration opacity regression: the title must genuinely start
 # transparent, remain partially faded mid-way, then finish fully visible.
 # A delayed WAAPI effect must use fill:backwards to prevent pre-animation flashes.
 x=page('anonymous')
 x.goto(base+'/#home')
 x.evaluate("navigate('about')")
 heading=x.locator('#about .page-head h1')
 x.wait_for_timeout(120)
 early=float(heading.evaluate("e=>getComputedStyle(e).opacity"))
 x.wait_for_timeout(650)
 middle=float(heading.evaluate("e=>getComputedStyle(e).opacity"))
 x.wait_for_timeout(1650)
 finished=float(heading.evaluate("e=>getComputedStyle(e).opacity"))
 assert 0<=early<0.12,(early,middle,finished)
 assert early<middle<0.93,(early,middle,finished)
 assert finished>=.98,(early,middle,finished)
 x.evaluate("navigate('activities')")
 activity_title=x.locator('#activities .page-head h1')
 x.wait_for_timeout(150)
 early_activity=float(activity_title.evaluate("e=>getComputedStyle(e).opacity"))
 assert early_activity<0.15,early_activity
 x.wait_for_timeout(2300)
 assert float(activity_title.evaluate("e=>getComputedStyle(e).opacity"))>=.98
 ok('v2.8.4: headings remain transparent initially at a moderate pace')
 x.context.close()
 # Every tab requires a different composition grammar; not just direction stagger.
 x=page('anonymous')
 x.goto(base+'/#home')
 expected={
  'home':('photographic-typographic-mask','#heroHeading'),
  'about':('diagram-connect-and-column-reveal','.about-photo-panel'),
  'research':('workspace-expand-and-spatial-flip','.archive-search-row'),
  'activities':('fifteen-week-timeline-drop','#scheduleList .session[data-active="true"]'),
  'people':('typographic-index-print','.page-head h1'),
  'recruitment':('fact-grid-center-bloom','.recruit-fact'),
  'updates':('publication-line-ink','.updates-section-heading')
 }
 starts={}
 for route,(signature,selector) in expected.items():
  x.evaluate("(r)=>navigate(r)",route)
  assert x.locator('#'+route).get_attribute('data-motion-signature')==signature,(route,signature)
  snapshot=x.evaluate("""({route,selector})=>{
    const el=document.querySelector('#'+route+' '+selector);
    const animation=el?.getAnimations()[0];
    return animation?{duration:animation.effect.getTiming().duration,
      start:animation.effect.getKeyframes()[0]?.clipPath||null}:null;
  }""",{'route':route,'selector':selector})
  assert snapshot and snapshot['start'],(route,snapshot)
  starts[route]=snapshot['start']
 assert starts['home']!=starts['people']
 assert starts['research']!=starts['activities']
 assert starts['recruitment']!=starts['updates']
 ok('v2.8.4: seven independent page signatures and structural motion keyframes')
 x.context.close()
 # About experience communicates 4 distinct stages without a real-results claim.
 x=page('anonymous');x.goto(base+'/#about')
 expect(x.locator('.about-reason')).to_have_count(3)
 for i,label in enumerate(['Observe','Analyze','Value','Defend']):
  tab=x.locator('[data-experience-step="'+str(i)+'"]')
  tab.click()
  expect(tab).to_have_attribute('aria-selected','true')
  expect(x.locator('.experience-visual-stage.active')).to_have_count(1)
  expect(x.locator('#experiencePanel')).to_have_attribute('aria-labelledby','experienceTab'+str(i))
 x.locator('#experienceNext').click()
 expect(x.locator('[data-experience-step="0"]')).to_have_attribute('aria-selected','true')
 x.locator('[data-experience-step="0"]').press('ArrowRight')
 expect(x.locator('[data-experience-step="1"]')).to_have_attribute('aria-selected','true')
 ok('About interactive research journey, keyboard tablist and honest copy')
 x.context.close()
 # Copy readability: sentence blocks on desktop, natural reflow on phones,
 # no clipped headings across all content-heavy public routes.
 for width in [1440,900,768,390,360]:
  x=page('anonymous',width)
  x.goto(base+'/#home')
  expect(x.locator('.home-value-copy h2')).to_contain_text('숫자를 아는 것에서')
  expect(x.locator('.home-value-copy .editorial-copy')).to_contain_text('15주 과정')
  for route in ['home','about','research','activities','people','recruitment','updates']:
   x.evaluate('(r)=>navigate(r)',route)
   expect(x.locator('#'+route)).to_be_visible()
   # Final-layout check: the requested off-screen entrance intentionally
   # has heading right edges outside their columns while animating.
   x.evaluate("""()=>document.getAnimations().forEach(a=>{
     try{if(Number.isFinite(a.effect?.getComputedTiming().endTime))a.finish()}catch(_){}
   })""")
   assert x.evaluate("document.documentElement.scrollWidth <= innerWidth+1"),(width,route)
   assert x.evaluate("""()=>[...document.querySelectorAll('.view.active h1,.view.active h2,.view.active h3')]
      .every(el=>el.getBoundingClientRect().right <= innerWidth+3)"""),(width,route)
  x.context.close()
 ok('semantic copy grouping and responsive line wrapping at 1440/900/768/390/360px')
 # User-approved About copy: exact Korean wording, desktop line grouping,
 # and natural mobile reflow across all four interactive learning stages.
 expected_intro=["SFC는 상명대학교 경영학부 기업재무분석 학술동아리로,",
                 "기업의 사업구조를 살피고 재무제표와 가치평가 모델을 분석합니다.",
                 "팀별 토론과 최종 보고서 발표까지 이어지는 15주 과정으로 진행됩니다."]
 expected_stages=[["제품과 고객, 산업 구조를 살피며 재무 데이터 이전에","기업의 사업을 이해하는 질문부터 시작합니다."],["재무제표와 현금흐름의 연결을 확인하고,","수익성 변화가 발생한 이유를 분석하는 과정을 연습합니다."],["비교기업과 현금흐름 가정의 적절성을 따지며,","다양한 가치평가 결과를 검증합니다."],["팀별 토론과 발표를 통해 가정과 한계를 검토하고,","분석 결과를 하나의 리포트로 정리하는 것을 목표로 합니다."]]
 for width in [1440,1280,960,390,360]:
  x=page('anonymous',width)
  x.goto(base+'/#about')
  intro=x.locator('.about-photo-panel .about-approved-copy .about-line')
  expect(intro).to_have_count(3)
  assert [v.strip() for v in intro.all_inner_texts()]==expected_intro,(width,intro.all_inner_texts())
  assert all(v=="block" for v in intro.evaluate_all("(els)=>els.map(e=>getComputedStyle(e).display)"))
  for i,lines in enumerate(expected_stages):
   x.locator('[data-experience-step="'+str(i)+'"]').click()
   copy=x.locator('#experienceCopy .about-line')
   expect(copy).to_have_count(2)
   assert [v.strip() for v in copy.all_inner_texts()]==lines,(width,i,copy.all_inner_texts())
  assert x.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),width
  x.context.close()
 ok('About approved line breaks, four interactive stages and mobile reflow')
 browser.close()
server.shutdown();print(f'{checks} browser scenarios passed; live Auth/RLS/Storage NOT exercised.')
