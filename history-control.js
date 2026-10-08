(() => {
  async function deleteHistoryEvent(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const name = typeInfo(event.kind)?.[1] || event.kind;
    const when = new Date(event.occurred_at).toLocaleString('fr-FR', {
      day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'
    });

    if (!window.confirm(`Supprimer “${name}” du ${when} ?`)) return;

    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) return toast(error.message);

    events = events.filter(e => e.id !== id);
    toast('Événement supprimé');
    renderAll();
  }

  function eventYear(event) {
    const day = String(event?.event_day || '');
    if (/^\d{4}-/.test(day)) return Number(day.slice(0, 4));
    const date = new Date(event?.occurred_at);
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }

  function renderHistoryTypeStats() {
    const select = document.querySelector('#historyStatsYear');
    const container = document.querySelector('#historyTypeStats');
    if (!select || !container || typeof events === 'undefined' || typeof TYPES === 'undefined') return;

    const currentYear = new Date().getFullYear();
    const years = [...new Set([
      currentYear,
      ...events.map(eventYear).filter(Number.isFinite)
    ])].sort((a, b) => b - a);

    const previousSelection = Number(select.value);
    const selectedYear = years.includes(previousSelection) ? previousSelection : currentYear;

    select.innerHTML = years.map(year => `<option value="${year}"${year === selectedYear ? ' selected' : ''}>${year}</option>`).join('');

    const counts = new Map();
    for (const event of events) {
      if (eventYear(event) !== selectedYear) continue;
      counts.set(event.kind, (counts.get(event.kind) || 0) + 1);
    }

    container.innerHTML = TYPES.map(([kind, label]) => `
      <div class="history-type-stat">
        <span>${label}</span>
        <strong>${counts.get(kind) || 0}</strong>
      </div>
    `).join('');
  }

  function renderLimitedHistory() {
    const search = document.querySelector('#historySearch');
    const container = document.querySelector('#fullHistory');
    if (!search || !container || typeof events === 'undefined') return;

    const q = search.value.trim().toLowerCase();
    let arr = [...events]
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 300);

    if (q) {
      arr = arr.filter(e => (typeInfo(e.kind)?.[1] || '').toLowerCase().includes(q));
    }

    renderHistoryTypeStats();

    arr = arr.slice(0, 20);
    container.innerHTML = arr.map(e => `<div class="history-item"><span>${new Date(e.occurred_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}<button class="time-edit-btn" type="button" title="Modifier l’heure" aria-label="Modifier l’heure du rapport" onclick="window.openEventTimeEditor('${e.id}')">🕒</button></span><strong>${typeInfo(e.kind)?.[1]||e.kind}</strong><span class="rate">${fmt(resultRateForEvent(e))}</span><button class="history-delete-btn" type="button" title="Supprimer l’événement" aria-label="Supprimer l’événement" onclick="window.deleteHistoryEvent('${e.id}')">🗑️</button></div>`).join('') || '<p class="muted">Aucun résultat.</p>';
  }

  window.renderHistory = renderLimitedHistory;
  window.deleteHistoryEvent = deleteHistoryEvent;
  historyLimit = 20;

  const search = document.querySelector('#historySearch');
  if (search) search.oninput = renderLimitedHistory;

  const statsYear = document.querySelector('#historyStatsYear');
  if (statsYear) statsYear.onchange = renderHistoryTypeStats;

  const loadMore = document.querySelector('#loadMore');
  if (loadMore) loadMore.style.display = 'none';

  renderLimitedHistory();
})();
