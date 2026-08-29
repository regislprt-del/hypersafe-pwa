(() => {
  const REDIRECT_URL = 'https://regislprt-del.github.io/hypersafe-pwa/';

  function installRedirectAwareSignup() {
    const form = document.getElementById('authForm');
    if (!form || form.dataset.redirectAware === 'true') return;
    form.dataset.redirectAware = 'true';

    form.onsubmit = async e => {
      e.preventDefault();
      if (!sb) return toast('Configuration Supabase manquante.');

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      let res;

      if (authMode === 'login') {
        res = await sb.auth.signInWithPassword({ email, password });
      } else {
        res = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: REDIRECT_URL }
        });
      }

      if (res.error) return toast(res.error.message);
      if (authMode === 'signup' && !res.data.session) {
        return toast('Compte créé : confirmez l’e-mail reçu, puis revenez sur HyperSafe.');
      }

      session = res.data.session;
      await enterSession();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(installRedirectAwareSignup, 0));
  } else {
    setTimeout(installRedirectAwareSignup, 0);
  }
})();
