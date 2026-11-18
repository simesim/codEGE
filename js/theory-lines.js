/* Связываем исходные строки с объяснениями. Нумерация начинается с 1. */
import { highlightPythonLine } from './python-highlight.js';

export function prepareTheory(code, explanations) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop(); // завершающий перевод строки не отдельная команда
  const byLine = new Map();
  for (const item of explanations) {
    if (!item || !Number.isInteger(item.line) || item.line < 1 || item.line > lines.length || byLine.has(item.line) || typeof item.text !== 'string' || !item.text.trim()) {
      throw new Error('Некорректная разметка объяснений');
    }
    byLine.set(item.line, item.text);
  }
  const result = lines.map((text, index) => ({ number: index + 1, text, explanation: byLine.get(index + 1) ?? null }));
  if (!byLine.size || result.some(line => line.text.trim() && !line.text.trimStart().startsWith('#') && line.explanation === null)) {
    throw new Error('Отсутствуют объяснения строк');
  }
  return result;
}

export function renderTheoryLines(lines, elements) {
  const { code, position, selectedCode, explanation, prev, next } = elements;
  const available = lines.filter(line => line.explanation !== null);
  let current = 0;
  const buttons = new Map();
  const state = { delimiter: null };
  const pieces = new Map();
  const fragment = document.createDocumentFragment();
  for (const line of lines) {
    const interactive = line.explanation !== null;
    const row = document.createElement(interactive ? 'button' : 'div');
    row.className = 'code-line';
    row.dataset.line = String(line.number);
    if (interactive) {
      row.type = 'button';
      row.setAttribute('aria-pressed', 'false');
      row.setAttribute('aria-label', `Строка ${line.number}: ${line.text.trim()}`);
      row.addEventListener('click', () => select(available.indexOf(line)));
      row.addEventListener('keydown', event => {
        const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        if (offset) { event.preventDefault(); select(available.indexOf(line) + offset, true); }
      });
      buttons.set(line.number, row);
    }
    const number = document.createElement('span');
    number.className = 'line-number';
    number.textContent = line.number;
    number.setAttribute('aria-hidden', 'true');
    const text = document.createElement('code');
    text.className = 'line-code';
    const highlighted = highlightPythonLine(line.text, state);
    pieces.set(line.number, highlighted.cloneNode(true));
    text.append(highlighted);
    row.append(number, text);
    fragment.append(row);
  }
  code.replaceChildren(fragment);
  function select(index, focus = false) {
    if (index < 0 || index >= available.length) return;
    buttons.get(available[current].number)?.setAttribute('aria-pressed', 'false');
    current = index;
    const line = available[current];
    const button = buttons.get(line.number);
    button.setAttribute('aria-pressed', 'true');
    position.textContent = `${line.number} / ${lines.length}`;
    selectedCode.replaceChildren(pieces.get(line.number).cloneNode(true));
    explanation.textContent = line.explanation;
    prev.disabled = current === 0;
    next.disabled = current === available.length - 1;
    if (focus) button.focus({ preventScroll: true });
    // Прокручиваем только список строк, не всю страницу.
    const rect = button.getBoundingClientRect();
    const viewport = code.getBoundingClientRect();
    if (rect.top < viewport.top) code.scrollTop += rect.top - viewport.top;
    if (rect.bottom > viewport.bottom) code.scrollTop += rect.bottom - viewport.bottom;
  }
  prev.onclick = () => select(current - 1);
  next.onclick = () => select(current + 1);
  select(0);
}
