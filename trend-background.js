(() => {
  function applyTrendBackground() {
    const card = document.querySelector('.trend-card');
    const label = document.querySelector('#trendLabel');
    if (!card || !label) return;

    const state = (label.textContent || '').trim().toLowerCase();
    const bg = 'linear-gradient(90deg,#2563eb 0%,#0f172a 58%,#000 100%)';
    let border = '#60a5fa';
    let ink = '#60a5fa';
    let shadow = '0 6px 20px rgba(37,99,235,.22)';

    if (state === 'baisse') {
      border = '#4ade80';
      ink = '#4ade80';
      shadow = '0 6px 20px rgba(34,197,94,.22)';
    } else if (state === 'hausse') {
      border = '#f87171';
      ink = '#f87171';
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
