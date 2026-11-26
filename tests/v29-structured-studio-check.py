"""SFC v2.9 Studio structured-editor loss-prevention tests.
Only local mocked Supabase, no production writes or Auth accounts.
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
count=0
def ok(name):
    global count
    count+=1
    print('PASS',name)

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':1250,'height':860},reduced_motion='reduce')
        ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
        ctx.add_init_script(path=str(ROOT/'tests/fixtures/supabase-mock.js'))
        ctx.add_init_script("""(() => {
          window.mock.mode='admin';
          window.mock.settings=[
           {key:'site',value:{hero_description:'original-hero',contact_email:'sfc@example.invalid'},updated_at:'2026-11-24T00:00:00.000Z'},
           {key:'recruitment',value:{status:'planned',title:'original-recruit'},updated_at:'2026-11-24T00:00:00.000Z'}
          ];
        })();""")
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        page.goto(base+'/admin.html')
        expect(page.locator('#studioPanel')).to_be_visible()
        page.locator('[data-pane="site"]').click()
        expect(page.locator('#siteHeroDescription')).to_have_value('original-hero')
        page.locator('#siteHeroDescription').fill('unsaved hero')

        page.locator('[data-pane="recruitment"]').click()
        expect(page.locator('#recruitTitle')).to_have_value('original-recruit')
        page.locator('#recruitTitle').fill('unsaved recruitment')

        page.locator('[data-pane="site"]').click()
        expect(page.locator('#siteHeroDescription')).to_have_value('unsaved hero')
        page.locator('[data-pane="recruitment"]').click()
        expect(page.locator('#recruitTitle')).to_have_value('unsaved recruitment')
        ok('site/recruitment unsaved form data survives cross-pane async refetch')

        page.evaluate('mock.delay=360')
        page.locator('#recruitForm button[type="submit"]').click()
        expect(page.locator('#recruitForm')).to_have_attribute('aria-busy','true')
        assert page.locator('#recruitForm').evaluate('e=>e.inert')
        page.wait_for_timeout(520)
        expect(page.locator('#recruitForm')).to_have_attribute('aria-busy','false')
        assert page.evaluate("mock.settings.find(x=>x.key==='recruitment').value.title")=='unsaved recruitment'
        ok('recruitment write locks form until server completion and persists real payload')

        page.locator('[data-pane="site"]').click()
        page.locator('#siteHeroDescription').fill('saved hero')
        page.locator('#siteForm button[type="submit"]').click()
        expect(page.locator('#siteForm')).to_have_attribute('aria-busy','true')
        page.wait_for_timeout(520)
        expect(page.locator('#siteForm')).to_have_attribute('aria-busy','false')
        assert page.evaluate("mock.settings.find(x=>x.key==='site').value.hero_description")=='saved hero'
        ok('site settings save writes versioned row')

        # Simulate a remote co-editor changing the existing row's updated_at.
        page.evaluate("""() => {
          const row=mock.settings.find(x=>x.key==='site');
          row.value.hero_description='remote updated hero';
          row.updated_at='2026-11-26T05:00:00.000Z';
          mock.delay=0;
        }""")
        page.locator('#siteHeroDescription').fill('my unsaved hero after remote change')
        page.locator('#siteForm button[type="submit"]').click()
        expect(page.locator('#studioMessage')).to_contain_text('다른 관리자가 먼저 수정한 설정')
        expect(page.locator('#siteHeroDescription')).to_have_value('my unsaved hero after remote change')
        assert page.evaluate("mock.settings.find(x=>x.key==='site').value.hero_description")=='remote updated hero'
        ok('stale site edit is rejected instead of silently overwriting other editor')

        # People/Activities forms cannot be reselected/rewritten during async writes.
        page.locator('[data-pane="people"]').click()
        page.locator('#personName').fill('Mock Test Person')
        page.evaluate('mock.delay=360')
        page.locator('#peopleForm button[type="submit"]').click()
        expect(page.locator('#peopleForm')).to_have_attribute('aria-busy','true')
        page.locator('#newPerson').click()
        expect(page.locator('#personName')).to_have_value('Mock Test Person')
        page.wait_for_timeout(520)
        expect(page.locator('#peopleForm')).to_have_attribute('aria-busy','false')
        assert page.evaluate("mock.people.some(p=>p.name==='Mock Test Person')")
        ok('People save prevents new-item selection from erasing in-flight edits')

        # A deliberate switch must not silently discard an unsaved profile.
        page.locator('#personName').fill('Unsubmitted person')
        page.evaluate('window.confirm=()=>false')
        page.locator('#newPerson').click()
        expect(page.locator('#personName')).to_have_value('Unsubmitted person')
        page.locator('#peopleList button').filter(has_text='편집').first.click()
        expect(page.locator('#personName')).to_have_value('Unsubmitted person')
        page.evaluate('window.confirm=()=>true')
        page.locator('#newPerson').click()
        expect(page.locator('#personName')).to_have_value('')
        ok('unsaved People editor rejects new and edit navigation until explicitly confirmed')

        page.locator('[data-pane="sessions"]').click()
        page.locator('#sessionWeek').fill('W01')
        page.locator('#sessionTitle').fill('Mock Test Lesson')
        page.locator('#sessionForm button[type="submit"]').click()
        expect(page.locator('#sessionForm')).to_have_attribute('aria-busy','true')
        page.locator('#newSession').click()
        expect(page.locator('#sessionTitle')).to_have_value('Mock Test Lesson')
        page.wait_for_timeout(520)
        expect(page.locator('#sessionForm')).to_have_attribute('aria-busy','false')
        assert page.evaluate("mock.sessions.some(p=>p.title==='Mock Test Lesson')")
        ok('Activities save prevents new-row selection from erasing in-flight edits')

        page.locator('#sessionWeek').fill('W02')
        page.locator('#sessionTitle').fill('Unsubmitted lesson')
        page.evaluate('window.confirm=()=>false')
        page.locator('#newSession').click()
        expect(page.locator('#sessionTitle')).to_have_value('Unsubmitted lesson')
        page.locator('#sessionsList button').filter(has_text='편집').first.click()
        expect(page.locator('#sessionTitle')).to_have_value('Unsubmitted lesson')
        page.evaluate('window.confirm=()=>true')
        page.locator('#newSession').click()
        expect(page.locator('#sessionTitle')).to_have_value('')
        ok('unsaved Activities editor rejects new and edit navigation until explicitly confirmed')

        assert not errors,errors
        assert page.evaluate("mock.calls.every(c=>['cms_site_settings','cms_people','cms_sessions'].includes(c.table))")
        ok('mock Studio regression incurred no non-structured-table writes')
        ctx.close()
        browser.close()
finally:
    server.shutdown()

print(f'PASS: {count} SFC v2.9 structured Studio regression scenarios; zero live database writes')
