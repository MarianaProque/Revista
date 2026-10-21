import sys
from pathlib import Path
sys.path.insert(0, str(Path('tmp/mupdf').resolve()))
import pymupdf
sys.stdout.reconfigure(encoding='utf-8')
d = pymupdf.open(r'C:\Users\marianaproque-ieg\AppData\Local\Temp\Frame 21.pdf')
p = d[0]
print('fonts', p.get_fonts()[:15])
print('blocks', str(p.get_text('dict', flags=0)['blocks'][:3])[:4500])
p.set_cropbox(pymupdf.Rect(0, 0, 1440, 1024))
s = p.get_svg_image()
Path('tmp/pdfs/test.svg').write_text(s, encoding='utf-8')
print('svg bytes', len(s), s[:450])
