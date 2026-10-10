# python3 masks.py bajagaja — clean group cutouts by combining the two Vision masks
# (cutout → *-inst.png, cutout --people → *-people.png) into *-cut.png:
#  - studio: the subject mask dropped the man on the right, the people mask keeps
#    him → union. A "2 years" logo printed over the middle man's chest shows up as
#    holes in the people mask only; those pixels are painted over from their
#    surroundings (harmonic fill). The "DEC 22 MONDAY" text is background, so it
#    is gone with the rest of the background.
#  - club: the subject mask grabbed a reflection above the left man's head;
#    that box (above his hairline) is cleared.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def load(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
    return a[..., :3], a[..., 3]

def fill(rgb, hole, iters=300):
    out = rgb.copy(); out[hole] = 0
    known = ~hole
    k = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], np.float32)
    for _ in range(iters):
        s = np.stack([ndimage.convolve(out[..., c], k, mode='nearest') for c in range(3)], -1)
        n = ndimage.convolve(np.ones(hole.shape, np.float32), k, mode='nearest')
        out[hole] = (s / n[..., None])[hole]
        out[known] = rgb[known]
    return out

def save(rgb, a, p, pad=6):
    # trimmed to the people (plus a small margin), so the stage can place them by size
    ys, xs = np.where(a > 0.05)
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad), max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad)
    im = (np.dstack([rgb, a]) * 255).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(im, 'RGBA').save(p)
    print(p, im.shape[1], 'x', im.shape[0])

d = f'assets/{sys.argv[1] if len(sys.argv) > 1 else "bajagaja"}/'
# studio
rgb, ai = load(d + 'studio-inst.png'); _, ap = load(d + 'studio-people.png')
src = np.asarray(Image.open(d + 'studio.jpg').convert('RGB')).astype(np.float32) / 255
a = np.maximum(ai, ap)
box = np.zeros(a.shape, bool); box[178:318, 200:330] = True
# the logo is thin bright strokes: a white top-hat (brightness minus its opening)
# finds features narrower than ~5 px that are brighter than their surroundings
L = src.mean(-1)
top = L - ndimage.grey_opening(L, size=(6, 6))
logo = box & (top > 0.10)
logo = ndimage.binary_dilation(logo, iterations=1) & box
print('logo pixels', int(logo.sum()))
save(fill(src, logo), a, d + 'studio-cut.png')
# club
rgb, ai = load(d + 'club-inst.png'); _, ap = load(d + 'club-people.png')
src = np.asarray(Image.open(d + 'club.jpg').convert('RGB')).astype(np.float32) / 255
a = ai.copy()
a[100:150, 100:195] = 0                      # above his head: only the mirror
a[150:185, 100:195] = np.minimum(ai, ap)[150:185, 100:195]   # at the hairline: keep what both masks call him
z = a[140:180, 100:195]; z[z < 0.75] = 0      # and drop the faint haze left over
save(src, a, d + 'club-cut.png')
