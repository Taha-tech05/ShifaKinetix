"""Emulator capture for the movement animation (read-only on the app and the pack).

Run with Metro serving the app with EXPO_PUBLIC_DEV_ANIM=1 (see docs/model-audit/ANIMATION.md), the emulator open, and Expo Go installed.
  python scripts/audit/capture-anim.py <metro_port> <metro_log_file> <out_dir> [movement ids...]

For every movement and both layers it saves screenshots at rest (t=0), 25%, peak and 75% of the loop as
<movement>-<layer>-<phase>.png (cropped to the 3D view and the readout, at 60% size), then plays each layer for 10 s
and records the fps lines the dev screen logs plus the janky-frame figure of `dumpsys gfxinfo`.
Emulator numbers are not phone numbers.
"""
import io
import json
import re
import subprocess
import sys
import time

from PIL import Image

PORT, LOG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = sys.argv[4:]
PKG = 'host.exp.exponent'

# Peak time of each movement (inside its hold, from movements_shoulder.json)
MOVEMENTS = {
    'sideways_raise': 0.5,
    'forward_raise': 0.5,
    'can_position_hold': 0.5,
    'outward_push_elbow_at_side': 0.55,
    'belly_press': 0.55,
    'hand_behind_back': 0.57,
}
PHASES = [('rest', 0.0), ('p25', 0.25), ('peak', None), ('p75', 0.75)]

# Screen positions on the 1080x2400 emulator screen (measured from a screenshot of the dev screen)
SCRUB_Y, SCRUB_X0, SCRUB_X1 = 2006, 53, 1027
LAYER_Y, MUSCLE_X, BONE_X = 2305, 494, 690
PLAY_X, PLAY_Y = 138, 2148
TOAST_X = (996, 2208)


def adb(*args, timeout=30, binary=False):
    r = subprocess.run(['adb', *args], capture_output=True, timeout=timeout)
    return r.stdout if binary else r.stdout.decode('utf8', 'replace')


def tap(x, y):
    adb('shell', 'input', 'tap', str(int(x)), str(int(y)))


def swipe_tap(x, y):
    # a tap with a tiny move, which the pan responder of the scrubber registers
    adb('shell', 'input', 'swipe', str(int(x)), str(int(y)), str(int(x) + 1), str(int(y)), '80')


def log_text():
    with open(LOG, encoding='utf8', errors='replace') as f:
        return f.read()


def wait_loaded(mid, timeout=90):
    before = len(re.findall(r'\[anim-fps\] ' + mid, log_text()))
    t0 = time.time()
    while time.time() - t0 < timeout:
        if len(re.findall(r'\[anim-fps\] ' + mid, log_text())) > before:
            return time.time() - t0
        time.sleep(1)
    raise RuntimeError('model did not load for ' + mid)


def shot(path):
    png = adb('exec-out', 'screencap', '-p', binary=True, timeout=30)
    im = Image.open(io.BytesIO(png)).convert('RGB')
    im = im.crop((0, 690, 1080, 1930)).resize((648, 744), Image.LANCZOS)
    im.save(path, optimize=True)


def seek(frac):
    swipe_tap(SCRUB_X0 + frac * (SCRUB_X1 - SCRUB_X0), SCRUB_Y)


results = {}
for mid, peak in MOVEMENTS.items():
    if ONLY and mid not in ONLY:
        continue
    adb('shell', 'am', 'force-stop', PKG)
    time.sleep(1.5)
    url = f'exp://127.0.0.1:{PORT}/--/dev/anim?m={mid}&layer=muscle&t=0&paused=1'
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, PKG)
    load_s = wait_loaded(mid)
    time.sleep(2)
    tap(*TOAST_X)  # dismiss the development warning toast
    time.sleep(1)
    results[mid] = {'load_seconds_after_start': round(load_s, 1), 'fps': {}}
    for layer, lx in (('muscle', MUSCLE_X), ('bone', BONE_X)):
        tap(lx, LAYER_Y)
        time.sleep(2.5)
        for name, frac in PHASES:
            seek(peak if frac is None else frac)
            time.sleep(1.8)
            shot(f'{OUT}/{mid}-{layer}-{name}.png')
        # frame rate while playing
        adb('shell', 'dumpsys', 'gfxinfo', PKG, 'reset')
        start = len(log_text())
        tap(PLAY_X, PLAY_Y)
        time.sleep(10)
        gfx = adb('shell', 'dumpsys', 'gfxinfo', PKG, timeout=40)
        tap(PLAY_X, PLAY_Y)  # pause again
        new = log_text()[start:]
        fps = [int(x) for x in re.findall(r'\[anim-fps\] ' + mid + ' ' + layer + r' fps=(\d+)[^\n]*playing=true', new)]
        m = re.search(r'Total frames rendered: (\d+)', gfx)
        j = re.search(r'Janky frames: (\d+) \(([\d.]+)%\)', gfx)
        results[mid]['fps'][layer] = {
            'fps_samples': fps,
            'fps_mean': round(sum(fps) / len(fps), 1) if fps else None,
            'fps_min': min(fps) if fps else None,
            'ui_frames_rendered': int(m.group(1)) if m else None,
            'janky_frames': int(j.group(1)) if j else None,
            'janky_percent': float(j.group(2)) if j else None,
        }
        print(mid, layer, results[mid]['fps'][layer], flush=True)

json.dump(results, open(f'{OUT}/fps.json', 'w'), indent=1)
print('done')
