/* Native HTML magazine: measured portrait pagination and a two-faced 3D page turn.
 * Content and illustrations are local exports from the approved PDF edition.
 */
const stage = document.getElementById('reader-stage');
const previous = document.getElementById('previous-page');
const next = document.getElementById('next-page');
const status = document.getElementById('page-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let edition;
let sheets = [];
let chapterStarts = new Map();
let current = 0;
let spread = false;
let book;
let turning = false;
let turnAnimation = null;
let layoutTimer;
let layoutSignature = '';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function localAsset(value) {
  if (!/^assets\/portrait\/(?:photo-\d+\.(?:png|jpeg|jpg)|(?:energy|pue)\.png)$/.test(value)) {
    throw new Error('Imagem não permitida.');
  }
  return value;
}

function image(src, alt, width, height) {
  const element = node('img');
  element.src = localAsset(src);
  element.alt = alt;
  element.width = width;
  element.height = height;
  element.loading = 'lazy';
  element.draggable = false;
  element.decoding = 'async';
  return element;
}

function renderBlock(block) {
  if (block.type === 'figure') {
    const figure = node('figure', `figure${block.kind === 'chart' ? ' figure--chart' : ''}`);
    figure.style.setProperty('--figure-ratio', String(block.width / block.height));
    const picture = image(block.src, block.alt, block.width, block.height);
    if (block.kind === 'chart') {
      const link = node('a', 'figure__zoom');
      link.href = localAsset(block.src);
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `Ampliar gráfico em nova aba: ${block.alt}`);
      link.append(picture, node('span', 'figure__zoom-label', 'Ampliar gráfico ↗'));
      figure.append(link);
    } else figure.append(picture);
    if (block.caption) figure.append(node('figcaption', '', block.caption));
    return figure;
  }
  if (block.type === 'team') {
    const group = node('div', 'team');
    for (const person of block.people) {
      const figure = node('figure');
      const portrait = image(person.src, person.name, 96, 96);
      if (person.rotation) portrait.style.transform = `rotate(${Number(person.rotation)}deg)`;
      figure.append(portrait, node('figcaption', '', person.name));
      group.append(figure);
    }
    return group;
  }
  if (block.type === 'callout') {
    const variant = ['stat', 'quote', 'credit', 'condition'].includes(block.variant) ? block.variant : 'note';
    const aside = node('aside', `callout callout--${variant}`);
    if (block.continued) aside.append(node('span', 'callout__continuation', 'Continuação'));
    if (block.title) aside.append(node('h3', '', block.title));
    const text = node('p', '', block.text);
    text.dataset.flowText = 'true';
    aside.append(text);
    return aside;
  }
  const element = node(block.type === 'subheading' ? 'h3' : 'p',
    block.type === 'lead' || block.type === 'quote' ? block.type : '', block.text);
  element.dataset.flowText = 'true';
  return element;
}

function makeSheet(chapter, workbench, title = false) {
  const article = node('article', `sheet${chapter.theme === 'red' ? ' sheet--red' : ''}`);
  article.dataset.chapter = chapter.id;
  article.dataset.chapters = chapter.id;
  const header = node('div', 'sheet__running-head');
  header.append(node('span', '', 'GNōSIS'), node('span', '', chapter.title));
  const content = node('div', 'sheet__content');
  if (title) {
    const heading = node('h2', 'sheet__title', chapter.title);
    heading.dataset.section = chapter.id;
    content.append(heading);
  }
  const footer = node('footer', 'sheet__footer');
  footer.append(node('span', '', 'O peso invisível da nuvem'), node('span', 'sheet__number'));
  article.append(header, content, footer);
  workbench.append(article);
  sheets.push(article);
  return { article, content };
}

function fits(content) {
  return content.scrollHeight <= content.clientHeight + 1;
}

/** Split only at word boundaries, testing actual browser layout on each leaf. */
function paginateChapter(chapter, workbench) {
  let page;
  const last = sheets.at(-1);
  // Continue on available paper instead of reserving a fresh leaf per topic.
  // Never merge the cover/contents or sections with different paper colors.
  if (last && !['capa', 'sumario'].includes(last.dataset.chapter) &&
      last.classList.contains('sheet--red') === (chapter.theme === 'red')) {
    const content = last.querySelector('.sheet__content');
    const heading = node('h2', 'sheet__title sheet__title--section', chapter.title);
    heading.dataset.section = chapter.id;
    const first = chapter.blocks[0];
    const probeBlock = first?.text ? { ...first, text: first.text.split(/\s+/).slice(0, 32).join(' ') } : first;
    const probe = node('div');
    if (chapter.id === 'creditos') {
      for (const block of chapter.blocks) probe.append(renderBlock(block));
    } else if (probeBlock) probe.append(renderBlock(probeBlock));
    // Keep a new title with the start of its article, not alone at the foot.
    content.append(heading, probe);
    const room = fits(content);
    probe.remove();
    if (room) {
      page = { article: last, content };
      last.dataset.chapters += ` ${chapter.id}`;
    } else heading.remove();
  }
  if (!page) page = makeSheet(chapter, workbench, true);
  chapterStarts.set(chapter.id, sheets.indexOf(page.article));
  function freshPage() { page = makeSheet(chapter, workbench); }
  for (const [blockIndex, original] of chapter.blocks.entries()) {
    let block = { ...original };
    let words = typeof block.text === 'string' ? block.text.split(/\s+/) : null;
    let continued = false;
    while (true) {
      const element = renderBlock(block);
      element.dataset.block = `${chapter.id}-${blockIndex}`;
      page.content.append(element);
      if (fits(page.content)) {
        // A subheading must stay with at least the opening lines below it.
        if (block.type === 'subheading' && chapter.blocks[blockIndex + 1]?.text) {
          const following = chapter.blocks[blockIndex + 1];
          const probe = renderBlock({ ...following, text: following.text.split(/\s+/).slice(0, 20).join(' ') });
          page.content.append(probe);
          const together = fits(page.content);
          probe.remove();
          if (!together && page.content.children.length > 1) {
            element.remove(); freshPage(); continue;
          }
        }
        break;
      }
      // Short boxes/quotes stay whole. Only boxes taller than a fresh page
      // may split, and those repeat their heading with a continuation label.
      const keepWhole = ['callout', 'quote'].includes(block.type) && element.offsetHeight <= page.content.clientHeight;
      element.remove();
      if (keepWhole && page.content.children.length) { freshPage(); continue; }
      const splittable = words && ['p', 'lead', 'quote', 'callout'].includes(block.type);
      if (!splittable) {
        if (page.content.children.length) {
          freshPage();
          continue;
        }
        // Atomic figures have bounded height. An unusually long team block can
        // shrink its portraits without clipping names or changing the content.
        page.content.append(element);
        if (block.type === 'figure') {
          const picture = element.querySelector('img');
          picture.style.maxHeight = `${Math.max(40, page.content.clientHeight - 80)}px`;
        }
        if (!fits(page.content)) throw new Error(`Bloco não cabe: ${chapter.id}/${blockIndex}`);
        break;
      }
      let low = 0;
      let high = words.length;
      let best = 0;
      page.content.append(element);
      const target = element.matches('[data-flow-text]') ? element : element.querySelector('[data-flow-text]');
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        target.textContent = words.slice(0, middle).join(' ');
        if (fits(page.content)) {
          best = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      if (best < Math.min(16, words.length) && page.content.children.length > 1) {
        element.remove();
        freshPage();
        continue;
      }
      if (best === 0) {
        element.remove();
        if (page.content.children.length) { freshPage(); continue; }
        throw new Error(`Texto não cabe: ${chapter.id}/${blockIndex}`);
      }
      // Avoid carrying only a handful of words onto the following leaf.
      if (words.length - best > 0 && words.length - best < 12 && best > 24) best = words.length - 12;
      target.textContent = words.slice(0, best).join(' ');
      words = words.slice(best);
      if (!words.length) break;
      continued = true;
      block = { ...original, text: words.join(' '), continued };
      freshPage();
    }
  }
  balanceChapterEnd(chapter);
}

function balanceChapterEnd(chapter) {
  const tail = sheets.at(-1);
  const prior = sheets.at(-2);
  if (!prior || prior.dataset.chapters !== chapter.id || tail.dataset.chapters !== chapter.id) return;
  const before = prior.querySelector('.sheet__content');
  const after = tail.querySelector('.sheet__content');
  const used = content => content.lastElementChild
    ? content.lastElementChild.getBoundingClientRect().bottom - content.getBoundingClientRect().top : 0;
  while (used(after) < after.clientHeight * .5) {
    const block = before.lastElementChild;
    if (!block?.matches('p[data-block]') || block.getBoundingClientRect().top - before.getBoundingClientRect().top < before.clientHeight * .5) break;
    const next = after.firstElementChild;
    after.prepend(block);
    if (!fits(after)) { before.append(block); break; }
    if (next?.matches('p') && next.dataset.block === block.dataset.block) {
      block.textContent += ` ${next.textContent}`;
      next.remove();
    }
  }
}

function makeCover(workbench) {
  const article = node('article', 'sheet sheet--cover');
  article.dataset.chapter = 'capa';
  const cover = node('div', 'cover');
  const editionLine = node('div', 'cover__edition');
  editionLine.append(node('span', '', 'Edição n. 1°'), node('span', '', 'São Paulo • 18 de outubro, 2026'));
  const title = node('h1', '', 'O PESO\nINVISÍVEL\nDA NUVEM');
  const subtitle = node('p', 'cover__subtitle', 'Big Data e Desenvolvimento Sustentável: Colonialismo Digital e Impactos Ambientais');
  const collage = image('assets/portrait/photo-29.png', 'Colagem original: Brasil, infraestrutura digital e comunidades afetadas.', 1487, 1058);
  collage.className = 'cover__collage';
  cover.append(editionLine, title, subtitle, collage, node('div', 'cover__brand', 'GNōSIS'));
  article.append(cover);
  workbench.append(article);
  sheets.push(article);
  chapterStarts.set('capa', 0);
}

function makeContents(workbench) {
  const chapter = { id: 'sumario', title: 'Sumário', theme: 'paper' };
  chapterStarts.set('sumario', sheets.length);
  let page = makeSheet(chapter, workbench, true);
  for (const section of edition.chapters) {
    const link = node('a', 'toc-link');
    link.href = `#materia-${section.id}`;
    link.dataset.topic = section.id;
    link.append(node('span', 'toc-label', section.title), node('span', 'toc-number', '00'));
    page.content.append(link);
    if (!fits(page.content)) {
      link.remove();
      page = makeSheet(chapter, workbench);
      page.content.append(link);
    }
  }
}

function dimensions() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const double = width >= 960 && height >= 500;
  const leafHeight = Math.floor(Math.max(260, height - 36));
  const leafWidth = Math.floor(double ? Math.min(560, (width - 100) / 2, leafHeight / 1.4142) : Math.min(520, width - 24, leafHeight * .82));
  const finalHeight = Math.floor(double ? leafWidth * 1.4142 : Math.min(leafHeight, Math.max(leafWidth * 1.4142, leafHeight)));
  return { double, width: leafWidth, height: finalHeight };
}

function createCorner(direction) {
  const button = node('button', `book__corner book__corner--${direction}`, direction === 'next' ? '›' : '‹');
  button.type = 'button';
  button.setAttribute('aria-label', direction === 'next' ? 'Virar próxima página' : 'Virar página anterior');
  button.addEventListener('click', () => step(direction === 'next' ? 1 : -1));
  return button;
}

function rebuild() {
  if (!edition) return;
  const size = dimensions();
  const signature = `${size.double}/${size.width}/${size.height}`;
  if (signature === layoutSignature) return;
  const wasReady = sheets.length > 0;
  const requested = /^#materia-([a-z-]+)$/.exec(location.hash)?.[1];
  const chapter = requested && visibleIndexes(current).includes(chapterStarts.get(requested))
    ? requested : sheets[current]?.dataset.chapter || 'capa';
  const oldStart = chapterStarts.get(chapter) || 0;
  const oldLength = sheets.filter(sheet => sheet.dataset.chapters?.split(' ').includes(chapter)).length;
  const progress = oldLength > 1 ? (current - oldStart) / (oldLength - 1) : 0;
  if (turnAnimation) turnAnimation.cancel();
  turning = false;
  stage.setAttribute('aria-busy', 'true');
  layoutSignature = signature;
  spread = size.double;
  document.documentElement.style.setProperty('--sheet-width', `${size.width}px`);
  document.documentElement.style.setProperty('--sheet-height', `${size.height}px`);
  sheets = [];
  chapterStarts = new Map();
  const workbench = node('div', 'pagination-workbench');
  workbench.setAttribute('aria-hidden', 'true');
  document.body.append(workbench);
  try {
    makeCover(workbench);
    makeContents(workbench);
    for (const section of edition.chapters) paginateChapter(section, workbench);
    for (const sheet of sheets) {
      const ids = sheet.dataset.chapters?.split(' ') || [];
      const titles = ids.map(id => edition.chapters.find(section => section.id === id)?.title).filter(Boolean);
      const label = sheet.querySelector('.sheet__running-head span:last-child');
      if (label && titles.length) {
        label.textContent = titles.join(' / ');
        label.title = label.textContent;
      }
    }
    book = node('div', 'book');
    for (const [index, sheet] of sheets.entries()) {
      sheet.id = `pagina-${index + 1}`;
      sheet.dataset.page = String(index + 1);
      sheet.setAttribute('aria-label', `${sheet.dataset.chapter === 'capa' ? 'Capa' : sheet.querySelector('.sheet__running-head span:last-child').textContent}, página ${index + 1}`);
      const number = sheet.querySelector('.sheet__number');
      if (number) number.textContent = String(index + 1);
      sheet.hidden = true;
      book.append(sheet);
    }
    for (const link of book.querySelectorAll('.toc-link')) {
      link.querySelector('.toc-number').textContent = String(chapterStarts.get(link.dataset.topic) + 1).padStart(2, '0');
    }
    book.append(createCorner('previous'), createCorner('next'));
    stage.replaceChildren(book);
    const newLength = sheets.filter(sheet => sheet.dataset.chapters?.split(' ').includes(chapter)).length;
    current = (chapterStarts.get(chapter) || 0) + Math.round(progress * Math.max(0, newLength - 1));
    show(current);
    if (wasReady && !location.hash.startsWith('#materia-')) history.replaceState(null, '', `#pagina-${current + 1}`);
    stage.dataset.ready = 'true';
    stage.setAttribute('aria-busy', 'false');
  } finally { workbench.remove(); }
}

function visibleIndexes(index) {
  if (!spread || index === 0 || index === sheets.length - 1) return [index];
  const first = 1 + Math.floor((index - 1) / 2) * 2;
  return first + 1 < sheets.length ? [first, first + 1] : [first];
}

function updateControls() {
  const visible = visibleIndexes(current);
  const last = visible[visible.length - 1];
  previous.disabled = turning || current === 0;
  next.disabled = turning || last >= sheets.length - 1;
  book.querySelector('.book__corner--previous').disabled = previous.disabled;
  book.querySelector('.book__corner--next').disabled = next.disabled;
  status.textContent = current === 0 ? 'Capa' : `${visible.map(i => i + 1).join('–')} / ${sheets.length}`;
  const chapterId = sheets[current].dataset.chapter;
  const title = chapterId === 'sumario' ? 'Sumário' : edition.chapters.find(section => section.id === chapterId)?.title;
  document.title = `${current === 0 ? edition.title : title || edition.title} — GNōSIS`;
}

function show(index) {
  current = Math.max(0, Math.min(index, sheets.length - 1));
  const visible = visibleIndexes(current);
  book.classList.toggle('book--single', visible.length === 1);
  for (const [i, sheet] of sheets.entries()) {
    sheet.style.removeProperty('z-index');
    sheet.hidden = !visible.includes(i);
    sheet.classList.toggle('is-left', visible.length === 2 && i === visible[0]);
    sheet.classList.toggle('is-right', visible.length === 2 && i === visible[1]);
    if (!sheet.hidden) {
      for (const picture of sheet.querySelectorAll('img')) picture.loading = 'eager';
    }
  }
  // Warm only the adjacent leaves instead of downloading the entire edition.
  for (let i = visible[visible.length - 1] + 1; i <= Math.min(sheets.length - 1, visible[visible.length - 1] + 2); i++) {
    for (const picture of sheets[i].querySelectorAll('img')) picture.loading = 'eager';
  }
  updateControls();
}

function duplicate(sheet) {
  const clone = sheet.cloneNode(true);
  clone.hidden = false;
  clone.removeAttribute('id');
  clone.removeAttribute('aria-label');
  clone.removeAttribute('data-page');
  clone.removeAttribute('data-chapter');
  clone.classList.remove('is-right', 'is-left');
  for (const element of clone.querySelectorAll('[id]')) element.removeAttribute('id');
  return clone;
}

/** Show the actual front and back of a moving paper leaf. */
async function turnTo(index, record = true) {
  if (turning || !sheets.length) return;
  index = Math.max(0, Math.min(index, sheets.length - 1));
  if (index === current) return;
  const outgoing = visibleIndexes(current);
  const incoming = visibleIndexes(index);
  if (outgoing.join() === incoming.join() || reducedMotion.matches) {
    show(index);
  } else {
    const forward = index > current;
    const turningBook = book;
    const frontSheet = sheets[forward ? outgoing[outgoing.length - 1] : outgoing[0]];
    const backSheet = sheets[forward ? incoming[0] : incoming[incoming.length - 1]];
    const old = current;
    const front = duplicate(frontSheet);
    const back = duplicate(backSheet);
    show(index);
    turning = true;
    updateControls();
    const single = incoming.length === 1;
    const overlay = node('div', `turning-sheet turning-sheet--${forward ? 'forward' : 'backward'}`);
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    const face = node('div', 'turn-face');
    const reverse = node('div', 'turn-face turn-face--back');
    face.append(front);
    // A single-page viewport exposes the next stationary page as paper turns.
    if (!single && outgoing.length === 2) reverse.append(back);
    overlay.append(face, reverse);
    book.append(overlay);
    if (!single && outgoing.length === 2) {
      const retained = sheets[forward ? outgoing[0] : outgoing[outgoing.length - 1]];
      retained.hidden = false;
      retained.classList.toggle('is-left', forward);
      retained.classList.toggle('is-right', !forward);
      retained.style.zIndex = '2';
    }
    const angle = forward ? -180 : 180;
    // Filters on a preserve-3d ancestor flatten its children, exposing mirrored
    // backs. Keep the paper's 3D scene unfiltered and switch faces at 90°.
    const timing = { duration: 880, easing: 'cubic-bezier(.42,0,.24,1)', fill: 'forwards' };
    turnAnimation = overlay.animate([
      { transform: 'rotateY(0deg)' },
      { transform: `rotateY(${angle}deg)` },
    ], timing);
    const frontVisibility = face.animate([
      { opacity: 1, offset: 0 }, { opacity: 1, offset: .5 },
      { opacity: 0, offset: .5 }, { opacity: 0, offset: 1 },
    ], timing);
    const backVisibility = reverse.animate([
      { opacity: 0, offset: 0 }, { opacity: 0, offset: .5 },
      { opacity: 1, offset: .5 }, { opacity: 1, offset: 1 },
    ], timing);
    const startTime = document.timeline.currentTime;
    for (const animation of [turnAnimation, frontVisibility, backVisibility]) animation.startTime = startTime;
    try { await turnAnimation.finished; } catch { /* Resize cancels the turn. */ }
    frontVisibility.cancel();
    backVisibility.cancel();
    overlay.remove();
    if (book !== turningBook) return;
    turning = false;
    turnAnimation = null;
    if (book.isConnected) show(current);
    if (old === current) return;
  }
  if (record) history.pushState(null, '', `#pagina-${index + 1}`);
}

function step(direction) {
  if (!sheets.length || turning) return;
  const visible = visibleIndexes(current);
  const destination = direction > 0 ? visible[visible.length - 1] + 1 : visible[0] - 1;
  if (destination >= 0 && destination < sheets.length) turnTo(destination);
}

function restore() {
  if (!sheets.length) return;
  const match = /^#pagina-(\d+)$/.exec(location.hash);
  const chapter = /^#materia-([a-z-]+)$/.exec(location.hash);
  let target = 0;
  if (match) target = Number(match[1]) - 1;
  else if (chapter) target = chapterStarts.get(chapter[1]) ?? 0;
  show(target);
}

previous.addEventListener('click', () => step(-1));
next.addEventListener('click', () => step(1));
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const href = link.getAttribute('href');
  if (href !== '#capa' && !/^#materia-[a-z-]+$/.test(href)) return;
  event.preventDefault();
  if (turning) return;
  const key = href === '#capa' ? 'capa' : href.slice('#materia-'.length);
  turnTo(chapterStarts.get(key) || 0, false).then(() => {
    history.pushState(null, '', href);
    // The contents link is now on a hidden leaf. Move focus to a stable control.
    (next.disabled ? previous : next).focus({ preventScroll: true });
  });
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
      event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  }
});
let pointerStart = null;
stage.addEventListener('pointerdown', event => {
  if (event.target.closest('button, a, select') || event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
stage.addEventListener('pointerup', event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && !window.getSelection()?.toString()) {
    step(dx < 0 ? 1 : -1);
  }
});
stage.addEventListener('pointercancel', () => { pointerStart = null; });
window.addEventListener('popstate', restore);
window.addEventListener('hashchange', restore);
window.addEventListener('resize', () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => { try { rebuild(); } catch (error) { fail(error); } }, 180);
});

function fail(error) {
  console.error(error);
  const message = node('p', 'loading-message', 'Não foi possível preparar a revista. ');
  const retry = node('button', '', 'Tentar novamente');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  const fallback = node('a', '', 'Ler versão em texto');
  fallback.href = 'texto.html';
  message.append(retry, document.createTextNode(' '), fallback);
  stage.replaceChildren(message);
  stage.setAttribute('aria-busy', 'false');
}

async function start() {
  const response = await fetch('assets/portrait/edition.json', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Edição indisponível.');
  edition = await response.json();
  await document.fonts.ready;
  rebuild();
  restore();
}
start().catch(fail);
