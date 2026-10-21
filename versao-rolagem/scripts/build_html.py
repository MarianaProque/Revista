"""Generate semantic HTML and index links from the extracted magazine text."""
from pathlib import Path
from html import escape
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT/'assets/magazine.json').read_text(encoding='utf-8'))
titles = [
    'O peso invisível da nuvem', 'Sumário', 'Sumário — continuação',
    'Editorial', 'Editorial — continuação', 'Editorial e equipe',
    'O paralelo das Grandes Navegações', 'A exploração mudou de forma?',
    'O que se esconde na sombra da nuvem?', 'O que é um data center?',
    'Quanto custa um data center?', 'Custo energético', 'A nuvem também tem sede',
    'O caminho a ser seguido', 'O Brasil na equação', 'Expansão e regulamento',
    'Caso Caucaia', 'Caso Caucaia — continuação', 'Caso Paracatu: a disputa pela água',
    'Big Data: aliado e custo ao mesmo tempo', 'Redata: o que diz?',
    'Condições compatíveis com o desenvolvimento sustentável',
    'Participação e acompanhamento', 'Desenvolvimento sustentável para quem?', 'Créditos',
]

def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFD',text.lower()) if unicodedata.category(c)!='Mn')

targets = [
    ('editorial',4),('introducao',7),('quanto custa',11),('a nuvem',13),
    ('o caminho',14),('o brasil',15),('caso caucaia',17),('caso paracatu',19),
    ('big data',20),('redata',21),('condicoes',22),('desenvolvimento sustentavel',22),('conclusao',24),
]
head = '''<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
  <meta name="description" content="O peso invisível da nuvem. Revista GNōSIS sobre Big Data, colonialismo digital e impactos ambientais.">
  <meta name="theme-color" content="#9c2621">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <title>O peso invisível da nuvem — GNōSIS</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="contents.css">
  <link rel="preload" href="assets/page-01.svg" as="fetch" crossorigin="anonymous">
  <script src="script.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#pagina-2">Ir para o sumário</a>
  <a class="skip-link" href="texto.html">Ler versão em texto</a>
  <main class="magazine" aria-label="Revista GNōSIS">
'''
parts=[head]
css=[]
text_parts=['''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'"><title>Leitura em texto — O peso invisível da nuvem</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"></head><body><main class="text-reader"><a href="index.html">Voltar à revista ilustrada</a><h1>O peso invisível da nuvem</h1><p>Transcrição textual da edição original. As ilustrações e os gráficos estão na revista ilustrada.</p><nav aria-label="Matérias"><ul>''']
for number,title in enumerate(titles,1):
    text_parts.append(f'<li><a href="#texto-{number}">{escape(title)}</a></li>')
text_parts.append('</ul></nav>')
for page,title in zip(data['pages'],titles):
    number=page['number']
    editorial=' page--editorial' if number in (4,5,6) else ''
    parts.append(f'<article class="page{editorial}" id="pagina-{number}" data-page="{number}" aria-labelledby="titulo-{number}">')
    parts.append(f'<h{1 if number==1 else 2} class="sr-only" id="titulo-{number}">{escape(title)}</h{1 if number==1 else 2}>')
    parts.append('<div class="page__artwork" aria-hidden="true"></div>')
    parts.append('<div class="sr-only">')
    text_parts.append(f'<section id="texto-{number}"><h2>{escape(title)}</h2>')
    for paragraph in page['text']:
        paragraph=re.sub(r'\s+',' ',paragraph)
        if paragraph.isdigit():
            continue
        parts.append(f'<p>{escape(paragraph)}</p>')
        text_parts.append(f'<p>{escape(paragraph)}</p>')
    text_parts.append(f'<p><a href="index.html#pagina-{number}">Ver página {number} ilustrada</a></p></section>')
    parts.append('</div>')
    if page['links']:
        parts.append('<nav class="page__links" aria-label="Sumário">')
        for index,link in enumerate(page['links']):
            target=next((p for key,p in targets if key in normalize(link['text'])),None)
            if target is None:
                continue
            cls=f'contents-link--{number}-{index}'
            left,top,width,height=link['rect']
            css.append(f'.{cls} {{ left: {left}%; top: {top}%; width: {width}%; height: {height}%; }}')
            parts.append(f'<a class="contents-link {cls}" href="#pagina-{target}"><span class="sr-only">{escape(link["text"])}</span></a>')
        parts.append('</nav>')
    parts.append('</article>')
parts.append('''</main><noscript><p class="text-reader">Para a revista ilustrada, ative JavaScript. A <a href="texto.html">versão em texto</a> está disponível sem JavaScript.</p></noscript></body></html>''')
text_parts.append('</main></body></html>')
(ROOT/'index.html').write_text('\n'.join(parts),encoding='utf-8')
(ROOT/'texto.html').write_text('\n'.join(text_parts),encoding='utf-8')
(ROOT/'contents.css').write_text('\n'.join(css)+'\n',encoding='utf-8')
print('Built',len(data['pages']),'pages and',len(css),'contents links.')
