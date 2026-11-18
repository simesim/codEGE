/* Карточки ученического каталога. HTML не зависит от числа заданий. */
import { loadCatalog } from './catalog-data.js';
import { progress, PROGRESS_PREFIX } from './progress.js';
import { paintProgress } from './progress-view.js';

const grid = document.querySelector('#task-grid');
const status = document.querySelector('#catalog-status');
const count = document.querySelector('#catalog-count');
const progressNotice = document.querySelector('#catalog-progress-notice');
const resetAll = document.querySelector('#reset-all-progress');
const requestedTask = new URLSearchParams(location.search).get('task');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function quantity(n, forms) {
  const last = n % 10, lastTwo = n % 100;
  return `${n} ${forms[lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2]}`;
}

function makeTaskCard(task, index) {
  const card = element('details', `task-card ${index % 2 ? 'task-card-blue' : 'task-card-lime'}`);
  card.dataset.task = String(task.number);
  const summary = element('summary');
  const copy = element('div', 'task-copy');
  copy.append(element('h3', '', task.title), element('p', '', quantity(task.templates.length, ['шаблон', 'шаблона', 'шаблонов'])));
  const expand = element('span', 'expand-icon');
  expand.setAttribute('aria-hidden', 'true');
  summary.append(element('span', 'task-number', String(task.number)), copy, expand);
  const list = element('div', 'template-list');
  for (const template of task.templates) {
    const article = element('article', 'template-item');
    const link = element('a', 'template-link');
    link.href = `theory.html?id=${encodeURIComponent(template.id)}`;
    link.append(element('h4', '', template.title), element('span', 'template-arrow', '↗'));
    link.lastElementChild.setAttribute('aria-hidden', 'true');
    const detail = element('div', 'template-progress');
    detail.dataset.progressId = template.id;
    article.append(link, detail);
    list.append(article);
  }
  if (!task.templates.length) list.append(element('p', 'empty-section', 'Пока нет шаблонов.'));
  card.append(summary, list);
  card.addEventListener('toggle', () => {
    if (card.open) {
      for (const other of grid.querySelectorAll('.task-card[open]')) {
        if (other !== card) other.open = false;
      }
    }
  });
  return card;
}

function showStatus(message, retry = false) {
  status.replaceChildren(element('p', '', message));
  status.hidden = false;
  if (retry) {
    const button = element('button', 'retry-button', 'Попробовать снова');
    button.type = 'button';
    button.addEventListener('click', initCatalog);
    status.append(button);
  }
}

async function initCatalog() {
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren();
  count.textContent = '';
  showStatus('Загружаем задания…');
  try {
    const catalog = await loadCatalog();
    const total = catalog.tasks.reduce((sum, task) => sum + task.templates.length, 0);
    count.textContent = `${quantity(catalog.tasks.length, ['раздел', 'раздела', 'разделов'])} / ${quantity(total, ['шаблон', 'шаблона', 'шаблонов'])}`;
    if (!catalog.tasks.length) {
      showStatus('Задания пока не добавлены.');
      return;
    }
    const fragment = document.createDocumentFragment();
    catalog.tasks.forEach((task, index) => fragment.append(makeTaskCard(task, index)));
    grid.append(fragment);
    refreshProgress();
    status.hidden = true;
    status.replaceChildren();
    const previous = [...grid.children].find(card => card.dataset.task === requestedTask);
    if (previous) previous.open = true;
  } catch (error) {
    console.error('Не удалось загрузить каталог:', error);
    showStatus('Не удалось загрузить задания. Проверь подключение к интернету.', true);
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

function refreshProgress() {
  let unavailable = false;
  for (const node of grid.querySelectorAll('[data-progress-id]')) {
    try { paintProgress(node, progress.read(node.dataset.progressId)); }
    catch { paintProgress(node, null); unavailable = true; }
  }
  try { resetAll.disabled = !progress.hasAny(); }
  catch { resetAll.disabled = true; unavailable = true; }
  progressNotice.textContent = unavailable ? 'Не удалось прочитать сохранённый прогресс. Проверь настройки браузера.' : '';
  progressNotice.hidden = !unavailable;
}
resetAll.addEventListener('click', () => {
  if (!confirm('Сбросить весь прогресс CodEGE в этом браузере? Это действие нельзя отменить.')) return;
  try { progress.resetAll(); refreshProgress(); }
  catch { progressNotice.hidden = false; progressNotice.textContent = 'Не удалось сбросить прогресс. Попробуй ещё раз.'; }
});
window.addEventListener('pageshow', refreshProgress);
window.addEventListener('storage', e => { if (e.key === null || e.key.startsWith(PROGRESS_PREFIX)) refreshProgress(); });
initCatalog();
