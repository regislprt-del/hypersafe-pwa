window.APP_CONFIG = {
  SUPABASE_URL: "https://vfdslxlczrrwbyqsotdj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_EVAwKv1SEK62Ptol28GJjw_4oROqpDG",
  VAPID_PUBLIC_KEY: "BMyINgoVsp_Dwvf7KJThtpkqkjw6VaViKPkjPcE-YtGX5HkEuOYMPD81KMRFPylSto7qvVg5TAKaOImr1YWMJJM"
};

document.addEventListener('DOMContentLoaded', () => {
  const loadOnce = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, 'true');
    document.body.appendChild(script);
  };

  loadOnce('./auth-redirect.js?v=1', 'data-hypersafe-auth-redirect');
  loadOnce('./push-notifications.js?v=1', 'data-hypersafe-push-notifications');
  loadOnce('./manual-adjust.js?v=4', 'data-hypersafe-manual-adjust');
  loadOnce('./reset-control.js?v=1', 'data-hypersafe-reset-control');
  loadOnce('./day-reset.js?v=1', 'data-hypersafe-day-reset');
});
