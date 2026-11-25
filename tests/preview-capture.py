"""Screenshots of the branch-only preview. No production writes or login."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"preview"/"screenshots"
OUT.mkdir(parents=True,exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base="http://127.0.0.1:"+str(server.server_port)+"/index.html"
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        shots=[
            ("home-desktop","home",1440,900,None),
            ("about-desktop","about",1440,900,2),
            ("activities-desktop","activities",1440,900,"research"),
            ("about-mobile","about",390,844,1),
        ]
        for filename,route,width,height,selection in shots:
            context=browser.new_context(viewport={"width":width,"height":height},
                device_scale_factor=1,reduced_motion="reduce")
            page=context.new_page()
            page.goto(base+"#"+route,wait_until="domcontentloaded")
            page.wait_for_timeout(600)
            if route=="about" and isinstance(selection,int):
                page.locator('[data-experience-step="'+str(selection)+'"]').click()
            elif route=="activities" and selection:
                page.locator('#scheduleTabs [data-value="'+selection+'"]').click()
            page.screenshot(path=str(OUT/(filename+".png")),full_page=True,animations="disabled")
            print("PREVIEW "+filename+": "+str(OUT/(filename+".png")))
            context.close()
        browser.close()
finally:
    server.shutdown()
