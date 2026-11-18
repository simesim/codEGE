/* Общий модуль: календарный отсчёт до 1 июня. */
function daysUntilJuneFirst(today = new Date()) {
  // Считаем календарные дни, независимо от перехода на летнее время.
  const day = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  let target = Date.UTC(today.getFullYear(), 5, 1);
  if (day > target) target = Date.UTC(today.getFullYear() + 1, 5, 1);
  return (target - day) / 86400000;
}

function updateExamCountdown() {
  const counter = document.querySelector('#days-counter');
  if (counter) counter.textContent = String(daysUntilJuneFirst());
}
updateExamCountdown();
setInterval(updateExamCountdown, 60000);
document.addEventListener('visibilitychange', updateExamCountdown);
