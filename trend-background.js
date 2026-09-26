(() => {
  function applyTrendBackground() {
    const card = document.querySelector('.trend-card');
    const label = document.querySelector('#trendLabel');
    if (!card || !label) return;

    const state = (label.textContent || '').trim().toLowerCase();
    let bg = 'linear-gradient(135deg,#2563eb,#1e3a8a)';
    let border = '#60a5fa';
    let shadow = '0 6px 20px rgba(37,99,235,.22)';

    if (state === 'baisse') {
      bg = 'linear-gradient(135deg,#22c55e,#166534)';
      border = '#4ade80';
      shadow = '0 6px 20px rgba(34,197,94,.22)';
    } else if (state === 'hausse') {
      bg = 'linear-gradient(135deg,#ef4444,#991b1b)';
      border = '#f87171';
      shadow = '0 6px 20px rgba(239,68,68,.22)';
    }

    card.style.background = bg;
    card.style.borderColor = border;
    card.style.boxShadow = shadow;
    card.style.color = '#fff';
    const title = card.querySelector(':scope > span');
    const arrow = document.querySelector('#trendArrow');
    const value = document.querySelector('#trendValue');
    if (title) title.style.color = '#fff';
    if (arrow) arrow.style.color = '#fff';
    label.style.color = '#fff';
    if (value) value.style.color = '#fff';
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
