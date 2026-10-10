# python3 points.py sugam sing-cut@2x.png 3600 → assets/sugam/points.js
# Stipples a cut-out photo into N points for the gold-particle portrait: most
# points follow the brightness (face, hands, mic catch the most), the rest trace
# the outline so the figure reads. Writes window.POINTS = [[x, y, lum], ...]
# with x, y in 0..1 of the image.
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

artist, name, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = np.asarray(Image.open(f'assets/{artist}/{name}').convert('RGBA')).astype(np.float32) / 255
a = im[..., 3]; L = 0.3 * im[..., 0] + 0.59 * im[..., 1] + 0.11 * im[..., 2]
h, w = a.shape
rng = np.random.default_rng(7)
body = a > 0.5
edge = body & ~ndimage.binary_erosion(body, iterations=3)

def pick(weight, k):
    p = weight.ravel() / weight.sum()
    idx = rng.choice(p.size, size=k, replace=False, p=p)
    ys, xs = np.divmod(idx, w)
    return xs + rng.random(k), ys + rng.random(k)

# local contrast (brightness minus its blur) so eyes, beard and hairline stay dark inside the bright face
D = np.clip(L + 1.4 * (L - ndimage.gaussian_filter(L, 5)), 0, 1)
n_edge = int(n * 0.18)
x1, y1 = pick(body * (0.03 + D ** 3), n - n_edge)
x2, y2 = pick(edge.astype(np.float32), n_edge)
xs, ys = np.concatenate([x1, x2]), np.concatenate([y1, y2])
lum = D[np.clip(ys.astype(int), 0, h - 1), np.clip(xs.astype(int), 0, w - 1)]
pts = [[round(float(x / w), 4), round(float(y / h), 4), round(float(l), 3)] for x, y, l in zip(xs, ys, lum)]
order = rng.permutation(len(pts))                       # mixed order, so delays don't follow position
pts = [pts[i] for i in order]
open(f'assets/{artist}/points.js', 'w').write(f'window.POINTS = {json.dumps(pts, separators=(",", ":"))};\n')
print(f'assets/{artist}/points.js', len(pts), 'points')
