/* Подсказки — состояние только текущей тренировки. Никаких сетевых запросов. */
export const HINT_LABELS = ['Логика', 'Команда', 'Правильный фрагмент'];

function target(id, label, hints, original) {
  if (!Array.isArray(hints) || hints.length !== 3 || hints.some(s => typeof s !== 'string' || !s.trim()) || hints[2] !== original) {
    throw new Error(`Некорректные подсказки: ${id}`);
  }
  return { id, label, hints: [...hints] };
}

export function createHintSession(seed, config, level, source) {
  const full = level === 100;
  const targets = full
    ? [target('full', 'Весь алгоритм', config.fullCodeHints, source.replace(/\r\n?/g, '\n'))]
    : seed.gaps.map((gap, index) => target(gap.id, `Пропуск ${index + 1}`, gap.hints, gap.original));
  if (!targets.length || new Set(targets.map(t => t.id)).size !== targets.length) throw new Error('Нет корректных подсказок');
  const stages = new Map(targets.map(t => [t.id, 0]));
  let count = 0;
  return {
    targets: targets.map(({id,label}) => ({id,label})),
    get(id) {
      const item = targets.find(t => t.id === id);
      if (!item) throw new Error('Неизвестная подсказка');
      const stage = stages.get(id);
      return { stage, hints: item.hints.slice(0, stage) };
    },
    reveal(id) {
      const {stage} = this.get(id);
      if (stage < 3) { stages.set(id, stage + 1); count++; }
      return this.get(id);
    },
    // Повторное чтение открытой подсказки не добавляет новое обращение.
    summary() { return { usedHints: count > 0, hintCount: count }; }
  };
}

export function mountHints(host, session, {onSelect, onReveal, full = false} = {}) {
  const select = host.querySelector('#hint-target');
  const button = host.querySelector('#reveal-hint');
  const list = host.querySelector('#hint-list');
  const note = host.querySelector('#hint-note');
  let busy = false;
  for (const {id,label} of session.targets) {
    const option = document.createElement('option'); option.value = id; option.textContent = label;
    select.append(option);
  }
  host.querySelector('.hint-target-row').hidden = full;
  function render() {
    const {stage,hints} = session.get(select.value);
    list.replaceChildren();
    hints.forEach((text, i) => {
      const item = document.createElement('li');
      const title = document.createElement('h3');
      title.textContent = `${i + 1}. ${full && i === 2 ? 'Оригинальный шаблон' : HINT_LABELS[i]}`;
      const body = document.createElement(i === 2 ? 'pre' : 'p');
      body.textContent = text; item.append(title,body); list.append(item);
    });
    button.textContent = ['Получить подсказку', 'Напомнить команду', full ? 'Показать шаблон' : 'Показать фрагмент', 'Все подсказки открыты'][stage];
    button.disabled = busy || stage === 3;
    select.disabled = busy;
    note.textContent = session.summary().usedHints ? 'Эта тренировка будет считаться прохождением с подсказками.' : 'Подсказки помогут вспомнить код. Самостоятельное прохождение — без подсказок.';
  }
  select.addEventListener('change', () => { onSelect?.(select.value); render(); });
  button.addEventListener('click', () => { if (!busy) { const before = session.get(select.value).stage; const result = session.reveal(select.value); render(); if (result.stage > before) onReveal?.(result); } });
  render();
  host.hidden = false;
  return {
    select(id) { if (session.targets.some(t => t.id === id) && select.value !== id) { select.value = id; render(); } },
    setBusy(value) { busy = Boolean(value); render(); }
  };
}
