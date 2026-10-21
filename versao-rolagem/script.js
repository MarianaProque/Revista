/* Original artwork in continuous vertical scrolling order, at window width. */
const magazine = document.querySelector('.magazine');
const pages = [...document.querySelectorAll('.page')];
const pending = new Map();

function resizeArtwork() {
  magazine.style.setProperty('--page-scale', String(magazine.clientWidth / 1440));
}
resizeArtwork();
new ResizeObserver(resizeArtwork).observe(magazine);

function prepareArtwork(source, number) {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) throw new Error('Página inválida.');
  const identifiers = new Map([...svg.querySelectorAll('[id]')].map(element => [element.id, `p${number}-${element.id}`]));
  const assets = new Set();
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    if (['script', 'foreignObject', 'iframe', 'object'].includes(element.localName)) throw new Error('Elemento não permitido.');
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name)) throw new Error('Evento não permitido.');
      let value = attribute.value;
      if (attribute.localName === 'href') {
        if (value.startsWith('#')) {
          const target = identifiers.get(value.slice(1));
          if (!target) throw new Error('Referência gráfica ausente.');
          value = `#${target}`;
        } else {
          if (!/^images\/(?:[a-f\d]+\.(?:png|jpg)|cover-original\.jpg)$/.test(value)) throw new Error('Imagem não permitida.');
          value = new URL(`assets/${value}`, document.baseURI).href;
          assets.add(value);
        }
      } else if (attribute.localName === 'id') value = identifiers.get(value);
      else value = value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${identifiers.get(id) || id})`);
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    }
  }
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return { svg: document.importNode(svg, true), assets };
}

async function loadPage(page) {
  if (!page || page.dataset.loaded === 'true') return;
  if (pending.has(page)) return pending.get(page);
  const task = (async () => {
    page.setAttribute('aria-busy', 'true');
    const number = Number(page.dataset.page);
    try {
      const response = await fetch(`assets/page-${String(number).padStart(2, '0')}.svg`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Página indisponível: ${number}`);
      const { svg, assets } = prepareArtwork(await response.text(), number);
      await Promise.all([...assets].map(src => {
        const picture = new Image();
        picture.src = src;
        return picture.decode();
      }));
      page.querySelector('.page__artwork').replaceChildren(svg);
      page.querySelector('.page__retry')?.remove();
      delete page.dataset.error;
      page.dataset.loaded = 'true';
      observer.unobserve(page);
    } catch (error) {
      console.error(error);
      page.dataset.error = 'true';
      if (!page.querySelector('.page__retry')) {
        const retry = document.createElement('button');
        retry.className = 'page__retry';
        retry.type = 'button';
        retry.textContent = `Não foi possível carregar a página ${number}. Tentar novamente`;
        retry.addEventListener('click', () => loadPage(page));
        page.append(retry);
      }
    } finally {
      page.setAttribute('aria-busy', 'false');
      pending.delete(page);
    }
  })();
  pending.set(page, task);
  return task;
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) loadPage(entry.target);
}, { rootMargin: '100% 0px' });
for (const page of pages) observer.observe(page);
function loadAnchor() {
  const match = /^#pagina-(\d+)$/.exec(location.hash);
  if (match) loadPage(pages[Number(match[1]) - 1]);
}
loadPage(pages[0]);
loadAnchor();
window.addEventListener('hashchange', loadAnchor);
window.addEventListener('beforeprint', () => pages.forEach(loadPage));
