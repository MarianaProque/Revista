"""Export the supplied PDF artwork as vector assets, retaining original glyphs.

Requires PyMuPDF. Only run on trusted local PDF exports, never remote input.
"""
from pathlib import Path
import base64
import hashlib
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from copy import deepcopy

sys.path.insert(0, str(Path('tmp/mupdf').resolve()))
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
MEDIA = OUT / 'images'
MEDIA.mkdir(exist_ok=True)
SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)
HEIGHT = 1024
WIDTH = 1440
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Users\marianaproque-ieg\AppData\Local\Temp\Frame 21.pdf')

doc = pymupdf.open(SOURCE)
page = doc[0]
blocks = page.get_text('dict', flags=0)['blocks']
# MuPDF's SVG exporter keeps the complete drawing list even when cropped.
tree = ET.parse(ROOT / 'tmp/pdfs/test.svg')
root = tree.getroot()
defs = root[0]
art = root[1][0]
# Reused images may be defined inline in an earlier drawing group. Promote
# those definitions so every independently loaded page can resolve them.
for parent in list(root.iter()):
    for child in list(parent):
        if child.tag == f'{{{SVG}}}image' and child.get('id') and parent is not defs:
            defs.append(deepcopy(child))
            replacement=ET.Element(f'{{{SVG}}}use',{f'{{{XLINK}}}href':'#'+child.get('id')})
            position=list(parent).index(child)
            parent.remove(child)
            parent.insert(position,replacement)
references = {el.get('id'): el for el in defs.iter() if el.get('id')}
for mask in defs.iter(f'{{{SVG}}}mask'):
    has_image=False
    for node in mask.iter():
        target=references.get(node.get(f'{{{XLINK}}}href','').lstrip('#'))
        if node.tag == f'{{{SVG}}}image' or (target is not None and target.tag == f'{{{SVG}}}image'):
            has_image=True
    if not has_image:
        mask.set('mask-type', 'alpha')

for el in root.iter():
    href = el.get(f'{{{XLINK}}}href', '')
    if href.startswith('data:image/'):
        header, payload = href.split(',', 1)
        data = base64.b64decode(payload)
        suffix = 'jpg' if 'jpeg' in header else 'png'
        name = hashlib.sha256(data).hexdigest()[:20] + '.' + suffix
        target = MEDIA / name
        if not target.exists():
            target.write_bytes(data)
        el.set(f'{{{XLINK}}}href', 'images/' + name)

def matrix(value):
    nums = [float(x) for x in re.findall(r'[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?', value or '')]
    return nums if len(nums) == 6 else [1, 0, 0, 1, 0, 0]

def transformed(box, m):
    if box is None:
        return None
    a,b,c,d,e,f = m
    x0,y0,x1,y1 = box
    points = [(a*x+c*y+e, b*x+d*y+f) for x,y in [(x0,y0),(x1,y0),(x0,y1),(x1,y1)]]
    return min(x for x,y in points), min(y for x,y in points), max(x for x,y in points), max(y for x,y in points)

def union(boxes):
    boxes = [b for b in boxes if b is not None]
    if not boxes:
        return None
    return min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)

def path_box(data):
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?', data)
    points=[]
    i=0
    x=y=0.0
    command='M'
    sizes={'M':2,'L':2,'C':6,'S':4,'Q':4,'T':2,'H':1,'V':1,'A':7}
    while i < len(tokens):
        if tokens[i].isalpha():
            command=tokens[i]
            i+=1
            if command.upper()=='Z':
                continue
        n=sizes.get(command.upper(), 0)
        if not n or i+n>len(tokens):
            break
        values=list(map(float,tokens[i:i+n]))
        i+=n
        relative=command.islower()
        if command.upper()=='H':
            x=values[0]+(x if relative else 0)
            points.append((x,y))
        elif command.upper()=='V':
            y=values[0]+(y if relative else 0)
            points.append((x,y))
        elif command.upper()=='A':
            # The supplied export uses cubic curves, but retain safe arc bounds.
            nx,ny=values[-2:]
            nx+=x if relative else 0
            ny+=y if relative else 0
            rx,ry=values[:2]
            points.extend([(x-rx,y-ry),(x+rx,y+ry),(nx-rx,ny-ry),(nx+rx,ny+ry)])
            x,y=nx,ny
        else:
            pairs=[(values[j]+(x if relative else 0),values[j+1]+(y if relative else 0)) for j in range(0,n,2)]
            points.extend(pairs)
            x,y=pairs[-1]
    return union([(x,y,x,y) for x,y in points])

cache={}
def bounds(el):
    if id(el) in cache:
        return cache[id(el)]
    tag=el.tag.rsplit('}',1)[-1]
    if tag=='path':
        result=path_box(el.get('d',''))
    elif tag in ('image','rect'):
        x=float(el.get('x',0)); y=float(el.get('y',0))
        result=(x,y,x+float(el.get('width',0)),y+float(el.get('height',0)))
    elif tag=='use':
        ref=references.get(el.get(f'{{{XLINK}}}href','').lstrip('#'))
        result=bounds(ref) if ref is not None else None
        result=transformed(result,[1,0,0,1,float(el.get('x',0)),float(el.get('y',0))])
    elif tag in ('text','tspan'):
        # Text in MuPDF SVG is an invisible extraction layer; HTML supplies it.
        result=None
    else:
        result=union([bounds(child) for child in el])
    result=transformed(result,matrix(el.get('transform')))
    cache[id(el)]=result
    return result

def dependencies(elements):
    found=set()
    pending=list(elements)
    while pending:
        element=pending.pop()
        for node in element.iter():
            ids=[]
            for value in node.attrib.values():
                ids.extend(re.findall(r'url\(#([^)]*)\)',value))
            href=node.get(f'{{{XLINK}}}href','')
            if href.startswith('#'):
                ids.append(href[1:])
            for key in ids:
                if key not in found and key in references:
                    found.add(key)
                    pending.append(references[key])
    return found

items=list(art)
boxes=[bounds(el) for el in items]
pages=[]
for index in range(25):
    top=index*HEIGHT
    chosen=[el for el,box in zip(items,boxes) if box is not None and box[3]>=top and box[1]<=top+HEIGHT and box[2]>=0 and box[0]<=WIDTH]
    needed=dependencies(chosen)
    svg=ET.Element(f'{{{SVG}}}svg',{'viewBox':f'0 {top} {WIDTH} {HEIGHT}','width':str(WIDTH),'height':str(HEIGHT),'aria-hidden':'true'})
    definitions=ET.SubElement(svg,f'{{{SVG}}}defs')
    for definition in defs:
        if any(node.get('id') in needed for node in definition.iter()):
            definitions.append(definition)
    group=ET.SubElement(svg,f'{{{SVG}}}g',{'id':'artwork'})
    group.extend(chosen)
    if index == 0:
        # The PDF's cover transparency group is not emitted by MuPDF's SVG
        # exporter. Preserve that source composition as a high-resolution asset.
        cover_name = 'cover-original.jpg'
        if not (MEDIA/cover_name).exists():
            page.get_pixmap(matrix=pymupdf.Matrix(2,2),clip=pymupdf.Rect(0,0,1440,1024),alpha=False).pil_save(MEDIA/cover_name,format='JPEG',quality=95,optimize=True)
        group.clear()
        group.set('id','artwork')
        ET.SubElement(group,f'{{{SVG}}}image',{'width':'1440','height':'1024',f'{{{XLINK}}}href':'images/'+cover_name})
    filename=f'page-{index+1:02}.svg'
    ET.ElementTree(svg).write(OUT/filename,encoding='utf-8',xml_declaration=True)
    paragraphs=[]
    links=[]
    for block in blocks:
        if block.get('type')!=0:
            continue
        bbox=block['bbox']
        mid=(bbox[1]+bbox[3])/2
        if not top<=mid<top+HEIGHT:
            continue
        text='\n'.join(''.join(s['text'] for s in line['spans']) for line in block['lines']).strip()
        if text:
            paragraphs.append(text)
        if index in (1,2):
            for line in block['lines']:
                line_text=''.join(s['text'] for s in line['spans']).strip()
                if line_text and not line_text.isdigit() and 'SUMÁRIO' not in line_text:
                    x0,y0,x1,y1=line['bbox']
                    links.append({'text':line_text,'rect':[round(x0/WIDTH*100,4),round((y0-top)/HEIGHT*100,4),round((1278-x0)/WIDTH*100,4),round((y1-y0+20)/HEIGHT*100,4)]})
    pages.append({'number':index+1,'artwork':filename,'text':paragraphs,'links':links})
    print(f'Page {index+1}: {len(chosen)} objects, {(OUT/filename).stat().st_size} bytes',flush=True)
(OUT/'magazine.json').write_text(json.dumps({'title':'O peso invisível da nuvem','width':WIDTH,'height':HEIGHT,'pages':pages},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Done',len(list(MEDIA.iterdir())),'shared images',flush=True)
