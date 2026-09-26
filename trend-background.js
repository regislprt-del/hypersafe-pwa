(() => {
  function applyTrendBackground() {
    const card = document.querySelector('.trend-card');
    const label = document.querySelector('#trendLabel');
    if (!card || !label) return;

    const state = (label.textContent || '').trim().toLowerCase();
    let bg = '#60a5fa';
    let border = '#3b82f6';
    let shadow = '0 6px 20px rgba(37,99,235,.10)';

    if (state === 'baisse') {
      bg = '#4ade80';
      border = '#22c55e';
      shadow = '0 6px 20px rgba(34,197,94,.10)';
    } else if (state === 'hausse') {
      bg = '#f87171';
      border = '#ef4444';
      shadow = '0 6px 20px rgba(239,68,68,.10)';
    }

    card.style.background = bg;
    card.style.borderColor = border;
    card.style.boxShadow = shadow;
    card.style.color = '#0f172a';
    const title = card.querySelector(':scope > span');
    const arrow = document.querySelector('#trendArrow');
    const value = document.querySelector('#trendValue');
    if (title) title.style.color = '#0f172a';
    if (arrow) arrow.style.color = '#0f172a';
    label.style.color = '#0f172a';
    if (value) value.style.color = '#0f172a';
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
