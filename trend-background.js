(() => {
  function applyTrendBackground() {
    const card = document.querySelector('.trend-card');
    const label = document.querySelector('#trendLabel');
    if (!card || !label) return;

    const state = (label.textContent || '').trim().toLowerCase();
    let bg = '#dbeafe';
    let border = '#93c5fd';
    let ink = '#1e3a8a';

    if (state === 'baisse') {
      bg = '#dcfce7';
      border = '#86efac';
      ink = '#166534';
    } else if (state === 'hausse') {
      bg = '#fee2e2';
      border = '#fca5a5';
      ink = '#991b1b';
    }

    card.style.background = bg;
    card.style.borderColor = border;
    card.style.color = ink;
    const title = card.querySelector(':scope > span');
    const arrow = document.querySelector('#trendArrow');
    const value = document.querySelector('#trendValue');
    if (title) title.style.color = ink;
    if (arrow) arrow.style.color = ink;
    label.style.color = ink;
    if (value) value.style.color = ink;
  }

  function mount() {
    const originalRenderRate = window.renderRate;
    if (typeof originalRenderRate === 'function' && !window.__trendBackgroundWrapped) {
      window.__trendBackgroundWrapped = true;
      window.renderRate = function(...args) {
        const result = originalRenderRate.apply(this, args);
        applyTrendBackground();
        return result;
      };
    }
    applyTrendBackground();
    setInterval(applyTrendBackground, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
