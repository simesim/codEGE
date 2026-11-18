import { loadTemplate } from './catalog-data.js';
import { LEVELS } from './difficulty.js';
import { generateExercise } from './generator.js';
import { createPythonEditor } from './editor.js';
import { PythonClient } from './python-client.js';
import { loadTests, checkCode } from './checker.js';
import { renderTest } from './test-results.js';
import { createHintSession, mountHints } from './hints.js';
import { progress } from './progress.js';
import { mountMascot, MASCOT_REACTIONS } from './mascot.js';
import { mountMobileEditor } from './mobile-editor.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const id = params.get('id');
const level = Number(params.get('level'));
const status = $('#trainer-status');
const content = $('#trainer-content');
let editor, hintSession, hintPanel, mobilePanel;
const mascot = mountMascot($('#mascot'));
let initialCode;
let allowExit = false;
let completed = false, checking = false, tests, material;
const client = new PythonClient();
const checkButton = $('#check-code');
const retryPython = $('#retry-python');
const pythonStatus = $('#python-status');
const consoleOutput = $('#console-output');
const resultsNode = $('#test-results');

async function preparePython({ preserveReaction = false } = {}) {
  if (!preserveReaction) mascot.set('loading');
  checkButton.disabled = true; retryPython.hidden = true;
  pythonStatus.textContent = 'Загружаем Python…';
  try {
    await client.prepare();
    pythonStatus.textContent = 'Python готов к работе.';
    if (mascot.state === 'loading') mascot.set('ready');
    checkButton.disabled = checking || completed || !editor || !tests;
  } catch (error) {
    console.warn(error);
    pythonStatus.textContent = 'Не удалось загрузить Python. Проверь интернет и попробуй снова.';
    retryPython.hidden = false; mascot.set('unavailable');
  }
}
retryPython.onclick = () => preparePython();
function finishSuccess(summary) {
  if (completed) return;
  completed = true; allowExit = true; syncWarning();
  mascot.set('success');
  $('#success-mascot-message').textContent = MASCOT_REACTIONS.success.text;
  client.stop();
  $('#success-count').textContent = `Пройдено тестов: ${summary.passed} из ${summary.total}`;
  const query = new URLSearchParams({id, level: String(level)});
  $('#repeat-link').href = `trainer.html?${query}`;
  $('#theory-link').href = `theory.html?${new URLSearchParams({id})}`;
  $('#catalog-link').href = `index.html?task=${material.task.number}#catalog`;
  $('#repeat-link').onclick = event => { event.preventDefault(); location.reload(); };
  $('#success-panel').hidden = false;
  $('.editor-panel').hidden = true; $('.side-panel').hidden = true;
  checkButton.hidden = true; retryPython.hidden = true; pythonStatus.hidden = true;
  const result = { id, level, passed: summary.passed, total: summary.total, ...hintSession.summary() };
  try { progress.save(result); }
  catch (error) {
    console.warn('Не удалось сохранить прогресс:', error);
    $('#save-notice').hidden = false;
    $('#save-notice').textContent = 'Тесты пройдены, но браузер не сохранил прогресс. Проверь доступность локального хранилища.';
  }
  document.dispatchEvent(new CustomEvent('codege:training-completed', { detail: result }));
  $('#success-title').focus();
  $('#success-panel').scrollIntoView({block:'start'});
}
checkButton.onclick = async () => {
  if (checking || completed || !client.ready || !editor || !tests) return;
  checking = true; checkButton.disabled = true; retryPython.hidden = true; hintPanel.setBusy(true); mobilePanel?.setBusy(true); mascot.set('checking');
  editor.setReadOnly(true); editor.setErrorLine(null);
  for (const button of document.querySelectorAll('.tools button')) button.disabled = true;
  resultsNode.replaceChildren();
  const code = editor.getCode();
  let firstError = null;
  try {
    pythonStatus.textContent = 'Проверяем программу…';
    const summary = await checkCode(client, code, tests, {
      onStart(index, total) { pythonStatus.textContent = `Проверяем тест ${index + 1} из ${total}…`; },
      onResult(result, count, total) {
        renderTest(resultsNode, result);
        consoleOutput.textContent = `Проверено: ${count} из ${total}`;
        if (!firstError && result.error?.line) firstError = result.error.line;
      }
    });
    consoleOutput.textContent = `Пройдено тестов: ${summary.passed} из ${summary.total}${summary.success ? '' : '. Исправь код и повтори проверку.'}`;
    if (summary.success) { finishSuccess(summary); return; }
    pythonStatus.textContent = 'Не все тесты пройдены. Исправь код и повтори проверку.';
    editor.setErrorLine(firstError); mascot.set('error');
  } catch (error) {
    console.warn(error);
    consoleOutput.textContent = 'Проверку не удалось закончить. Твой код сохранён в редакторе.';
    pythonStatus.textContent = 'Ошибка загрузки или выполнения Python.'; mascot.set('error');
  } finally {
    checking = false;
    if (!completed) {
      editor.setReadOnly(false); hintPanel.setBusy(false); mobilePanel?.setBusy(false);
      $('#undo').disabled = !editor.historySize().undo;
      $('#redo').disabled = !editor.historySize().redo;
      $('#next-gap').disabled = false;
      // Новый интерпретатор для следующей проверки, чтобы не переносить между попытками состояние модулей.
      client.stop();
      await preparePython({ preserveReaction: true });
    }
  }
};

function showStatus(message, retry = false) {
  const p = document.createElement('p'); p.textContent = message;
  status.replaceChildren(p); status.hidden = false;
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'retry-button'; button.textContent = 'Попробовать снова';
    button.onclick = init; status.append(button);
  }
}
function changed() { return !completed && editor && editor.getCode() !== initialCode; }
function preventExit(event) {
  if (changed() && !allowExit) { event.preventDefault(); event.returnValue = ''; }
}
function syncWarning() {
  window.removeEventListener('beforeunload', preventExit);
  if (changed()) window.addEventListener('beforeunload', preventExit);
}
// Предупреждаем о потере текста при выходе через интерфейс.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || link.hash === '#main' && link.pathname === location.pathname || !changed() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (!confirm('Выйти из тренировки? Написанный код не будет сохранён.')) { event.preventDefault(); return; }
  allowExit = true;
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); else allowExit = false; });

async function init() {
  content.hidden = true; showStatus('Загружаем шаблон…');
  try {
    if (!id || !LEVELS.includes(level)) { showStatus('Выбери шаблон и сложность в каталоге.'); return; }
    material = await loadTemplate(id);
    if (!material) { showStatus('Шаблон не найден. Выбери другое задание.'); return; }
    const { task, config, code, folder } = material;
    tests = await loadTests(config, folder);
    const seed = generateExercise(code, config, level);
    hintSession = createHintSession(seed, config, level, code);
    const locked = level <= 50;
    document.title = `${config.title} — тренировка — CodEGE`;
    $('#back-link').href = `index.html?task=${task.number}#catalog`;
    $('#task-label').textContent = `Задание № ${task.number}`;
    $('#level-label').textContent = `${level}%`;
    $('#template-title').textContent = config.title;
    $('#template-condition').textContent = config.condition;
    $('#edit-mode').textContent = locked ? 'Редактируются только пропуски' : 'Свободный редактор';
    $('#gap-count').textContent = level === 100 ? 'Написание с нуля' : `Пропусков: ${seed.gaps.length}`;
    $('#side-title').textContent = level === 100 ? 'Напиши с нуля' : 'Восстанови код';
    const normalHelp = locked ? 'Восстанови выделенные пропуски. Остальная часть программы защищена.' : level === 100 ? 'Вспомни алгоритм и напиши его с нуля.' : 'Восстанови пропуски. Можно изменять любые строки программы.';
    $('#editor-help').textContent = normalHelp;
    content.hidden = false;
    initialCode = seed.text;
    editor = createPythonEditor($('#editor'), {
      ...seed, locked,
      onChange: () => { $('#editor-help').textContent = normalHelp; editor?.setErrorLine(null); syncWarning(); },
      onBlocked: () => { $('#editor-help').textContent = 'Этот фрагмент защищён. Редактируй только выделенные пропуски.'; },
      onCursor: pos => { $('#cursor-status').textContent = `Стр. ${pos.line + 1}, ст. ${pos.ch + 1}`; },
      onGap: gapId => hintPanel?.select(gapId),
      onHistory: history => { $('#undo').disabled = !history.undo; $('#redo').disabled = !history.redo; mobilePanel?.update(); }
    });
    hintPanel = mountHints($('#hint-panel'), hintSession, { full: level === 100, onSelect: gapId => editor.selectGap(gapId), onReveal: () => mascot.set('hint') });
    mobilePanel = mountMobileEditor($('#mobile-editor'), editor);
    $('#undo').onclick = () => editor.undo(); $('#redo').onclick = () => editor.redo();
    $('#next-gap').hidden = level === 100;
    $('#next-gap').onclick = () => editor.nextGap();
    status.hidden = true;
    editor.refresh();
    preparePython();
  } catch (err) { console.error(err); content.hidden = true; showStatus('Не удалось открыть тренировку. Попробуй снова.', true); }
}
init();
