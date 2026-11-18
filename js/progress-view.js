/* Общий вид прогресса в каталоге и теории. */
import { LEVELS } from './difficulty.js';
import { getStatus } from './progress.js';
export function paintProgress(host, record, { showLevels = true } = {}) {
  const status = document.createElement('span');
  status.className = 'mastery-status';
  const levels = document.createElement('div'); levels.className = 'passed-levels';
  levels.setAttribute('aria-label','Пройденные уровни сложности');
  if (record) {
    const state = getStatus(record);
    status.dataset.state = state.key; status.textContent = state.label;
    for (const level of LEVELS) {
      const chip = document.createElement('span'); const passed = record.passedLevels.includes(level);
      chip.className = 'passed-level' + (passed ? ' is-passed' : '');
      chip.textContent = `${level}%${passed ? ' ✓' : ''}`;
      chip.setAttribute('aria-label', `${level}% — ${passed ? 'пройден' : 'не пройден'}`);
      levels.append(chip);
    }
  } else { status.textContent = 'Прогресс недоступен'; }
  host.replaceChildren(status);
  if (showLevels && record) host.append(levels);
}
