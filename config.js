window.APP_CONFIG = {
  SUPABASE_URL: "https://vfdslxlczrrwbyqsotdj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_EVAwKv1SEK62Ptol28GJjw_4oROqpDG"
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('script[data-hypersafe-manual-adjust]')) return;
  const script = document.createElement('script');
  script.src = './manual-adjust.js?v=2';
  script.dataset.hypersafeManualAdjust = 'true';
  document.body.appendChild(script);
});
