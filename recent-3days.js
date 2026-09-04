(() => {
  function localStartOfDay(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function renderRecentThreeDays() {
    const body = document.querySelector('#recentBody');
    if (!body || typeof events === 'undefined') return;

    const cutoff = localStartOfDay();
    cutoff.setDate(cutoff.getDate() - 2);

    const arr = [...events]
      .filter(e => new Date(e.occurred_at) >= cutoff)
      .sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at));

    body.innerHTML = arr.map(e => `<tr><td>${new Date(e.occurred_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}<button class="time-edit-btn" type="button" title="Modifier l’heure" aria-label="Modifier l’heure du rapport" onclick="window.openEventTimeEditor('${e.id}')">🕒</button></td><td>${typeInfo(e.kind)?.[1]||e.kind}</td><td>${fmt(resultRateForEvent(e))}</td></tr>`).join('') || '<tr><td colspan="3">Aucun événement sur les 3 derniers jours</td></tr>';
  }

  function mount() {
    if (typeof window.renderRecent === 'function') window.renderRecent = renderRecentThreeDays;
    renderRecentThreeDays();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
