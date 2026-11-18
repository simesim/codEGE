/* Загрузка шаблона и интерактивный построчный разбор. */
import { loadTemplate } from './catalog-data.js';
import { prepareTheory, renderTheoryLines } from './theory-lines.js';
import { renderDifficulty } from './difficulty.js';
import { progress, recommend, PROGRESS_PREFIX } from './progress.js';
import { paintProgress } from './progress-view.js';

const status = document.querySelector('#theory-status');
const content = document.querySelector('#theory-content');
const id = new URLSearchParams(location.search).get('id');
let difficulty;
const reset = document.querySelector('#reset-template-progress');
const notice = document.querySelector('#theory-progress-notice');
function refreshProgress(chooseRecommended = false) {
  let record = null;
  try { record = progress.read(id); notice.hidden = true; reset.disabled = record.passedLevels.length === 0; }
  catch { notice.hidden = false; notice.textContent = 'Прогресс недоступен. Ты всё равно можешь заниматься.'; reset.disabled = false; }
  paintProgress(document.querySelector('#template-progress'), record, { showLevels: false });
  const recommended = record ? recommend(record) : null;
  document.querySelector('#difficulty-recommendation').textContent = !record ? '' : recommended === null ? 'Шаблон освоен. Можно перейти к другому или повторить этот.' : `Рекомендуемая сложность: ${recommended}%`;
  difficulty = renderDifficulty(document.querySelector('#difficulty-grid'), document.querySelector('#difficulty-description'), chooseRecommended ? (recommended ?? (record ? 100 : 15)) : (difficulty?.selectedLevel ?? recommended ?? 15), { recommended, passedLevels:record?.passedLevels ?? [] });
}
reset.onclick = () => {
  if (!confirm('Сбросить прогресс этого шаблона? Остальные результаты сохранятся.')) return;
  try { progress.reset(id); refreshProgress(true); }
  catch { notice.hidden = false; notice.textContent = 'Не удалось сбросить прогресс.'; }
};
window.addEventListener('pageshow', e => { if (e.persisted && difficulty) refreshProgress(true); });
window.addEventListener('storage', e => { if (difficulty && (e.key === null || e.key === PROGRESS_PREFIX + id)) refreshProgress(); });

function showStatus(message, retry = false) {
  const text = document.createElement('p');
  text.textContent = message;
  status.replaceChildren(text);
  status.hidden = false;
  if (retry) {
    const button = document.createElement('button');
    button.className = 'retry-button';
    button.type = 'button';
    button.textContent = 'Попробовать снова';
    button.addEventListener('click', initTheory);
    status.append(button);
  }
}

async function initTheory() {
  content.hidden = true;
  content.setAttribute('aria-busy', 'true');
  showStatus('Загружаем шаблон…');
  try {
    const material = id ? await loadTemplate(id) : null;
    if (!material) {
      showStatus('Шаблон не найден. Выбери другой в каталоге.');
      return;
    }
    const { task, config, code } = material;
    document.title = `${config.title} — CodEGE`;
    document.querySelector('#back-link').href = `index.html?task=${task.number}#catalog`;
    document.querySelector('#task-label').textContent = `Задание № ${task.number} / ${task.title}`;
    document.querySelector('#template-title').textContent = config.title;
    document.querySelector('#template-condition').textContent = config.condition;
    const lines = prepareTheory(code, config.explanations);
    renderTheoryLines(lines, {
      code: document.querySelector('#template-code'),
      position: document.querySelector('#line-position'),
      selectedCode: document.querySelector('#selected-code'),
      explanation: document.querySelector('#line-explanation'),
      prev: document.querySelector('#prev-line'),
      next: document.querySelector('#next-line')
    });
    refreshProgress(true);
    document.querySelector('#start-training').onclick = () => {
      const params = new URLSearchParams({ id, level: String(difficulty.selectedLevel) });
      location.href = `trainer.html?${params}`;
    };
    status.hidden = true;
    status.replaceChildren();
    content.hidden = false;
  } catch (error) {
    console.error('Не удалось загрузить шаблон:', error);
    showStatus('Не удалось открыть шаблон. Попробуй загрузить его ещё раз.', true);
  } finally {
    content.setAttribute('aria-busy', 'false');
  }
}

initTheory();
