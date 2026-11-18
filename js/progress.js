/* Только агрегированные результаты завершённых тренировок, отдельно для каждого шаблона. */
import { LEVELS } from './difficulty.js';
// localStorage разделяется по origin, но не по пути. Изолируем разные репозитории Pages.
export const PROGRESS_PREFIX = `codege:progress:v1:${new URL('../', import.meta.url).pathname}:`;
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
export const emptyProgress = () => ({ passedLevels: [], independent100: 0, last: null });
export function normalizeProgress(record) {
  if (!record || !Array.isArray(record.passedLevels) || record.passedLevels.some(n => !LEVELS.includes(n)) || !Number.isInteger(record.independent100) || record.independent100 < 0 || record.independent100 > 3) throw Error('Некорректный прогресс');
  const passedLevels = LEVELS.filter(n => record.passedLevels.includes(n));
  const last = record.last;
  if ((passedLevels.length === 0 && last !== null) || (passedLevels.length > 0 && (!last || !passedLevels.includes(last.level) || typeof last.usedHints !== 'boolean')) || (record.independent100 > 0 && !passedLevels.includes(100))) throw Error('Некорректный прогресс');
  return { passedLevels, independent100: record.independent100, last: last ? {level:last.level, usedHints:last.usedHints} : null };
}
export function getStatus(record) {
  if (record.independent100 >= 3) return { key:'mastered', label:'Освоен' };
  if (record.independent100 > 0) return { key:'consolidating', label:'Закрепляется' };
  return record.passedLevels.length ? { key:'learning', label:'Изучается' } : {key:'new', label:'Не изучен'};
}
export function recommend(record) {
  if (getStatus(record).key === 'mastered') return null;
  if (!record.last) return 15;
  const {level, usedHints} = record.last;
  return usedHints ? level : LEVELS[Math.min(LEVELS.indexOf(level)+1,LEVELS.length-1)];
}
export function applyCompletion(record, result) {
  if (!result || !validId(result.id) || !LEVELS.includes(result.level) || !Number.isInteger(result.total) || result.total < 1 || result.passed !== result.total || typeof result.usedHints !== 'boolean' || !Number.isInteger(result.hintCount) || result.hintCount < 0 || result.usedHints !== (result.hintCount > 0)) throw Error('Завершённый результат некорректен');
  return { passedLevels:LEVELS.filter(n => n === result.level || record.passedLevels.includes(n)), independent100:Math.min(3,record.independent100 + Number(result.level === 100 && !result.usedHints)), last:{level:result.level, usedHints:result.usedHints} };
}
export function createProgressStore(storageProvider = () => globalThis.localStorage, prefix = PROGRESS_PREFIX) {
  function key(id) { if (!validId(id)) throw Error('Некорректный ID'); return prefix + id; }
  function read(id) { const raw = storageProvider().getItem(key(id)); return raw === null ? emptyProgress() : normalizeProgress(JSON.parse(raw)); }
  return {
    read,
    save(result) {
      const storage = storageProvider();
      const next = applyCompletion(read(result.id),result);
      storage.setItem(key(result.id),JSON.stringify(next));
      return next;
    },
    reset(id) { storageProvider().removeItem(key(id)); },
    resetAll() {
      const storage = storageProvider();
      const keys = [];
      for (let i=0;i<storage.length;i++) { const k = storage.key(i); if (k?.startsWith(prefix) && validId(k.slice(prefix.length))) keys.push(k); }
      for (const k of keys) storage.removeItem(k);
    },
    hasAny() {
      const storage = storageProvider();
      for (let i=0;i<storage.length;i++) { const k=storage.key(i); if (k?.startsWith(prefix) && validId(k.slice(prefix.length))) return true; }
      return false;
    }
  };
}
export const progress = createProgressStore();
