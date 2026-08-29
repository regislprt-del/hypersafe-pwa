window.APP_CONFIG = {
  SUPABASE_URL: "https://vfdslxlczrrwbyqsotdj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_EVAwKv1SEK62Ptol28GJjw_4oROqpDG"
};

document.addEventListener('DOMContentLoaded', () => {
  const loadOnce = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, 'true');
    document.body.appendChild(script);
  };

  loadOnce('./manual-adjust.js?v=3', 'data-hypersafe-manual-adjust');
  loadOnce('./reset-control.js?v=1', 'data-hypersafe-reset-control');
});
