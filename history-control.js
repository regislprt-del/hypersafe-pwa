(() => {
  function setPastEventDefaults() {
    const typeSelect = document.querySelector('#historyPastType');
    const dateInput = document.querySelector('#historyPastDate');
    const timeInput = document.querySelector('#historyPastTime');
    if (!typeSelect || !dateInput || !timeInput || typeof TYPES === 'undefined') return;

    if (!typeSelect.options.length) {
      typeSelect.innerHTML = TYPES.map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('');
    }

    const now = new Date();
    dateInput.max = localDay(now);

    if (!dateInput.value) {
      const previousDay = new Date(now);
      previousDay.setDate(previousDay.getDate() - 1);
      dateInput.value = localDay(previousDay);
    }

    if (!timeInput.value) {
      timeInput.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
  }

  async function addPastHistoryEvent() {
    const typeSelect = document.querySelector('#historyPastType');
    const dateInput = document.querySelector('#historyPastDate');
    const timeInput = document.querySelector('#historyPastTime');
    const button = document.querySelector('#historyPastAddBtn');
    if (!typeSelect || !dateInput || !timeInput || !button) return;
    if (!sb || !session?.user?.id || !profile?.couple_id) return toast('Connexion requise');

    const kind = typeSelect.value;
    const day = dateInput.value;
    const time = timeInput.value;

    if (!TYPES.some(([value]) => value === kind) || !day || !time) {
      return toast('Choisis le type, la date et l’heure');
    }

    const occurredAt = new Date(`${day}T${time}:00`);
    if (Number.isNaN(occurredAt.getTime())) return toast('Date ou heure invalide');
    if (occurredAt.getTime() > Date.now()) return toast('La date et l’heure doivent être dans le passé');

    button.disabled = true;
    button.textContent = 'Ajout…';

    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const usedSlots = new Set(
          events
            .filter(e => e.event_day === day && e.kind === kind)
            .map(e => Number(e.slot_no))
        );
        const slot = [1, 2, 3].find(value => !usedSlots.has(value));

        if (!slot) {
          toast('3 rapports de ce type sont déjà enregistrés à cette date');
          return;
        }

        const { data, error } = await sb
          .from('events')
          .insert({
            couple_id: profile.couple_id,
            event_day: day,
            kind,
            slot_no: slot,
            occurred_at: occurredAt.toISOString(),
            created_by: session.user.id
          })
          .select()
          .single();

        if (error?.code === '23505' && attempt === 0) {
          await loadAll();
          continue;
        }

        if (error) {
          toast(error.message);
          return;
        }

        if (data && !events.some(e => e.id === data.id)) {
          events.push(data);
          events.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
        }

        if (data?.id && typeof window.notifyPartnerOfChange === 'function') {
          window.notifyPartnerOfChange('events', data.id);
        }

        toast('Rapport passé ajouté');
        renderAll();
        return;
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Ajouter le rapport';
    }
  }

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

  async function changeHistoryEventType(id, newKind) {
    const event = events.find(e => e.id === id);
    if (!event || event.kind === newKind) return;

    if (!TYPES.some(([kind]) => kind === newKind)) {
      toast('Type de rapport invalide');
      renderHistory();
      return;
    }

    const usedSlots = new Set(
      events
        .filter(e => e.id !== id && e.event_day === event.event_day && e.kind === newKind)
        .map(e => Number(e.slot_no))
    );

    let targetSlot = Number(event.slot_no);
    if (usedSlots.has(targetSlot)) {
      targetSlot = [1, 2, 3].find(slot => !usedSlots.has(slot));
    }

    if (!targetSlot) {
      toast('3 rapports de ce type sont déjà enregistrés ce jour-là');
      renderHistory();
      return;
    }

    const { data, error } = await sb
      .from('events')
      .update({ kind: newKind, slot_no: targetSlot })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast(error.code === '23505' ? '3 rapports de ce type sont déjà enregistrés ce jour-là' : error.message);
      renderHistory();
      return;
    }

    const index = events.findIndex(e => e.id === id);
    if (index !== -1) events[index] = data;

    toast('Type de rapport modifié');
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
    setPastEventDefaults();
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
    container.innerHTML = arr.map(e => {
      const typeOptions = TYPES.map(([kind, label]) => `<option value="${kind}"${kind === e.kind ? ' selected' : ''}>${label}</option>`).join('');
      return `<div class="history-item"><span>${new Date(e.occurred_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}<button class="time-edit-btn" type="button" title="Modifier l’heure" aria-label="Modifier l’heure du rapport" onclick="window.openEventTimeEditor('${e.id}')">🕒</button></span><select class="history-type-select" aria-label="Modifier le type de rapport" title="Modifier le type de rapport" onchange="window.changeHistoryEventType('${e.id}', this.value)">${typeOptions}</select><span class="rate">${fmt(resultRateForEvent(e))}</span><button class="history-delete-btn" type="button" title="Supprimer l’événement" aria-label="Supprimer l’événement" onclick="window.deleteHistoryEvent('${e.id}')">🗑️</button></div>`;
    }).join('') || '<p class="muted">Aucun résultat.</p>';
  }

  window.renderHistory = renderLimitedHistory;
  window.deleteHistoryEvent = deleteHistoryEvent;
  window.changeHistoryEventType = changeHistoryEventType;
  historyLimit = 20;

  const search = document.querySelector('#historySearch');
  if (search) search.oninput = renderLimitedHistory;

  const statsYear = document.querySelector('#historyStatsYear');
  if (statsYear) statsYear.onchange = renderHistoryTypeStats;

  const pastAddButton = document.querySelector('#historyPastAddBtn');
  if (pastAddButton) pastAddButton.onclick = addPastHistoryEvent;

  const loadMore = document.querySelector('#loadMore');
  if (loadMore) loadMore.style.display = 'none';

  setPastEventDefaults();
  renderLimitedHistory();
})();
