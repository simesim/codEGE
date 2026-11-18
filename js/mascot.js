/* Маскот реагирует на состояние тренировки, не подсказывая ответ. */
export const MASCOT_REACTIONS = Object.freeze({
  idle: { text: 'Можно начинать.', image: 'owl.png' },
  loading: { text: 'Загружаем Python. Пока можно писать код.', image: 'owl-spin.gif' },
  ready: { text: 'Готова проверить твой код.', image: 'owl.png' },
  hint: { text: 'Подсказка открыта. Попробуй продолжить самостоятельно.', image: 'owl.png' },
  checking: { text: 'Проверяю решение…', image: 'owl-spin.gif' },
  error: { text: 'Проверь результаты в консоли и попробуй ещё раз.', image: 'owl.png' },
  unavailable: { text: 'Python не загрузился. Написанный код остаётся в редакторе.', image: 'owl.png' },
  success: { text: 'Отлично! Все тесты пройдены.', image: 'owl.png' }
});
export function mountMascot(host) {
  const image = host.querySelector('img');
  const message = host.querySelector('[data-mascot-message]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle';
  function render() {
    const reaction = MASCOT_REACTIONS[state];
    const file = motion.matches ? 'owl.png' : reaction.image;
    const url = new URL(`../assets/mascot/${file}`, import.meta.url).href;
    if (image.src !== url) image.src = url;
    host.dataset.state = state;
    message.textContent = reaction.text;
  }
  motion.addEventListener?.('change', render);
  render();
  return { set(next) { if (!Object.hasOwn(MASCOT_REACTIONS, next)) throw new Error('Неизвестная реакция'); state = next; render(); }, get state() { return state; } };
}
