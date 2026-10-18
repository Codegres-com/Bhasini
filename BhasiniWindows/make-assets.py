"""Builds the Windows icon and Microsoft Store (AppX) tile images from the branding sources.

Renders branding/icon.html and branding/tile.html with headless Edge/Chrome, then resizes with
Pillow. Run from BhasiniWindows: `python make-assets.py`.
"""
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
BRANDING = HERE.parent / "branding"
APPX = HERE / "build" / "appx"

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]


def render(html: Path, width: int, height: int, out: Path) -> Image.Image:
    browser = next(b for b in BROWSERS if os.path.exists(b))
    subprocess.run([
        browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        "--default-background-color=00000000", "--virtual-time-budget=8000",
        f"--window-size={width},{height}", f"--screenshot={out}", html.as_uri(),
    ], check=False, capture_output=True)
    for _ in range(100):  # the browser can return before the file is written
        if out.exists() and out.stat().st_size > 0:
            break
        time.sleep(0.1)
    return Image.open(out).convert("RGBA")


def save(img: Image.Image, size, name: str):
    img.resize(size, Image.LANCZOS).save(APPX / name, optimize=True)


def main():
    tmp = Path(tempfile.mkdtemp())
    try:
        icon = render(BRANDING / "icon.html", 1024, 1024, tmp / "icon.png")
        wide = render(BRANDING / "tile.html", 1240, 600, tmp / "wide.png")
        splash = render(BRANDING / "tile.html", 2480, 1200, tmp / "splash.png")
    finally:
        pass

    # Windows icon (taskbar, installer) and tray icon
    icon.save(HERE / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    icon.resize((256, 256), Image.LANCZOS).save(HERE / "icon.png")

    if APPX.exists():
        shutil.rmtree(APPX)
    APPX.mkdir(parents=True)

    square = {"StoreLogo": 50, "Square44x44Logo": 44, "Square71x71Logo": 71,
              "Square150x150Logo": 150, "Square310x310Logo": 310, "BadgeLogo": 24}
    for name, base in square.items():
        save(icon, (base, base), f"{name}.png")
        for scale in (100, 125, 150, 200, 400):
            px = round(base * scale / 100)
            save(icon, (px, px), f"{name}.scale-{scale}.png")

    for target in (16, 24, 32, 48, 256):
        save(icon, (target, target), f"Square44x44Logo.targetsize-{target}.png")
        save(icon, (target, target), f"Square44x44Logo.targetsize-{target}_altform-unplated.png")

    for name, (w, h), src in (("Wide310x150Logo", (310, 150), wide), ("SplashScreen", (620, 300), splash)):
        save(src, (w, h), f"{name}.png")
        for scale in (100, 125, 150, 200, 400):
            save(src, (round(w * scale / 100), round(h * scale / 100)), f"{name}.scale-{scale}.png")

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"Wrote icon.ico, icon.png and {len(list(APPX.iterdir()))} AppX images to {APPX}")


if __name__ == "__main__":
    main()
