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

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function eventParts(event) {
    const day = String(event?.event_day || '');
    const match = day.match(/^(\d{4})-(\d{2})-/);
    if (match) return { year: Number(match[1]), month: Number(match[2]) };
    const date = new Date(event?.occurred_at);
    if (Number.isNaN(date.getTime())) return { year: null, month: null };
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }

  function countEventsBetween(start, end) {
    const startTs = start.getTime();
    const endTs = end.getTime();
    return events.filter(event => {
      const ts = new Date(event.occurred_at).getTime();
      return Number.isFinite(ts) && ts >= startTs && ts < endTs;
    }).length;
  }

  function percentChange(current, previous) {
    if (previous === 0) return current === 0 ? '0%' : 'Nouveau';
    const value = Math.round(((current - previous) / previous) * 100);
    return `${value > 0 ? '+' : ''}${value}%`;
  }

  function renderAdvancedStats() {
    if (typeof events === 'undefined' || typeof TYPES === 'undefined') return;

    const now = new Date();
    const dayMs = 86400000;
    const start7 = new Date(now.getTime() - 7 * dayMs);
    const start14 = new Date(now.getTime() - 14 * dayMs);
    const start30 = new Date(now.getTime() - 30 * dayMs);
    const start60 = new Date(now.getTime() - 60 * dayMs);

    const count7 = countEventsBetween(start7, now);
    const previous7 = countEventsBetween(start14, start7);
    const count30 = countEventsBetween(start30, now);
    const previous30 = countEventsBetween(start60, start30);
    const dailyAverage = count30 / 30;
    const weeklyAverage = count30 * 7 / 30;

    const last30Events = events.filter(event => {
      const ts = new Date(event.occurred_at).getTime();
      return Number.isFinite(ts) && ts >= start30.getTime() && ts < now.getTime();
    });

    const typeCounts = new Map();
    last30Events.forEach(event => typeCounts.set(event.kind, (typeCounts.get(event.kind) || 0) + 1));
    let topKind = null;
    let topCount = 0;
    for (const [kind] of TYPES) {
      const count = typeCounts.get(kind) || 0;
      if (count > topCount) {
        topKind = kind;
        topCount = count;
      }
    }

    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;
    const currentYearCount = events.filter(event => eventYear(event) === currentYear).length;
    const previousYearCount = events.filter(event => eventYear(event) === previousYear).length;

    const currentMonthStart = new Date(currentYear, now.getMonth(), 1);
    const nextMonthStart = new Date(currentYear, now.getMonth() + 1, 1);
    const previousMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
    const currentMonthCount = countEventsBetween(currentMonthStart, nextMonthStart);
    const previousMonthCount = countEventsBetween(previousMonthStart, currentMonthStart);

    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value;
    };

    setText('#stats7Days', count7);
    setText('#stats30Days', count30);
    setText('#statsDailyAverage', fmt(dailyAverage));
    setText('#statsWeeklyAverage', fmt(weeklyAverage));
    setText('#statsTopType', topKind ? (typeInfo(topKind)?.[1] || topKind) : '—');
    setText('#statsTopTypeCount', topKind ? `${topCount} événement${topCount > 1 ? 's' : ''} sur 30 jours` : 'Aucun événement sur 30 jours');
    setText('#stats7DayChange', percentChange(count7, previous7));
    setText('#stats7DayChangeDetail', `${count7} vs ${previous7} événements`);
    setText('#stats30DayChange', percentChange(count30, previous30));
    setText('#stats30DayChangeDetail', `${count30} vs ${previous30} événements`);

    setText('#statsYearCompareLabel', `${currentYear} vs ${previousYear}`);
    setText('#statsYearCompare', `${currentYearCount} / ${previousYearCount}`);
    setText('#statsYearDelta', percentChange(currentYearCount, previousYearCount));

    const currentMonthName = MONTHS_FR[now.getMonth()];
    const previousMonthDate = new Date(currentYear, now.getMonth() - 1, 1);
    const previousMonthName = MONTHS_FR[previousMonthDate.getMonth()];
    setText('#statsMonthCompareLabel', `${currentMonthName} vs ${previousMonthName}`);
    setText('#statsMonthCompare', `${currentMonthCount} / ${previousMonthCount}`);
    setText('#statsMonthDelta', percentChange(currentMonthCount, previousMonthCount));

    setText('#statsRollingCompare', `${count30} / ${previous30}`);
    setText('#statsRollingDelta', percentChange(count30, previous30));
  }

  function renderHistoryFilters() {
    const yearSelect = document.querySelector('#historyFilterYear');
    const monthSelect = document.querySelector('#historyFilterMonth');
    const typeSelect = document.querySelector('#historyFilterType');
    if (!yearSelect || !monthSelect || !typeSelect || typeof events === 'undefined' || typeof TYPES === 'undefined') return;

    const selectedYear = yearSelect.value || 'all';
    const selectedMonth = monthSelect.value || 'all';
    const selectedType = typeSelect.value || 'all';

    const years = [...new Set(events.map(eventYear).filter(Number.isFinite))].sort((a, b) => b - a);
    yearSelect.innerHTML = '<option value="all">Toutes les années</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
    yearSelect.value = years.map(String).includes(selectedYear) ? selectedYear : 'all';

    monthSelect.innerHTML = '<option value="all">Tous les mois</option>' + MONTHS_FR.map((label, index) => `<option value="${index + 1}">${label}</option>`).join('');
    monthSelect.value = selectedMonth === 'all' || (Number(selectedMonth) >= 1 && Number(selectedMonth) <= 12) ? selectedMonth : 'all';

    typeSelect.innerHTML = '<option value="all">Tous les types</option>' + TYPES.map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('');
    typeSelect.value = selectedType === 'all' || TYPES.some(([kind]) => kind === selectedType) ? selectedType : 'all';
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
    renderHistoryFilters();
    renderAdvancedStats();

    const search = document.querySelector('#historySearch');
    const container = document.querySelector('#fullHistory');
    const yearSelect = document.querySelector('#historyFilterYear');
    const monthSelect = document.querySelector('#historyFilterMonth');
    const typeSelect = document.querySelector('#historyFilterType');
    if (!search || !container || typeof events === 'undefined') return;

    const q = search.value.trim().toLowerCase();
    const selectedYear = yearSelect?.value || 'all';
    const selectedMonth = monthSelect?.value || 'all';
    const selectedType = typeSelect?.value || 'all';

    let arr = [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

    if (selectedYear !== 'all') {
      arr = arr.filter(event => eventParts(event).year === Number(selectedYear));
    }
    if (selectedMonth !== 'all') {
      arr = arr.filter(event => eventParts(event).month === Number(selectedMonth));
    }
    if (selectedType !== 'all') {
      arr = arr.filter(event => event.kind === selectedType);
    }
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

  ['#historyFilterYear', '#historyFilterMonth', '#historyFilterType'].forEach(selector => {
    const element = document.querySelector(selector);
    if (element) element.onchange = renderLimitedHistory;
  });

  const statsYear = document.querySelector('#historyStatsYear');
  if (statsYear) statsYear.onchange = renderHistoryTypeStats;

  const pastAddButton = document.querySelector('#historyPastAddBtn');
  if (pastAddButton) pastAddButton.onclick = addPastHistoryEvent;

  const loadMore = document.querySelector('#loadMore');
  if (loadMore) loadMore.style.display = 'none';

  setPastEventDefaults();
  renderLimitedHistory();
})();
