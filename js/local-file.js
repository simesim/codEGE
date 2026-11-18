/* Браузеры блокируют fetch локальных файлов. Не оставляем бесконечную загрузку. */
if (location.protocol === 'file:') {
  const status = document.querySelector('#catalog-status, #theory-status, #trainer-status');
  if (status) status.textContent = 'Задания доступны при открытии сайта по веб-адресу.';
  document.querySelector('#task-grid, #theory-content, #trainer-content')?.setAttribute('aria-busy', 'false');
}
