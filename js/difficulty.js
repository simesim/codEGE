/* Общая конфигурация уровней, которую позднее использует тренажёр. */
export const LEVELS = Object.freeze([15, 30, 50, 75, 100]);
const descriptions = {
  15: 'Вспомни отдельные команды, операторы и значения.',
  30: 'Восстанови пропущенные выражения и команды.',
  50: 'Восстанови целые строки и более сложные выражения.',
  75: 'Восстанови большие блоки. Можно редактировать весь код.',
  100: 'Напиши весь шаблон с нуля, без готового кода.'
};

export function renderDifficulty(grid, description, initialLevel = 15, { recommended = null, passedLevels = [] } = {}) {
  let selected = LEVELS.includes(initialLevel) ? initialLevel : LEVELS[0];
  const fragment = document.createDocumentFragment();
  for (const level of LEVELS) {
    const label = document.createElement('label');
    label.className = 'difficulty-option';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'difficulty'; input.value = level;
    input.checked = level === selected;
    const text = document.createElement('span');
    text.className = 'difficulty-value'; text.textContent = `${level}%`;
    const caption = document.createElement('small');
    caption.textContent = level === 100 ? 'С нуля' : 'Пропуски';
    label.append(input, text, caption);
    if (passedLevels.includes(level)) {
      const passed = document.createElement('small'); passed.className = 'difficulty-passed'; passed.textContent = 'Пройден ✓'; label.append(passed);
    }
    if (recommended === level) label.classList.add('is-recommended');
    input.addEventListener('change', () => {
      if (!input.checked) return;
      selected = level;
      description.textContent = descriptions[selected];
    });
    fragment.append(label);
  }
  grid.replaceChildren(fragment);
  description.textContent = descriptions[selected];
  return { get selectedLevel() { return selected; } };
}
