/* Панель символов: работает с теми же ограничениями, что и обычная клавиатура. */
export const SYMBOLS = ['(', ')', '[', ']', '{', '}', "'", '"', ':', ',', '.', '=', '==', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', '//', '%', '**', '_', '#', '\\'];
export function mountMobileEditor(host, editor) {
  let busy = false;
  const controls = [];
  const actions = [
    ['Отступ', 'Добавить отступ', () => editor.indent('add')],
    ['− отступ', 'Уменьшить отступ', () => editor.indent('subtract')],
    ['↶', 'Отменить действие', () => editor.undo()],
    ['↷', 'Повторить действие', () => editor.redo()]
  ];
  function add(group, label, description, action, kind) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-label', description); button.title = description;
    // Не теряем выделение в CodeMirror при касании панели.
    button.addEventListener('pointerdown', event => event.preventDefault());
    button.addEventListener('click', () => { if (!busy && !button.disabled) { action(); update(); } });
    group.append(button); controls.push({button, kind});
  }
  actions.forEach(([label, desc, action], i) => add(host.querySelector('.mobile-actions'), label, desc, action, ['edit','edit','undo','redo'][i]));
  SYMBOLS.forEach(symbol => add(host.querySelector('.mobile-symbols'), symbol, `Вставить ${symbol}`, () => editor.insertSymbol(symbol), 'edit'));
  function update() {
    const history = editor.historySize();
    for (const {button,kind} of controls) button.disabled = busy || kind === 'undo' && !history.undo || kind === 'redo' && !history.redo;
  }
  update();
  return { update, setBusy(value) { busy = Boolean(value); update(); } };
}
