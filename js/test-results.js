const hints = {
  SyntaxError: 'Проверь синтаксис: двоеточия, скобки, кавычки и операторы.',
  IndentationError: 'Проверь отступы внутри циклов, условий и функций.',
  TabError: 'Не смешивай табуляцию и пробелы в отступах.',
  NameError: 'Проверь, объявлена ли переменная или функция и правильно ли написано её имя.',
  TypeError: 'Проверь типы значений и аргументы функции.',
  ValueError: 'Проверь формат значения, которое передаётся функции.',
  IndexError: 'Индекс вышел за границы последовательности.',
  KeyError: 'Такого ключа нет в словаре.',
  ZeroDivisionError: 'Проверь, не равен ли делитель нулю.',
  FileNotFoundError: 'Проверь имя файла из условия задания.',
  EOFError: 'Программа запросила больше входных данных, чем было предоставлено.',
  RecursionError: 'Проверь условие завершения рекурсии.',
  ImportError: 'Проверь название библиотеки и импортируемого элемента.',
  ModuleNotFoundError: 'Проверь название модуля. Доступна стандартная библиотека Python в Pyodide.',
  Timeout: 'Проверь условие завершения цикла и количество вычислений.',
  OutputLimit: 'Слишком много данных в консоли. Проверь, что выводишь только нужный результат.',
  MemoryError: 'Программа использует слишком много памяти.'
};
const element = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
function addText(parent, label, value) {
  const group = element('div', undefined, 'test-value');
  group.append(element('span', label), element('pre', value.length > 1500 ? value.slice(0, 1500) + '\n… (показано начало)' : value || '(пусто)'));
  parent.append(group);
}
export function renderTest(parent, result) {
  const { test, index, passed, stdout, stderr, error } = result;
  const card = element('details', undefined, 'test-row ' + (passed ? 'test-pass' : 'test-fail'));
  card.open = !passed && !parent.querySelector('.test-fail');
  const head = element('summary'); head.append(element('span', `Тест ${index + 1}`), element('strong', passed ? 'Пройден' : 'Не пройден'));
  const content = element('div', undefined, 'test-detail');
  if (test.stdin) addText(content, 'Ввод', test.stdin);
  for (const [name, text] of Object.entries(test.files)) addText(content, `${name} · ${text.length} симв.`, text);
  if (Object.keys(test.variables).length) addText(content, 'Переменные', JSON.stringify(test.variables, null, 2));
  if (!test.stdin && !Object.keys(test.files).length && !Object.keys(test.variables).length) content.append(element('p', 'Данные заданы в программе.'));
  addText(content, 'Ожидалось', test.expected); addText(content, 'Получено', stdout);
  if (stderr) addText(content, 'Диагностика', stderr);
  if (error) {
    const message = element('div', undefined, 'test-error');
    message.append(element('strong', `${error.type}${error.line ? ` · строка ${error.line}` : ''}`), element('pre', error.message), element('p', hints[error.type] || 'Проверь указанную строку и логику программы.'));
    content.append(message);
  }
  card.append(head, content); parent.append(card);
}
