/* Отдельный поток: тяжёлые вычисления не останавливают интерфейс. */
const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.28.2/full/';
let runtime, runTest, busy = false;
async function boot() {
  try {
    importScripts(`${CDN}pyodide.js`);
    runtime = await loadPyodide({ indexURL: CDN });
    const response = await fetch(new URL('python-runner.py', self.location.href));
    if (!response.ok) throw new Error('Не удалось загрузить обработчик');
    runtime.runPython(await response.text());
    runTest = runtime.globals.get('run_test');
    self.postMessage({ type: 'ready' });
  } catch (error) {
    self.postMessage({ type: 'boot-error', message: String(error) });
  }
}
self.onmessage = event => {
  const { type, requestId, payload } = event.data || {};
  if (type !== 'run' || !runTest || busy) return;
  busy = true;
  try {
    const result = JSON.parse(runTest(JSON.stringify(payload)));
    self.postMessage({ type: 'result', requestId, result });
  } catch (error) {
    self.postMessage({ type: 'execution-error', requestId, message: String(error).slice(0, 2000) });
  } finally { busy = false; }
};
boot();
