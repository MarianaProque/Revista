"""Prepare original text, photos and charts for a native portrait edition."""
from pathlib import Path
import sys, json, re, math
sys.path.insert(0,str(Path('tmp/mupdf').resolve()))
import pymupdf

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/portrait'
OUT.mkdir(exist_ok=True)
source=json.loads((ROOT/'assets/magazine.json').read_text(encoding='utf-8'))
raw={p['number']:p['text'] for p in source['pages']}
doc=pymupdf.open(r'C:\Users\marianaproque-ieg\AppData\Local\Temp\Frame 21.pdf')
photos={n:[] for n in range(1,26)}
seen=set()
for info in doc[0].get_image_info(xrefs=True):
    x0,y0,x1,y1=info['bbox']
    number=int(((y0+y1)/2)//1024)+1
    xref=info['xref']
    if not 1<=number<=25 or not 0<(x0+x1)/2<1440 or not xref or (number,xref) in seen:
        continue
    seen.add((number,xref))
    image=doc.extract_image(xref)
    if not image:
        continue
    data=image['image']
    extension=image['ext']
    if image.get('smask'):
        pixmap=pymupdf.Pixmap(pymupdf.Pixmap(doc,xref),pymupdf.Pixmap(doc,image['smask']))
        data=pixmap.tobytes('png')
        extension='png'
    name=f'photo-{xref}.{extension}'
    target=OUT/name
    if not target.exists(): target.write_bytes(data)
    angle=round(math.degrees(math.atan2(info['transform'][1],info['transform'][0])))
    photos[number].append({'src':'assets/portrait/'+name,'width':image['width'],'height':image['height'],'bounds':[x0,y0,x1,y1],'rotation':angle})

def clean(value):
    return re.sub(r'\s+',' ',value).strip().replace('\ufffe','')
def text(n,i): return clean(raw[n][i])
def block(n,i,kind='p'): return {'type':kind,'text':text(n,i)}
def paragraph(value): return {'type':'p','text':value}
def picture(n,caption='',index=0):
    candidates=[p for p in photos[n] if p['width']>250 and p['height']>180]
    if index>=len(candidates): return None
    return {'type':'figure',**candidates[index],'caption':caption,'alt':caption or 'Fotografia da edição original da revista.'}
def chapter(key,title,blocks,theme='paper',source_page=1):
    return {'id':key,'title':title,'theme':theme,'sourcePage':source_page,'blocks':[b for b in blocks if b]}
def callout(title,body):return {'type':'callout','title':title,'text':body}

# Render only the original chart rectangles. Their PDF masks depend on image
# resources, so removing embedded images from exported SVGs erased the data.
for name,page,box in [('energy',12,(715,11*1024+346,651,483)),('pue',14,(65,13*1024+540,584,389))]:
    x,y,w,h=box
    doc[0].get_pixmap(matrix=pymupdf.Matrix(2,2),clip=pymupdf.Rect(x,y,x+w,y+h),alpha=False).save(OUT/f'{name}.png')

chapters=[]
chapters.append(chapter('editorial','Editorial',[
    block(4,1),paragraph(re.sub(r'\s4$','',text(4,2))),
    *[block(5,i) for i in range(4)],block(6,2)
],theme='red',source_page=4))
names=['Anna Bonfim','Artur Silva','Diego Valadares','Enzo Nascimento','Lucas Kluska','Mariana Proque']
portraits=sorted([p for p in photos[6] if p['bounds'][2]-p['bounds'][0]<500],key=lambda p:(0 if (p['bounds'][1]+p['bounds'][3])/2<5900 else 1,p['bounds'][0]))
team=[{'type':'team','people':[{'name':name,'src':p['src'],'rotation':p['rotation']} for name,p in zip(names,portraits)]}]
team.extend([callout('Design','Anna Bonfim, Artur Silva e Diego Valadares'),callout('Capa','Anna Bonfim e Artur Silva'),callout('Pesquisa',', '.join(names)),callout('Editorial','Diego Valadares e Mariana Proque'),callout('Dados analíticos','Enzo Nascimento'),callout('Revisão','Lucas Kluska')])
chapters.append(chapter('equipe','Nossa equipe',team,source_page=6))
chapters.append(chapter('introducao','O paralelo das Grandes Navegações',[
    block(7,1,'lead'),picture(7,text(7,4)),block(7,2),block(7,3),block(7,5)
],source_page=7))
chapters.append(chapter('exploracao','A exploração mudou de forma?',[
    block(8,0,'lead'),picture(8,text(8,6)),*[block(8,i) for i in range(2,6)],callout(text(8,7),text(8,8)),block(8,9,'quote')
],source_page=8))
chapters.append(chapter('nuvem','O que se esconde na sombra da nuvem?',[
    block(9,1,'lead'),*[block(9,i) for i in range(2,7)],picture(9,text(9,7))
],source_page=9))
chapters.append(chapter('data-center','O que é um data center?',[
    block(10,1,'lead'),picture(10,text(10,7)),block(10,3),block(10,4),paragraph(text(10,5)+' '+text(10,6))
],source_page=10))
chapters.append(chapter('custo','Quanto custa um data center?',[
    picture(11,text(11,1)),block(11,3,'subheading'),block(11,4),block(11,5)
],source_page=11))
chapters.append(chapter('energia','Custo energético',[
    block(12,1),paragraph(text(12,2)+' '+text(12,5)),callout(text(12,3),text(12,4)),
    {'type':'figure','src':'assets/portrait/energy.png','kind':'chart','alt':text(12,6),'caption':'Fonte: IEA — Key Questions on Energy and AI (2026).','width':651,'height':483},
    callout(text(12,7),text(12,8)),callout(text(12,9),text(12,10))
],source_page=12))
chapters.append(chapter('agua','A nuvem também tem sede',[
    block(13,1,'subheading'),block(13,2),callout(text(13,4),text(13,5)),block(13,6,'subheading'),
    paragraph(text(13,7)+' '+text(13,3)),picture(13,text(13,8)),callout(text(13,10),text(13,11))
],source_page=13))
chapters.append(chapter('caminho','O caminho a ser seguido',[
    block(14,1,'subheading'),block(14,2),
    {'type':'figure','src':'assets/portrait/pue.png','kind':'chart','alt':'PUE médio global de data centers','caption':text(14,8),'width':584,'height':389},
    callout(text(14,5),text(14,6)+' '+text(14,7)),{'type':'subheading','text':'Os limites da eficiência'},block(14,4)
],source_page=14))
chapters.append(chapter('brasil','O Brasil na equação',[
    block(15,1,'lead'),block(15,2),block(15,3),callout(text(15,4),text(15,5)),block(15,6),picture(15,text(15,7)),
    block(16,0,'subheading'),block(16,1),block(16,2),callout('205',text(16,4).split('Mapa mostra')[0].strip()),
    picture(16,'Mapa mostra a concentração de instalações em São Paulo e Rio de Janeiro. Foto: Montagem/Alexandre Akermann, 2025 — istoedinheiro.com.br.')
],source_page=15))
chapters.append(chapter('caucaia','Caso Caucaia',[
    block(17,1,'lead'),picture(17,text(17,4)),block(17,2),block(17,3),picture(18,text(18,0)),block(18,1),callout(text(18,2),text(18,3)),block(18,4,'subheading')
],source_page=17))
chapters.append(chapter('paracatu','A disputa pela água',[
    {'type':'lead','text':'Caso Paracatu'},block(19,2),block(19,3),picture(19,text(19,5)),block(19,4),block(19,6)
],source_page=19))
chapters.append(chapter('big-data','Big Data: aliado e custo ao mesmo tempo',[
    block(20,1,'lead'),block(20,2),block(20,3),block(20,4),callout(text(20,5),text(20,6)+'\n\n'+text(20,7))
],source_page=20))
chapters.append(chapter('redata','Redata: o que diz?',[
    block(21,1,'lead'),*[block(21,i) for i in range(2,6)],callout(text(21,6),text(21,7)+'\n\n'+text(21,8))
],source_page=21))
chapters.append(chapter('condicoes','Condições compatíveis com o desenvolvimento sustentável',[
    {'type':'lead','text':re.sub(r'\s1\.$','',text(22,1))},
    callout('1.',text(22,2)),picture(22,text(22,4)),callout('2.',text(22,5)),picture(22,re.sub(r'\s22\s3\.$','',text(22,6)),1),
    callout('3.',text(23,0)),picture(23),callout('4.',text(23,2)),picture(23,'',1)
],source_page=22))
chapters.append(chapter('conclusao','Desenvolvimento sustentável para quem?',[
    *[block(24,i) for i in range(3,7)],callout(text(24,7),re.sub(r'\s24$','',text(24,8)))
],source_page=24))
chapters.append(chapter('creditos','Créditos',[
    paragraph(text(25,0).removeprefix('CRÉDITOS').strip()),picture(25,'Comunidades mobilizadas: “Não somos quintal de data center”.')
],source_page=25))
for section in chapters:
    for item in section['blocks']:
        if item['type'] != 'callout': continue
        item['variant'] = ('credit' if section['id']=='equipe' else
            'condition' if section['id']=='condicoes' else
            'stat' if re.match(r'^(?:\d|US\$)',item['title']) else
            'quote' if item['title'].startswith('“') else 'note')
payload={'title':'O peso invisível da nuvem','chapters':chapters,'photos':photos}
(OUT/'edition.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Prepared',len(chapters),'chapters; images per source page:',{n:len(p) for n,p in photos.items()},flush=True)
