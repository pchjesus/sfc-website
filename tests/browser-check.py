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
