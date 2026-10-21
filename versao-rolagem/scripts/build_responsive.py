"""Build native elements inside the full-width scrolling edition only."""
from pathlib import Path
from html import escape
import json
root=Path(__file__).resolve().parents[1]
edition=json.loads((root/'assets/portrait/edition.json').read_text(encoding='utf-8'))
def e(value): return escape(str(value),quote=True)
parts=['''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="theme-color" content="#9c2621"><title>O peso invisível da nuvem — GNōSIS</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"><script src="script.js" defer></script></head><body>
<a class="skip-link" href="#sumario">Ir para o sumário</a><a class="skip-link" href="texto.html">Leitura em texto</a><main class="magazine">
<section class="cover" id="capa" aria-labelledby="cover-title"><div class="cover__meta"><span>Edição n. 1°</span><span>São Paulo • 18 de outubro, 2026</span></div>
<div class="cover__body"><div class="cover__text"><h1 id="cover-title">O PESO<br>INVISÍVEL<br>DA NUVEM</h1><p>Big Data e Desenvolvimento Sustentável:<br>Colonialismo Digital e Impactos Ambientais</p></div><img class="cover__collage" src="assets/portrait/photo-29.png" width="1487" height="1058" alt="Colagem original: Brasil, infraestrutura digital e comunidades afetadas." fetchpriority="high"></div><div class="cover__brand">GNōSIS</div></section>
<section class="contents" id="sumario" aria-labelledby="contents-title"><div class="section-inner"><h2 id="contents-title">Sumário</h2><nav aria-label="Sumário da revista"><ol class="contents__list">''']
for chapter in edition['chapters']:
    parts.append(f'<li><a href="#{e(chapter["id"])}">{e(chapter["title"])}</a></li>')
parts.append('</ol></nav></div></section>')
for chapter in edition['chapters']:
    parts.append(f'<article class="chapter chapter--{e(chapter["theme"])}" id="{e(chapter["id"])}" data-source-page="{chapter["sourcePage"]}" aria-labelledby="title-{e(chapter["id"])}"><div class="section-inner"><h2 id="title-{e(chapter["id"])}">{e(chapter["title"])}</h2><div class="article-flow">')
    for i,b in enumerate(chapter['blocks']):
        key=f'{chapter["id"]}-{i}'
        kind=b['type']
        if kind=='figure':
            chart=b.get('kind')=='chart'
            parts.append(f'<figure class="figure{" figure--chart" if chart else ""}" data-block="{key}">')
            if chart: parts.append(f'<a href="{e(b["src"])}" target="_blank" rel="noopener" aria-label="Ampliar gráfico em nova aba">')
            parts.append(f'<img src="{e(b["src"])}" alt="{e(b["alt"])}" width="{b["width"]}" height="{b["height"]}" loading="lazy">')
            if chart: parts.append('</a>')
            if b.get('caption'): parts.append(f'<figcaption>{e(b["caption"])}</figcaption>')
            parts.append('</figure>')
        elif kind=='team':
            parts.append(f'<div class="team" data-block="{key}">')
            for person in b['people']:
                rotation=' team__photo--rotate' if person.get('rotation')==-90 else ''
                parts.append(f'<figure><img class="team__photo{rotation}" src="{e(person["src"])}" width="64" height="64" alt="" loading="lazy"><figcaption>{e(person["name"])}</figcaption></figure>')
            parts.append('</div>')
        elif kind=='callout':
            parts.append(f'<aside class="callout callout--{e(b.get("variant","note"))}" data-block="{key}"><h3>{e(b["title"])}</h3><p data-flow-text>{e(b["text"])}</p></aside>')
        else:
            tag='h3' if kind=='subheading' else 'blockquote' if kind=='quote' else 'p'
            parts.append(f'<{tag} class="{e(kind)}" data-block="{key}" data-flow-text>{e(b["text"])}</{tag}>')
    parts.append('</div></div></article>')
parts.append('</main></body></html>')
(root/'index.html').write_text('\n'.join(parts),encoding='utf-8')
print('Built compact full-width HTML edition:',len(edition['chapters']),'chapters')
