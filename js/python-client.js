/* Время загрузки интерпретатора и время исполнения измеряются отдельно. */
export const TEST_TIMEOUT = 10_000;
export const LOAD_TIMEOUT = 120_000;
export class PythonClient {
  constructor({ createWorker = () => new Worker(new URL('./python.worker.js', import.meta.url)), testTimeout = TEST_TIMEOUT, loadTimeout = LOAD_TIMEOUT } = {}) {
    this.createWorker = createWorker;
    this.testTimeout = testTimeout;
    this.loadTimeout = loadTimeout;
    this.serial = 0;
  }
  stop() {
    const worker = this.worker;
    this.worker = null;
    this.ready = false;
    this.loading = null;
    worker?.terminate();
  }
  prepare() {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    let worker;
    try { worker = this.createWorker(); } catch (error) { return Promise.reject(error); }
    this.worker = worker;
    this.loading = new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        if (error) { this.stop(); reject(error); }
        else { this.ready = true; this.loading = null; resolve(); }
      };
      const timer = setTimeout(() => finish(new Error('Загрузка Python заняла слишком много времени')), this.loadTimeout);
      worker.onmessage = ({ data }) => {
        if (data?.type === 'ready') finish();
        if (data?.type === 'boot-error') finish(new Error(data.message));
      };
      worker.onerror = worker.onmessageerror = () => finish(new Error('Не удалось загрузить Python'));
    });
    return this.loading;
  }
  async run(payload) {
    await this.prepare();
    if (this.running) throw new Error('Проверка уже выполняется');
    this.running = true;
    const worker = this.worker;
    const requestId = ++this.serial;
    return new Promise((resolve, reject) => {
      const finish = (result, error, discard = false) => {
        clearTimeout(timer);
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        this.running = false;
        if (discard) this.stop();
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => finish({ stdout: '', stderr: '', error: { type: 'Timeout', message: 'Превышен лимит 10 секунд', line: null } }, null, true), this.testTimeout);
      worker.onmessage = ({ data }) => {
        if (data?.requestId !== requestId) return;
        if (data.type === 'result') finish(data.result);
        if (data.type === 'execution-error') finish(null, new Error(data.message), true);
      };
      worker.onerror = worker.onmessageerror = () => finish(null, new Error('Ошибка интерпретатора'), true);
      try { worker.postMessage({ type: 'run', requestId, payload }); }
      catch (error) { finish(null, error, true); }
    });
  }
}
