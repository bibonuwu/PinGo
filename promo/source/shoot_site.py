"""Снимает настоящий лендинг Pingo (казахский язык) для трейлера."""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5199/"

def shoot(p, name, width, height, dpr, mobile):
    browser = p.chromium.launch(channel="msedge", headless=True)
    ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr,
                              is_mobile=mobile, has_touch=mobile, locale="kk-KZ")
    ctx.add_init_script("try{localStorage.setItem('pingo:lang','kk')}catch(e){}")
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    time.sleep(1.5)
    # прокрутить вниз, чтобы сработали анимации whileInView
    total = page.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < total:
        page.evaluate(f"window.scrollTo(0,{y})")
        time.sleep(0.25)
        y += height // 2
        total = page.evaluate("document.documentElement.scrollHeight")
    time.sleep(1.2)
    page.evaluate("window.scrollTo(0,0)")
    time.sleep(1.0)
    page.screenshot(path=str(OUT / f"{name}_hero.png"))
    page.screenshot(path=str(OUT / f"{name}_full.png"), full_page=True)
    print(name, "height", total)
    browser.close()

with sync_playwright() as p:
    shoot(p, "phone", 390, 844, 3, True)
    shoot(p, "desktop", 1440, 900, 2, False)
