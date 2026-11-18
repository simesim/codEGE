/* Загрузка и проверка учебных данных. Пути относительно модуля, в том числе на GitHub Pages. */
const dataRoot = new URL('../data/', import.meta.url);

async function fetchFile(url, kind = 'json') {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return kind === 'json' ? response.json() : response.text();
}

const isText = value => typeof value === 'string' && value.trim().length > 0;
const isId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
const isPath = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value);

export function validateCatalog(data) {
  if (!data || !Array.isArray(data.tasks)) throw new Error('Некорректный каталог');
  const numbers = new Set();
  const ids = new Set();
  for (const task of data.tasks) {
    if (!task || !Number.isInteger(task.number) || task.number < 1 || numbers.has(task.number) || !isText(task.title) || !Array.isArray(task.templates)) {
      throw new Error('Некорректный раздел каталога');
    }
    numbers.add(task.number);
    for (const template of task.templates) {
      if (!template || !isId(template.id) || ids.has(template.id) || !isText(template.title) || !isPath(template.path)) {
        throw new Error('Некорректный шаблон каталога');
      }
      ids.add(template.id);
    }
  }
  return data;
}

export async function loadCatalog() {
  return validateCatalog(await fetchFile(new URL('catalog.json', dataRoot)));
}

export function findTemplate(catalog, id) {
  for (const task of catalog.tasks) {
    const template = task.templates.find(item => item.id === id);
    if (template) return { task, template };
  }
  return null;
}

export async function loadTemplate(id) {
  const catalog = await loadCatalog();
  const match = findTemplate(catalog, id);
  if (!match) return null;
  const { task, template } = match;
  const folder = new URL(`${template.path}/`, dataRoot);
  const [config, code] = await Promise.all([
    fetchFile(new URL('config.json', folder)),
    fetchFile(new URL('template.py', folder), 'text')
  ]);
  if (!config || config.id !== template.id || config.task !== task.number || config.title !== template.title || !isText(config.condition) || !Array.isArray(config.explanations) || !isText(code)) {
    throw new Error('Несогласованные данные шаблона');
  }
  return { task, template, config, code, folder };
}
