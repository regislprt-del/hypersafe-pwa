(() => {
  let lastDay = null;
  let midnightTimer = null;

  function refreshForNewDay(force = false) {
    if (typeof localDay !== 'function') return;
    const day = localDay();
    if (lastDay === null) {
      lastDay = day;
      return;
    }
    if (force || day !== lastDay) {
      lastDay = day;
      const app = document.getElementById('appView');
      if (app && !app.classList.contains('hidden') && typeof renderAll === 'function') {
        renderAll();
      }
    }
  }

  function scheduleMidnightRefresh() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 150);
    midnightTimer = setTimeout(() => {
      refreshForNewDay(true);
      scheduleMidnightRefresh();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function start() {
    if (typeof localDay !== 'function') {
      setTimeout(start, 100);
      return;
    }
    lastDay = localDay();
    scheduleMidnightRefresh();
    setInterval(() => refreshForNewDay(false), 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshForNewDay(false);
    });
    window.addEventListener('focus', () => refreshForNewDay(false));
  }

  start();
})();
