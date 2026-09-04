(() => {
  function updateSevenDayReportCount() {
    const target = document.querySelector('#reportCount7Days');
    if (!target || typeof events === 'undefined') return;

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    cutoff.setDate(cutoff.getDate() - 6);

    const count = events.filter(event => {
      const occurred = new Date(event.occurred_at);
      return occurred >= cutoff && occurred <= now;
    }).length;

    target.textContent = `${count} ${count === 1 ? 'rapport' : 'rapports'} sur les 7 derniers jours`;
  }

  function mount() {
    const currentRenderAll = window.renderAll;
    if (typeof currentRenderAll === 'function' && !window.__sevenDayCountWrapped) {
      window.__sevenDayCountWrapped = true;
      window.renderAll = function(...args) {
        const result = currentRenderAll.apply(this, args);
        updateSevenDayReportCount();
        return result;
      };
    }

    updateSevenDayReportCount();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateSevenDayReportCount();
    });
    window.addEventListener('focus', updateSevenDayReportCount);
  }

  window.updateSevenDayReportCount = updateSevenDayReportCount;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
