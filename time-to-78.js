(() => {
  function formatRemaining(ms) {
    const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days} j`);
    if (hours || days) parts.push(`${hours} h`);
    parts.push(`${minutes} min`);
    return parts.join(' ');
  }

  function updateTimeTo78() {
    const target = document.querySelector('#timeTo78');
    if (!target || typeof anchors === 'undefined' || typeof events === 'undefined' || typeof currentRate !== 'function' || typeof anchorFor !== 'function') return;

    const now = new Date();
    const rate = currentRate(now);

    if (!anchors.length || anchorFor(now) === null) {
      target.innerHTML = '<span class="time-to-78-label">Temps restant avant le taux maximum</span><span class="time-to-78-value">—</span>';
      return;
    }

    if (rate >= 78) {
      target.innerHTML = '<span class="time-to-78-label">Taux 78 atteint</span>';
      return;
    }

    const anchor = anchorFor(now);
    const anchorAt = new Date(anchor.anchor_at);
    let cursor = anchorAt;

    const relevant = events
      .filter(e => {
        const d = new Date(e.occurred_at);
        return d >= anchorAt && d <= now;
      })
      .sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at));

    if (relevant.length) cursor = new Date(relevant[relevant.length - 1].occurred_at);

    const incrementsNeeded = Math.max(1, Math.ceil(78 - rate - 1e-9));
    const elapsed = Math.max(0, now.getTime() - cursor.getTime());
    const completedHours = Math.floor(elapsed / 3600000);
    const nextIncrementAt = cursor.getTime() + (completedHours + 1) * 3600000;
    const targetAt = nextIncrementAt + (incrementsNeeded - 1) * 3600000;
    const remaining = Math.max(0, targetAt - now.getTime());

    target.innerHTML = `<span class="time-to-78-label">Temps restant avant le taux maximum</span><span class="time-to-78-value">${formatRemaining(remaining)}</span>`;
  }

  function injectStyle() {
    if (document.querySelector('#timeTo78Style')) return;
    const style = document.createElement('style');
    style.id = 'timeTo78Style';
    style.textContent = `
      .time-to-78{
        margin:12px 0 0;
        padding:12px 14px;
        border:1px solid #1e3a8a;
        border-radius:14px;
        background:linear-gradient(90deg,#2563eb 0%,#0f172a 58%,#000 100%);
        color:#fff;
        font-size:16px;
        font-weight:700;
        text-align:center;
        box-shadow:0 4px 14px rgba(15,23,42,.22)
      }
      .time-to-78-label{
        display:block;
        font-size:16px;
        line-height:1.2
      }
      .time-to-78-value{
        display:block;
        margin-top:5px;
        font-size:24px;
        line-height:1.1;
        font-weight:800
      }
    `;
    document.head.appendChild(style);
  }

  function mount() {
    injectStyle();

    const currentRenderAll = window.renderAll;
    if (typeof currentRenderAll === 'function' && !window.__timeTo78Wrapped) {
      window.__timeTo78Wrapped = true;
      window.renderAll = function(...args) {
        const result = currentRenderAll.apply(this, args);
        updateTimeTo78();
        return result;
      };
    }

    updateTimeTo78();
    setInterval(updateTimeTo78, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateTimeTo78();
    });
    window.addEventListener('focus', updateTimeTo78);
  }

  window.updateTimeTo78 = updateTimeTo78;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
