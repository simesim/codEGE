/* Фиксированные тесты: входные данные отдельно от ожидаемых ответов. */
export const normalizeOutput = value => value.trim().replace(/\s+/gu, ' ');
const relative = name => typeof name === 'string' && name.length > 0 && name.split('/').every(part => /^[\p{L}\p{N}_. -]+$/u.test(part) && part !== '.' && part !== '..');
export async function loadTests(config, folder, fetcher = fetch) {
  if (!Array.isArray(config.tests) || !config.tests.length) throw new Error('Нет тестов');
  const ids = new Set();
  return Promise.all(config.tests.map(async test => {
    if (!test || typeof test.id !== 'string' || !test.id || ids.has(test.id) || typeof test.expected !== 'string' || (test.stdin !== undefined && typeof test.stdin !== 'string')) throw new Error('Некорректный тест');
    ids.add(test.id);
    if (test.files !== undefined && (!test.files || typeof test.files !== 'object' || Array.isArray(test.files))) throw new Error('Некорректные файлы');
    if (test.variables !== undefined && (!test.variables || typeof test.variables !== 'object' || Array.isArray(test.variables) || Object.keys(test.variables).some(key => !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(key) || key.startsWith('__')))) throw new Error('Некорректные переменные');
    const entries = await Promise.all(Object.entries(test.files || {}).map(async ([name, spec]) => {
      if (!relative(name) || !spec || (typeof spec.text === 'string') === (typeof spec.path === 'string')) throw new Error('Некорректный тестовый файл');
      if (typeof spec.text === 'string') return [name, spec.text];
      if (!relative(spec.path) || !spec.path.startsWith('tests/')) throw new Error('Некорректный путь тестового файла');
      const response = await fetcher(new URL(spec.path.split('/').map(encodeURIComponent).join('/'), folder), { cache: 'no-cache' });
      if (!response.ok) throw new Error('Тестовый файл недоступен');
      return [name, await response.text()];
    }));
    return { id: test.id, stdin: test.stdin ?? '', expected: test.expected, files: Object.fromEntries(entries), variables: test.variables || {} };
  }));
}

export async function checkCode(client, code, tests, { onStart = () => {}, onResult = () => {} } = {}) {
  const results = [];
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    onStart(i, tests.length);
    const result = await client.run({ code, stdin: test.stdin, files: test.files, variables: test.variables });
    if (!result || typeof result.stdout !== 'string' || typeof result.stderr !== 'string') throw new Error('Некорректный ответ интерпретатора');
    const passed = !result.error && normalizeOutput(result.stdout) === normalizeOutput(test.expected);
    const item = { ...result, test, passed, index: i };
    results.push(item);
    onResult(item, results.length, tests.length);
  }
  return { results, passed: results.filter(r => r.passed).length, total: tests.length, success: results.every(r => r.passed) };
}
