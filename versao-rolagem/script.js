/* Original artwork in continuous vertical scrolling order, at window width. */
const magazine = document.querySelector('.magazine');
const pages = [...document.querySelectorAll('.page')];
const pending = new Map();
// Exact visible photo rectangles in the original 1440×1024 artboards.
const interactivePhotos = {
  11: { name: 'Microsoft', className: 'microsoft', src: 'assets/portrait/photo-171.png', staticCaption: { x: 199, y: 546, width: 1042, height: 24 }, caption: 'Visão externa dos pavilhões de data center da Microsoft (Fonte: Microsoft/Reprodução)' },
  13: { name: 'Google', className: 'google', src: 'assets/portrait/photo-129.png', staticCaption: { x: 771, y: 733, width: 595, height: 39 }, caption: 'Torres de resfriamento de data center do Google em Oregon, Estados Unidos (Fonte: Google/Reprodução)' },
};

function hideStaticPhotoCaption(page, number) {
  const region = interactivePhotos[number]?.staticCaption;
  if (!region) return;
  // The PDF outlined the fixed captions into grey paths. Hide only those
  // caption glyphs in the rendered copy, leaving all source SVG files intact.
  for (const path of page.querySelectorAll('.page__artwork svg path[fill="#4c4c4c"]')) {
    if (path.closest('defs')) continue;
    const box = path.getBBox();
    const matrix = path.getCTM();
    if (!matrix) continue;
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    if (corners.every(point => point.x >= region.x - 1 && point.x <= region.x + region.width + 1 && point.y >= region.y - 1 && point.y <= region.y + region.height + 1)) {
      path.setAttribute('visibility', 'hidden');
      path.dataset.staticPhotoCaption = 'true';
    }
  }
}

async function addPhotoInteraction(page, number) {
  const photo = interactivePhotos[number];
  if (!photo || page.querySelector('.photo-hotspot')) return;
  const picture = new Image();
  picture.src = photo.src;
  picture.alt = '';
  picture.draggable = false;
  picture.className = 'photo-hotspot__image';
  await picture.decode();
  const layer = document.createElement('div');
  layer.className = 'page__interactions';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `photo-hotspot photo-hotspot--${photo.className}`;
  button.setAttribute('aria-label', `Legenda da foto: ${photo.name}`);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `photo-caption-${number}`);
  const caption = document.createElement('span');
  caption.className = 'photo-hotspot__caption';
  caption.id = `photo-caption-${number}`;
  caption.textContent = photo.caption;
  caption.setAttribute('aria-hidden', 'true');
  button.append(picture, caption);
  layer.append(button);
  page.append(layer);
  let hovered = false;
  let keyboardFocus = false;
  let pinned = false;
  let pointerType = '';
  const update = () => {
    const open = hovered || keyboardFocus || pinned;
    button.classList.toggle('is-active', open);
    button.setAttribute('aria-expanded', String(open));
    caption.setAttribute('aria-hidden', String(!open));
  };
  button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; update(); } });
  button.addEventListener('pointerleave', () => { hovered = false; update(); });
  button.addEventListener('pointerdown', event => { pointerType = event.pointerType; });
  button.addEventListener('focus', () => { keyboardFocus = button.matches(':focus-visible'); update(); });
  button.addEventListener('blur', () => { keyboardFocus = false; pinned = false; update(); });
  button.addEventListener('click', event => {
    if (pointerType === 'touch' || event.detail === 0) {
      const open = button.classList.contains('is-active');
      keyboardFocus = false;
      pinned = !open;
      update();
    }
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hovered = false; keyboardFocus = false; pinned = false; update(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!button.contains(event.target)) { pinned = false; keyboardFocus = false; update(); }
  });
}

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
      hideStaticPhotoCaption(page, number);
      await addPhotoInteraction(page, number);
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
