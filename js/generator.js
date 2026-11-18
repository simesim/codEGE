/* Случайный выбор из размеченных фрагментов. Координаты JSON — Unicode code points. */
const LEVELS = [15, 30, 50, 75, 100];
const stringStart = /^(?:(?:fr|rf|br|rb|f|r|b|u))?("""|'''|"|')/i;
const tokenPattern = /^(?:[\p{L}\p{Nl}_][\p{L}\p{N}\p{M}\p{Pc}]*|(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?)[jJ]?|\*\*=|\/\/=|<<=|>>=|\.\.\.|\*\*|\/\/|<<|>>|==|!=|<=|>=|:=|->|[+\-*/%@&|^]=|[^\s])/u;

// Лексические элементы, не символы: идентификатор, число, оператор, литерал и т. п.
// Строки (включая f-строки) считаются одним элементом; комментарии и отступы — ноль.
export function significantTokens(code) {
  const result = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    const whitespace = rest.match(/^(?:\s+|\\\r?\n)/u);
    if (whitespace) { i += whitespace[0].length; continue; }
    if (rest[0] === '#') { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end; continue; }
    const string = rest.match(stringStart);
    let end;
    if (string) {
      const delimiter = string[1];
      end = i + string[0].length;
      while (end < code.length) {
        if (code[end] === '\\') { end = Math.min(end + 2, code.length); continue; }
        if (code.startsWith(delimiter, end)) { end += delimiter.length; break; }
        end++;
      }
    } else {
      end = i + rest.match(tokenPattern)[0].length;
    }
    result.push({ start: i, end });
    i = end;
  }
  return result;
}

// Перевод индексов Python в индексы JavaScript/CodeMirror (UTF-16).
function offsetsFor(code) {
  const offsets = [0];
  for (const char of code) offsets.push(offsets.at(-1) + char.length);
  return offsets;
}
function validateCandidates(code, config, tokens) {
  const offsets = offsetsFor(code);
  const ids = new Set();
  if (!Array.isArray(config.gaps)) throw new Error('Не задана разметка пропусков');
  return config.gaps.map(gap => {
    if (!gap || typeof gap.id !== 'string' || !gap.id || ids.has(gap.id) || !Number.isInteger(gap.start) || !Number.isInteger(gap.end) || gap.start < 0 || gap.end <= gap.start || gap.end >= offsets.length || !Array.isArray(gap.levels) || !gap.levels.length || gap.levels.some(n => !LEVELS.slice(0, 4).includes(n)) || !['element','line','block'].includes(gap.kind)) throw new Error('Некорректная разметка пропусков');
    ids.add(gap.id);
    const start = offsets[gap.start], end = offsets[gap.end];
    const touches = tokens.filter(t => t.start < end && t.end > start);
    if (!touches.length || touches.some(t => t.start < start || t.end > end)) throw new Error(`Пропуск ${gap.id} разрывает лексический элемент или пуст`);
    return { ...gap, start, end, weight: touches.length };
  });
}
const choose = (items, random) => items[Math.floor(random() * items.length)];

/* Динамическое программирование по интервалам.
   Для каждого достижимого числа удалённых токенов храним, есть ли блок.
   Соседние диапазоны с общей границей тоже не совмещаем: редактор должен
   однозначно различать два поля, а между ними должен оставаться исходный текст. */
function selectGaps(candidates, total, level, random) {
  const sorted = [...candidates].sort((a, b) => a.end - b.end || a.start - b.start);
  const previous = sorted.map((gap, i) => {
    let lo = 0, hi = i;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid].end < gap.start) lo = mid + 1; else hi = mid; }
    return lo;
  });
  // key = 2 * weight + blockFlag; count paths is unnecessary for random backtracking.
  const dp = [new Set([0])];
  sorted.forEach((gap, i) => {
    const states = new Set(dp[i]);
    for (const key of dp[previous[i]]) states.add(key + 2 * gap.weight + (gap.kind === 'block' && !(key % 2) ? 1 : 0));
    dp.push(states);
  });
  const target = total * level / 100;
  const distance = key => Math.abs(Math.floor(key / 2) - target);
  const possible = [...dp.at(-1)].filter(key => Math.floor(key / 2) > 0 && Math.floor(key / 2) < total);
  if (!possible.length) throw new Error('Нет подходящих пропусков для уровня');
  const best = Math.min(...possible.map(distance));
  // Малый допуск даёт варианты даже при единственном идеально точном весе.
  const tolerance = Math.max(1, Math.round(total * .02));
  let options = possible.filter(key => distance(key) <= best + tolerance);
  if (level === 75 && options.some(key => key % 2)) options = options.filter(key => key % 2);
  let key = choose(options, random);
  const selected = [];
  for (let i = sorted.length; i > 0;) {
    const gap = sorted[i - 1];
    const choices = [];
    if (dp[i - 1].has(key)) choices.push({ take: false, next: i - 1, key });
    const prev = previous[i - 1];
    const weight = Math.floor(key / 2) - gap.weight;
    if (weight >= 0) {
      for (const flag of [0, 1]) {
        if ((flag || gap.kind === 'block' ? 1 : 0) !== key % 2) continue;
        const prevKey = 2 * weight + flag;
        if (dp[prev].has(prevKey)) choices.push({ take: true, next: prev, key: prevKey });
      }
    }
    const step = choose(choices, random);
    if (step.take) selected.push(gap);
    i = step.next; key = step.key;
  }
  return selected.sort((a, b) => a.start - b.start);
}

function placeholder(text) {
  // Поля сохраняют количество строк и исходную ориентацию отступов; весь
  // маркер редактируемый. Не удаляем значащие символы вне разметки.
  return text.split('\n').map(line => line.trim() ? line.match(/^[ \t]*/)[0] + '___' : line).join('\n');
}

export function generateExercise(source, config, level, random = Math.random) {
  if (!LEVELS.includes(level)) throw new Error('Неизвестный уровень');
  const code = source.replace(/\r\n?/g, '\n');
  const tokens = significantTokens(code);
  const total = tokens.length;
  if (!total) throw new Error('Пустой шаблон');
  if (level === 100) return { text: '', gaps: [], removedTokens: total, totalTokens: total, actualPercent: 100 };
  const candidates = validateCandidates(code, config, tokens).filter(g => g.levels.includes(level));
  const selected = selectGaps(candidates, total, level, random);
  let text = '', end = 0, removedTokens = 0;
  const gaps = [];
  for (const gap of selected) {
    text += code.slice(end, gap.start);
    const from = text.length;
    const original = code.slice(gap.start, gap.end);
    const marker = placeholder(original);
    text += marker;
    gaps.push({ id: gap.id, from, to: text.length, kind: gap.kind, marker, original, hints: gap.hints });
    end = gap.end; removedTokens += gap.weight;
  }
  text += code.slice(end);
  return { text, gaps, removedTokens, totalTokens: total, actualPercent: removedTokens / total * 100 };
}
