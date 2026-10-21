# Makes the small WebP copies of docs/img/*.png that the in-app guide shows (app/www/docs/img).
# Usage: python3 core-build/docs/webp.py   (needs Pillow)
import pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parents[2]
src, out = root / 'docs/img', root / 'app/www/docs/img'
out.mkdir(parents=True, exist_ok=True)
for p in sorted(src.glob('*.png')):
    im = Image.open(p); im.thumbnail((900, 900))
    im.save(out / (p.stem + '.webp'), 'WEBP', quality=72, method=6)
    print(p.name, '->', (out / (p.stem + '.webp')).stat().st_size, 'bytes')
