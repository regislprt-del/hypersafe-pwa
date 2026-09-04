(() => {
  let editingEventId = null;

  function injectStyles() {
    if (document.querySelector('#eventTimeEditStyles')) return;
    const style = document.createElement('style');
    style.id = 'eventTimeEditStyles';
    style.textContent = `
      .time-edit-btn{border:0;background:#eef2f7;color:#334155;border-radius:9px;padding:5px 8px;margin-left:7px;cursor:pointer;font-size:14px;line-height:1;vertical-align:middle}
      .time-edit-btn:active{transform:scale(.96)}
      .event-time-modal{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:18px}
      .event-time-modal.hidden{display:none!important}
      .event-time-dialog{width:min(430px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
      .event-time-dialog h3{margin:0 0 6px;font-size:21px}
      .event-time-dialog .event-time-type{font-weight:750;margin:0 0 3px}
      .event-time-dialog .event-time-date{color:#64748b;font-size:13px;margin:0 0 18px}
      .event-time-dialog label{display:grid;gap:8px;font-size:13px;font-weight:750}
      .event-time-dialog input[type=time]{font-size:20px;padding:13px}
      .event-time-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}
      .event-time-actions button{border:0;border-radius:12px;padding:11px 14px;font-weight:750;cursor:pointer}
      .event-time-cancel{background:#eef2f7;color:#334155}
      .event-time-save{background:#0f172a;color:#fff}
      .event-time-save:disabled{opacity:.55;cursor:default}
      @media(max-width:700px){.event-time-modal{align-items:flex-end;padding:10px}.event-time-dialog{border-radius:20px 20px 14px 14px;padding:20px}.time-edit-btn{padding:5px 7px;margin-left:4px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    injectStyles();
    let modal = document.querySelector('#eventTimeModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'eventTimeModal';
    modal.className = 'event-time-modal hidden';
    modal.innerHTML = `
      <div class="event-time-dialog" role="dialog" aria-modal="true" aria-labelledby="eventTimeTitle">
        <h3 id="eventTimeTitle">Modifier l’heure du rapport</h3>
        <p id="eventTimeType" class="event-time-type"></p>
        <p id="eventTimeDate" class="event-time-date"></p>
        <label>Heure réelle du rapport
          <input id="eventTimeInput" type="time" step="60" required />
        </label>
        <div class="event-time-actions">
          <button type="button" id="eventTimeCancel" class="event-time-cancel">Annuler</button>
          <button type="button" id="eventTimeSave" class="event-time-save">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeEditor();
    });
    modal.querySelector('#eventTimeCancel').addEventListener('click', closeEditor);
    modal.querySelector('#eventTimeSave').addEventListener('click', saveTime);
    return modal;
  }

  function closeEditor() {
    const modal = document.querySelector('#eventTimeModal');
    if (modal) modal.classList.add('hidden');
    editingEventId = null;
  }

  function openEditor(eventId) {
    if (typeof events === 'undefined') return;
    const event = events.find(e => e.id === eventId);
    if (!event) return toast('Rapport introuvable');

    editingEventId = eventId;
    const modal = ensureModal();
    const occurred = new Date(event.occurred_at);
    const type = typeof typeInfo === 'function' ? (typeInfo(event.kind)?.[1] || event.kind) : event.kind;
    const hh = String(occurred.getHours()).padStart(2, '0');
    const mm = String(occurred.getMinutes()).padStart(2, '0');

    modal.querySelector('#eventTimeType').textContent = type;
    modal.querySelector('#eventTimeDate').textContent = `Date : ${occurred.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}`;
    modal.querySelector('#eventTimeInput').value = `${hh}:${mm}`;
    modal.classList.remove('hidden');
    setTimeout(() => modal.querySelector('#eventTimeInput').focus(), 50);
  }

  async function saveTime() {
    if (!editingEventId || typeof events === 'undefined' || typeof sb === 'undefined') return;
    const event = events.find(e => e.id === editingEventId);
    if (!event) return closeEditor();

    const modal = ensureModal();
    const input = modal.querySelector('#eventTimeInput');
    const saveBtn = modal.querySelector('#eventTimeSave');
    const value = input.value;
    if (!/^\d{2}:\d{2}$/.test(value)) return toast('Choisis une heure valide');

    const [hour, minute] = value.split(':').map(Number);
    const [year, month, day] = String(event.event_day).split('-').map(Number);
    const changedAt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(changedAt.getTime())) return toast('Heure invalide');
    if (changedAt.getTime() > Date.now()) return toast('L’heure du rapport ne peut pas être dans le futur');

    saveBtn.disabled = true;
    try {
      const { data, error } = await sb.from('events')
        .update({ occurred_at: changedAt.toISOString() })
        .eq('id', event.id)
        .select()
        .single();

      if (error) return toast(error.message || 'Impossible de modifier l’heure');

      events = events.map(e => e.id === event.id ? data : e)
        .sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at));
      closeEditor();
      if (typeof renderAll === 'function') renderAll();
      toast('Heure du rapport modifiée');
    } finally {
      saveBtn.disabled = false;
    }
  }

  window.openEventTimeEditor = openEditor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureModal);
  else ensureModal();
})();
