# python3 prep.py sugam — upscales the photos and their cutouts 2x (Lanczos +
# light sharpening) so they hold up on a 1920x1080 stage screen.
import sys, glob, os
from PIL import Image, ImageFilter
for artist in sys.argv[1:]:
    for f in glob.glob(f'assets/{artist}/*.jpg') + glob.glob(f'assets/{artist}/*-cut.png'):
        if '@2x' in f: continue
        im = Image.open(f)
        big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
        if big.mode == 'RGBA':
            rgb, a = big.convert('RGB'), big.getchannel('A')
            rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
            a = a.filter(ImageFilter.GaussianBlur(0.8))   # soften the mask edge a touch
            big = Image.merge('RGBA', (*rgb.split(), a))
        else:
            big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
        root, ext = os.path.splitext(f)
        out = root + '@2x' + ('.png' if big.mode == 'RGBA' else '.jpg')
        big.save(out, quality=93) if out.endswith('.jpg') else big.save(out)
        print(out, big.size)
