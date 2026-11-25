"""SFC People & Recruitment v2.6.5 browser regression. Fixtures only; no real Supabase writes."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_port)
checks=0
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def new_page(width=1440,mode='anonymous',reduced=True):
   context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce' if reduced else 'no-preference')
   context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
   context.add_init_script(path=str(ROOT/'tests/fixtures/supabase-mock.js'))
   context.add_init_script("window.mock.mode='"+mode+"'")
   x=context.new_page()
   x.on('dialog',lambda dialog:dialog.accept())
   return x
  def ok(label):
   global checks
   checks+=1
   print('PASS',label)
  for width in [360,390,768,1440]:
   x=new_page(width)
   errors=[]
   x.on('pageerror',lambda err:errors.append(str(err)))
   x.goto(base+'/index.html#people')
   expect(x.locator('#roleList .team-node')).to_have_count(3)
   expect(x.locator('#peopleSpotlightTitle')).to_have_text('President')
   expect(x.locator('#roleList .team-node.selected')).to_have_count(1)
   before=x.locator('#peopleSpotlight').evaluate("e=>e.getBoundingClientRect().left")
   x.locator('#roleList .team-node').nth(1).click()
   expect(x.locator('#peopleSpotlightTitle')).to_have_text('Head of Research')
   expect(x.locator('#roleList .team-node[aria-pressed=true]')).to_have_count(1)
   x.locator('#roleList .team-node.selected').press('ArrowRight')
   expect(x.locator('#peopleSpotlightTitle')).to_have_text('Operations')
   x.locator('#roleList .team-node.selected').press('Home')
   expect(x.locator('#peopleSpotlightTitle')).to_have_text('President')
   assert abs(before-x.locator('#peopleSpotlight').evaluate("e=>e.getBoundingClientRect().left"))<1.5,width
   assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   x.evaluate("navigate('recruitment')")
   expect(x.locator('#recruitment')).to_be_visible()
   expect(x.locator('#recruitActionCard')).to_have_attribute('data-state','planned')
   expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','activities')
   x.locator('#recruitmentProcess [data-process-step="2"]').click()
   expect(x.locator('#processDetailTitle')).to_have_text('면접')
   expect(x.locator('#recruitmentProcess [aria-pressed=true]')).to_have_count(1)
   x.locator('#recruitmentProcess [data-process-step="2"]').press('ArrowRight')
   expect(x.locator('#processDetailTitle')).to_have_text('첫 세션')
   assert x.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   assert not errors,(width,errors)
   x.context.close()
   ok('People node navigation and Recruitment process '+str(width)+'px')
  # CMS people records must replace demo roles without duplicate content.
  x=new_page()
  x.goto(base+'/index.html#people')
  x.evaluate("""async()=>{
   mock.people=[
    {id:'test-president',name:'가상 인물 A',position:'학회장',term:'2027 SPRING',bio:'운영을 관리합니다.',sort_order:1,visible:true},
    {id:'test-research',name:'가상 인물 B',position:'리서치장',term:'2027 SPRING',bio:'연구를 지도합니다.',sort_order:2,visible:true}
   ];
   await SFC_PUBLIC.load();
  }""")
  expect(x.locator('#roleList .team-node')).to_have_count(2)
  expect(x.locator('#peopleSpotlightTitle')).to_have_text('가상 인물 A')
  expect(x.locator('#peopleDisclaimer')).to_contain_text('OFFICIAL PEOPLE')
  x.locator('#roleList .team-node').nth(1).click()
  expect(x.locator('#peopleSpotlightDescription')).to_have_text('연구를 지도합니다.')
  x.evaluate("async()=>{mock.people=[];await SFC_PUBLIC.load();}")
  expect(x.locator('#roleList .team-node')).to_have_count(3)
  expect(x.locator('#peopleSpotlightTitle')).to_have_text('President')
  expect(x.locator('#peopleDisclaimer')).to_contain_text('실제 운영진 프로필이 아닙니다')
  assert x.evaluate('mock.calls.length')==0
  ok('public CMS profiles vs planned roles, clean fallback, no writes')
  x.context.close()
  # No-form planned state directs users to learning content instead of a broken modal.
  x=new_page()
  x.goto(base+'/index.html#recruitment')
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','activities')
  x.locator('#applicationTrigger').click()
  expect(x.locator('#activities')).to_be_visible()
  expect(x.locator('#applicationDialog')).not_to_be_visible()
  ok('planned state no form: useful next action instead of empty modal')
  # Published form in an active campaign uses original modal and links.
  x.evaluate("""async()=>{mock.settings=[{key:'recruitment',value:{
    status:'open',pdf_url:'https://example.invalid/official.pdf',docx_url:'https://example.invalid/official.docx',
    instructions:'지원서를 안내된 이메일로 제출합니다.',method:'이메일 접수'
  }}];await SFC_PUBLIC.load()}""")
  x.evaluate("navigate('recruitment')")
  expect(x.locator('#recruitActionCard')).to_have_attribute('data-state','open')
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','form')
  x.locator('#applicationTrigger').click()
  expect(x.locator('#applicationDialog')).to_be_visible()
  expect(x.locator('#applicationFrame')).to_have_attribute('src','https://example.invalid/official.pdf#toolbar=0')
  expect(x.locator('#applicationDocxDownload')).to_be_visible()
  x.locator('#applicationClose').click()
  expect(x.locator('#applicationDialog')).not_to_be_visible()
  ok('open with PDF+DOCX: complete preview and original downloads')
  # Campaign is open without any official file: direct to submission instructions.
  x.evaluate("""async()=>{mock.settings=[{key:'recruitment',value:{
    status:'open',instructions:'이메일로 접수',method:'이메일 안내'
  }}];await SFC_PUBLIC.load()}""")
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','instructions')
  x.locator('#applicationTrigger').click()
  expect(x.locator('#applicationDialog')).not_to_be_visible()
  expect(x.locator('#recruitInstructionsPublic')).to_have_text('이메일로 접수')
  ok('open without form: instructions CTA, no fake application modal')
  # DOCX-only forms get an honest non-PDF preview message.
  x.evaluate("""async()=>{mock.settings=[{key:'recruitment',value:{
    status:'planned',docx_url:'https://example.invalid/only.docx'
  }}];await SFC_PUBLIC.load()}""")
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','activities')
  expect(x.locator('#recruitSecondaryTrigger')).to_be_visible()
  x.locator('#recruitSecondaryTrigger').click()
  expect(x.locator('#applicationDialog')).to_be_visible()
  expect(x.locator('#applicationUnavailable')).to_contain_text('DOCX')
  expect(x.locator('#applicationDocxDownload')).to_be_visible()
  x.locator('#applicationClose').click()
  ok('planned with DOCX-only: optional legitimate form access')
  # Closed state never advertises an active application CTA.
  x.evaluate("""async()=>{mock.settings=[{key:'recruitment',value:{
    status:'closed',pdf_url:'https://example.invalid/old.pdf'
  }}];await SFC_PUBLIC.load()}""")
  expect(x.locator('#applicationTrigger')).to_have_attribute('data-action','research')
  expect(x.locator('#recruitSecondaryTrigger')).to_be_visible()
  x.locator('#applicationTrigger').click()
  expect(x.locator('#research')).to_be_visible()
  assert x.evaluate('mock.calls.length')==0
  ok('closed state routes to published research without writes')
  x.context.close()
  # Verify normal-motion transitions also work in both directions.
  x=new_page(reduced=False)
  x.goto(base+'/index.html#people')
  for i in [1,2,0,2,1,0]:
   x.locator('#roleList .team-node').nth(i).click()
   expect(x.locator('#roleList .team-node.selected')).to_have_count(1)
  x.evaluate("navigate('recruitment')")
  for i in [3,0,2,1,0]:
   x.locator('#recruitmentProcess [data-process-step="'+str(i)+'"]').click()
  expect(x.locator('#processDetailTitle')).to_have_text('모집 공고')
  assert x.evaluate('document.querySelectorAll(".motion-snapshot-layer").length')==0
  ok('rapid back/forward selections without horizontal ghost clones')
  x.context.close()
  browser.close()
finally:
 server.shutdown()
print(str(checks)+' People/Recruitment scenarios passed (mock data; not live Auth/RLS/Storage)')