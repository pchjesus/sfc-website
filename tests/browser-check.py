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
  x.locator('#applicationTrigger').click();expect(x.locator('#applicationUnavailable')).to_be_visible()
  expect(x.locator('#applicationDownload')).to_be_hidden();x.keyboard.press('Escape')
  expect(x.locator('#applicationTrigger')).to_be_focused()
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
 # Anonymous/public client never restores a privileged session.
 x=page();x.goto(base);x.wait_for_function('mock.clients.length===2')
 assert x.evaluate('mock.clients[1].auth.persistSession===false && mock.clients[1].auth.detectSessionInUrl===false')
 x.evaluate("mock.settings=[{key:'recruitment',value:{pdf_url:'https://example.invalid/blank.pdf',docx_url:'https://example.invalid/blank.docx'}}]")
 x.evaluate('SFC_PUBLIC.load()');x.evaluate("location.hash='recruitment'")
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
 x.locator('.admin-post-item').filter(has_text='Article B').click()
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
 x.locator('#publishPost').click();expect(x.locator('#editorMode')).to_contain_text('예약 발행')
 assert x.evaluate("mock.rows[0].scheduled_at!==null")
 x.locator('#trashPost').click();expect(x.locator('#restorePost')).to_be_visible()
 x.locator('#restorePost').click();expect(x.locator('#postForm')).to_be_visible()
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
 # Motion regression coverage: sample and live lists, same nodes/controls,
 # reverse selection, rapidly repeated clicks, scroll return and reduced motion.
 x=page('anonymous');x.goto(base+'/#activities')
 expect(x.locator('#scheduleList .session')).to_have_count(11)
 x.evaluate("""()=>{window.stageButton=document.querySelector('#scheduleTabs [data-value="research"]');window.finalRow=document.querySelector('#scheduleList [data-session="10"]')}""")
 x.locator('#scheduleTabs [data-value="research"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(2)
 assert x.evaluate('stageButton===document.querySelector(\'#scheduleTabs [data-value="research"]\') && finalRow===document.querySelector(\'#scheduleList [data-session="10"]\')')
 x.locator('#scheduleTabs [data-value="application"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(5)
 x.locator('#scheduleTabs [data-value="foundation"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(4)
 x.locator('#scheduleTabs [data-value="all"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(11)
 x.evaluate("""()=>['research','all','application','foundation','research'].forEach(s=>document.querySelector('#scheduleTabs [data-value="'+s+'"]').click())""")
 expect(x.locator('#scheduleTabs [aria-pressed="true"]')).to_have_attribute('data-value','research')
 expect(x.locator('#scheduleList .session')).to_have_count(2)
 x.wait_for_timeout(500)
 assert x.evaluate("!document.querySelector('body > .session[aria-hidden=true]')")
 x.locator('#scheduleList .session-button').first.click()
 expect(x.locator('#scheduleList .session-button').first).to_have_attribute('aria-expanded','true')
 x.locator('#scheduleList .session-button').last.click()
 expect(x.locator('#scheduleList .session-button').first).to_have_attribute('aria-expanded','false')
 expect(x.locator('#scheduleList .session-button').last).to_have_attribute('aria-expanded','true')
 ok('sample stage forward/reverse/rapid transitions preserve control and retained row identity')
 # Switch to actual CMS session fixture and then remove it.
 x.evaluate("""()=>{mock.sessions=[
  {id:'one',week_label:'01',title:'Foundation fixture',stage:'foundation',detail:'Details',summary:'Intro',sort_order:0,visible:true},
  {id:'two',week_label:'15',title:'Research fixture',stage:'research',detail:'Details',summary:'Final',sort_order:1,visible:true}];
  return SFC_PUBLIC.load()}""")
 expect(x.locator('#scheduleTabs [aria-pressed="true"]')).to_have_attribute('data-value','research')
 expect(x.locator('#scheduleList .cms-session')).to_have_count(1)
 x.locator('#scheduleTabs [data-value="foundation"]').click()
 expect(x.locator('#scheduleList .cms-session-head')).to_contain_text('Foundation fixture')
 x.locator('#scheduleList .cms-session-head').click()
 expect(x.locator('#scheduleList .cms-session-head')).to_have_attribute('aria-expanded','true')
 x.evaluate('mock.sessions=[];SFC_PUBLIC.load()')
 expect(x.locator('#scheduleList .session')).to_have_count(4)
 x.locator('#scheduleTabs [data-value="all"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(11)
 ok('CMS curriculum shares filter controls, disclosure and sample fallback')
 x.context.close()
 x=page('anonymous');x.set_viewport_size({'width':1100,'height':500});x.goto(base+'/#research')
 expect(x.locator('#reportResults .report-item')).to_have_count(4)
 x.locator('#searchReports').fill('기업')
 expect(x.locator('#reportResults .report-item').first).to_be_visible()
 x.evaluate("document.querySelector('[data-layout=grid]').click()")
 expect(x.locator('#reportResults')).to_have_class('report-list grid')
 x.evaluate("window.scrollTo(0,Math.min(240,document.documentElement.scrollHeight-innerHeight))")
 x.wait_for_timeout(200);stored=x.evaluate('scrollY')
 x.evaluate("document.querySelector('#reportResults .report-item').click()")
 expect(x.locator('#detail')).to_be_visible()
 x.evaluate("navigate('research')")
 expect(x.locator('#research')).to_be_visible()
 expect(x.locator('#searchReports')).to_have_value('기업')
 expect(x.locator('[data-layout=grid]')).to_have_attribute('aria-pressed','true')
 x.wait_for_timeout(400);assert abs(x.evaluate('scrollY')-stored)<12
 ok('research list/grid transition and filter/scroll restoration')
 x.context.close()
 x=page('anonymous');x.goto(base)
 x.locator('#heroPause').click();expect(x.locator('#heroPause')).to_have_attribute('aria-pressed','true')
 x.evaluate("document.querySelectorAll('.hero-controls button')[1].click()")
 expect(x.locator('#heroButton')).to_have_attribute('data-route','research')
 x.evaluate("document.querySelector('#heroButton').click()")
 expect(x.locator('#research')).to_be_visible()
 x.emulate_media(reduced_motion='reduce')
 x.evaluate("navigate('activities')")
 x.locator('#scheduleTabs [data-value="research"]').click()
 expect(x.locator('#scheduleList .session')).to_have_count(2)
 x.wait_for_timeout(100)
 assert x.evaluate("document.querySelector('#scheduleList').getAnimations({subtree:true}).length===0")
 ok('hero pause/CTA synchronization and reduced-motion list behavior')
 x.context.close();browser.close()
server.shutdown();print(f'{checks} browser scenarios passed; live Auth/RLS/Storage NOT exercised.')
