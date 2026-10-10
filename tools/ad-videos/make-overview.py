# python3 make-overview.py → out/studio/overview.jpg: the 30 cover frames, labelled by day.
import json, os
from PIL import Image, ImageDraw, ImageFont
order = json.load(open('out/studio/order.json'))
w, h, cols = 216, 384, 6
rows = (len(order) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 12) + 12, rows * (h + 64) + 12), (245, 245, 240))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
except Exception:
    font = small = ImageFont.load_default()
for i, o in enumerate(order):
    x, y = 12 + (i % cols) * (w + 12), 12 + (i // cols) * (h + 64)
    f = f"out/studio/cover-{o['day']:02d}.jpg"
    # The frames are gone after encoding, so the cover comes out of the video.
    os.system(f"ffmpeg -nostdin -hide_banner -loglevel error -y -ss {o['cover']} -i out/studio/mp4/{o['file']} -frames:v 1 {f}")
    if os.path.exists(f):
        sheet.paste(Image.open(f).resize((w, h)), (x, y))
        os.remove(f)
    d.text((x, y + h + 6), f"Day {o['day']}", fill=(17, 17, 17), font=font)
    d.text((x, y + h + 32), o['id'], fill=(90, 90, 90), font=small)
sheet.save('out/studio/overview.jpg', quality=90)
print('overview.jpg', sheet.size)
