# GNōSIS — rolagem original restaurada

Versão independente com as 25 páginas gráficas da edição aprovada (Frame 21), sem reorganizar textos, imagens ou sumário. A arte original 1440×1024 ocupa 100% da largura disponível, sem limite máximo e sem margens laterais. A altura cresce proporcionalmente; a navegação é por rolagem vertical contínua. Não há encaixe forçado na altura da janela, corte da arte ou redução isolada dos elementos.

## Abrir

<http://127.0.0.1:8001/versao-rolagem/>

Ou sirva apenas esta pasta:

```powershell
python -m http.server 8002 --bind 127.0.0.1 --directory versao-rolagem
```

Abra <http://127.0.0.1:8002/>. Use HTTP: as páginas SVG locais são carregadas por fetch. O sumário é clicável e `texto.html` contém uma transcrição acessível sem JavaScript.

## Arquivos ativos

- `index.html`: as 25 páginas e o sumário original.
- `style.css`: largura total, proporção original e rolagem contínua.
- `script.js`: SVGs sob demanda, imagens locais e IDs únicos por página.
- `contents.css`: posições dos links sobre o sumário.
- `assets/page-*.svg` e `assets/images/`: cópias independentes da arte original.
- `scripts/build_html.py`: regenera somente os arquivos desta versão original.
- `scripts/verify.cjs`: verifica as 25 páginas, sumário, assets, largura total, proporção, telas responsivas e hashes da revista principal.

Os arquivos `scripts/build_responsive.py`, `scripts/verify_responsive.cjs` e `assets/portrait/` pertencem à experiência anterior com elementos HTML compactos, agora desativada. Não execute esse gerador para atualizar a versão restaurada.

A referência visual são as exportações locais já aprovadas; o Figma remoto permanece limitado pela permissão do arquivo. A revista principal com virada não foi modificada.
