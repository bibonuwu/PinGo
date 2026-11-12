"""Рендер трейлера Pingo: покадрово через Edge (Playwright) -> ffmpeg.

  python render.py stills OUTDIR t1 t2 ...     контрольные кадры PNG
  python render.py video  OUT.mp4 FPS [AUDIO]  полный рендер
"""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
HTML = (HERE / "trailer" / "trailer.html").as_uri()


def open_page(p):
    browser = p.chromium.launch(channel="msedge", headless=True, args=["--force-color-profile=srgb", "--hide-scrollbars"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page.goto(HTML, wait_until="networkidle")
    page.evaluate("window.__ready")
    return browser, page


def stills(out, times):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page = open_page(p)
        for t in times:
            page.evaluate(f"window.__seek({t})")
            page.screenshot(path=str(out / f"t{float(t):06.2f}.png"))
        browser.close()


def video(out, fps, audio=None):
    with sync_playwright() as p:
        browser, page = open_page(p)
        dur = page.evaluate("window.__duration")
        n = int(round(dur * fps))
        cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
               "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-"]
        if audio:
            cmd += ["-i", str(audio)]
        # JPEG-кадры приходят в полном диапазоне BT.601 — переводим в стандартный yuv420p BT.709,
        # иначе iPhone/Telegram/Instagram покажут блеклые цвета или не откроют файл.
        cmd += ["-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
                "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-tune", "animation", "-profile:v", "high",
                "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                "-r", str(fps)]
        if audio:
            cmd += ["-c:a", "aac", "-b:a", "256k", "-shortest"]
        cmd += ["-movflags", "+faststart", str(out)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(n):
            page.evaluate(f"window.__seek({i / fps})")
            proc.stdin.write(page.screenshot(type="jpeg", quality=96))
            if i % (fps * 5) == 0:
                el = time.time() - t0
                print(f"frame {i}/{n}  {el:.0f}s elapsed, eta {el / max(i, 1) * (n - i):.0f}s", flush=True)
        proc.stdin.close(); proc.wait()
        browser.close()
        print("done", out, f"{time.time() - t0:.0f}s")


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "stills":
        stills(sys.argv[2], sys.argv[3:])
    else:
        video(sys.argv[2], int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else None)
