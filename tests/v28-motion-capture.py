"""Record real page motions from the v2.8 branch using a local mock-CMS server.
The resulting WebM clips are QA artifacts, not proof of live Supabase behavior.
Run: python tests/v28-motion-capture.py
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"preview"/"v28-motion"
OUT.mkdir(parents=True,exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f"http://127.0.0.1:{server.server_port}/index.html"
error_count=0

def capture(browser,label,route,width=1440,height=900):
    global error_count
    ctx=browser.new_context(viewport={"width":width,"height":height},device_scale_factor=1,
        reduced_motion="no-preference",record_video_dir=str(OUT),
        record_video_size={"width":width,"height":height})
    ctx.route("**/*",lambda r:r.continue_() if (
        r.request.url.startswith(base.split("/index.html")[0]) or
        r.request.url.startswith(("https://images.unsplash.com/","https://fonts.googleapis.com/","https://fonts.gstatic.com/"))
    ) else r.abort())
    ctx.add_init_script(path=str(ROOT/"tests/fixtures/supabase-mock.js"))
    ctx.add_init_script("window.mock.mode='anonymous'")
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(base+"#"+route,wait_until="domcontentloaded")
    # Capture the actual growing-opacity curve, not only the finished frame.
    # Videos run from navigation, so these PNGs establish distinct phases.
    if route in ("home","about","activities") and width>=1000:
        elapsed=0
        for t in (180,820,1500,2400):
            page.wait_for_timeout(t-elapsed)
            elapsed=t
            page.screenshot(path=str(OUT/(f"{label}-t{t:04d}.png")),
                animations="allow",full_page=False)
    else:
        page.wait_for_timeout(2400)
    if route=="home":
        page.locator(".hero-controls button").nth(1).click()
        page.wait_for_timeout(1450)
        page.locator(".hero-controls button").nth(2).click()
        page.wait_for_timeout(1450)
        page.evaluate("window.scrollTo({top:Math.min(700,document.documentElement.scrollHeight-innerHeight),behavior:'instant'})")
        page.wait_for_timeout(450)
    elif route=="about":
        for idx in [1,2,3,0]:
            page.locator('[data-experience-step="'+str(idx)+'"]').click()
            page.wait_for_timeout(1100)
    elif route=="research":
        page.locator("#archiveGridButton").click()
        page.wait_for_timeout(850)
        page.locator("#archiveListButton").click()
        page.wait_for_timeout(850)
        page.locator("#archiveSearch").fill("기업")
        page.wait_for_timeout(530)
        page.locator("#archiveReset").click()
        page.wait_for_timeout(430)
    elif route=="activities":
        for stage in ["application","research","foundation","all"]:
            page.locator('#scheduleTabs [data-value="'+stage+'"]').click()
            page.wait_for_timeout(800)
        page.locator('#scheduleList .session[data-active="true"] .session-button').first.click()
        page.wait_for_timeout(850)
    elif route=="recruitment":
        page.locator('#recruitmentProcess').scroll_into_view_if_needed()
        page.wait_for_timeout(1300)
    elif route=="updates":
        page.wait_for_timeout(850)
    elif route=="people" and label=="navigation-mobile":
        for target in ["recruitment","activities","updates"]:
            page.evaluate("(r)=>navigate(r)",target)
            page.wait_for_timeout(1100)
    page.screenshot(path=str(OUT/(label+".png")),animations="disabled",full_page=True)
    video=page.video
    page.close()
    ctx.close()
    video.save_as(str(OUT/(label+".webm")))
    if errors:
        error_count+=len(errors)
        print("PAGE ERRORS",label,errors)
    print("CAPTURE",label,"video and screenshot ready")

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        capture(browser,"home-desktop","home")
        capture(browser,"about-desktop","about")
        capture(browser,"research-desktop","research")
        capture(browser,"activities-desktop","activities")
        capture(browser,"people-desktop","people")
        capture(browser,"recruitment-desktop","recruitment")
        capture(browser,"updates-desktop","updates")
        capture(browser,"activities-mobile","activities",390,844)
        capture(browser,"navigation-mobile","people",390,844)
        browser.close()
finally:
    server.shutdown()

if error_count:
    raise RuntimeError(f"Video capture page errors: {error_count}")
print("PASS: 9 videos and 9 screenshots from real branch HTML and mock CMS")
