(() => {
  const VAPID_PUBLIC_KEY = window.APP_CONFIG?.VAPID_PUBLIC_KEY || '';
  let pushBusy = false;

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function base64UrlToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function registration() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker non pris en charge.');
    await navigator.serviceWorker.register('./sw.js');
    return navigator.serviceWorker.ready;
  }

  async function currentSubscription() {
    if (!('PushManager' in window)) return null;
    const reg = await registration();
    return reg.pushManager.getSubscription();
  }

  async function saveSubscription(sub) {
    if (!session?.user?.id || !profile?.couple_id || !sb) throw new Error('Connecte-toi d’abord à HyperSafe.');
    const p256dh = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    if (!p256dh || !auth) throw new Error('Abonnement Push incomplet.');

    const { error } = await sb.from('push_subscriptions').upsert({
      couple_id: profile.couple_id,
      user_id: session.user.id,
      endpoint: sub.endpoint,
      p256dh: bufferToBase64Url(p256dh),
      auth_key: bufferToBase64Url(auth),
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  async function enablePush() {
    if (pushBusy) return;
    if (!VAPID_PUBLIC_KEY) return toast('Configuration Push manquante.');
    if (!('Notification' in window) || !('PushManager' in window)) return toast('Les notifications Push ne sont pas prises en charge sur cet appareil.');
    if (isIOS() && !isStandalone()) {
      return toast('Sur iPhone/iPad : ajoute HyperSafe à l’écran d’accueil, ouvre-la depuis son icône, puis active les notifications.');
    }

    pushBusy = true;
    updateStatus('Activation…');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        updateStatus(permission === 'denied' ? 'Notifications refusées' : 'Notifications non activées');
        return toast('Autorisation de notification non accordée.');
      }
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await saveSubscription(sub);
      updateStatus('Notifications activées');
      toast('Notifications activées sur cet appareil.');
    } catch (e) {
      console.error(e);
      updateStatus('Erreur d’activation');
      toast(e.message || 'Impossible d’activer les notifications.');
    } finally {
      pushBusy = false;
    }
  }

  async function disablePush() {
    if (pushBusy) return;
    pushBusy = true;
    try {
      const sub = await currentSubscription();
      if (sub && sb && session?.user?.id) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('user_id', session.user.id);
        await sub.unsubscribe();
      }
      updateStatus('Notifications désactivées');
      toast('Notifications désactivées sur cet appareil.');
    } catch (e) {
      toast(e.message || 'Impossible de désactiver les notifications.');
    } finally {
      pushBusy = false;
    }
  }

  async function refreshPushState() {
    const button = document.getElementById('pushToggleBtn');
    if (!button) return;
    if (!('Notification' in window) || !('PushManager' in window)) {
      button.disabled = true;
      button.textContent = 'Non disponible';
      updateStatus('Non pris en charge');
      return;
    }
    if (isIOS() && !isStandalone()) {
      button.disabled = false;
      button.textContent = 'Comment activer';
      updateStatus('Installer sur l’écran d’accueil');
      return;
    }
    try {
      const sub = await currentSubscription();
      if (sub && Notification.permission === 'granted') {
        if (session?.user?.id && profile?.couple_id && sb) await saveSubscription(sub).catch(() => {});
        button.textContent = 'Désactiver';
        button.dataset.enabled = 'true';
        updateStatus('Notifications activées');
      } else {
        button.textContent = 'Activer les notifications';
        button.dataset.enabled = 'false';
        updateStatus(Notification.permission === 'denied' ? 'Notifications refusées dans les réglages système' : 'Notifications désactivées');
      }
    } catch (_) {
      updateStatus('État inconnu');
    }
  }

  function updateStatus(text) {
    const el = document.getElementById('pushStatus');
    if (el) el.textContent = text;
  }

  async function togglePush() {
    const button = document.getElementById('pushToggleBtn');
    if (isIOS() && !isStandalone()) {
      return toast('Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Ouvre ensuite HyperSafe depuis cette icône.');
    }
    if (button?.dataset.enabled === 'true') await disablePush();
    else await enablePush();
    await refreshPushState();
  }

  window.notifyPartnerOfChange = async (source, id) => {
    if (!sb || !session || !id) return;
    try {
      const { error } = await sb.functions.invoke('send-partner-push', { body: { source, id } });
      if (error) console.warn('Push partenaire non envoyé', error);
    } catch (e) {
      console.warn('Push partenaire non envoyé', e);
    }
  };

  function mount() {
    const settings = document.querySelector('.settings-card');
    if (!settings || document.getElementById('pushSettingRow')) return;

    const row = document.createElement('div');
    row.id = 'pushSettingRow';
    row.className = 'setting-row';
    row.innerHTML = `
      <div>
        <strong>Notifications du conjoint</strong>
        <p>Reçois une alerte discrète lorsque l’autre compte modifie la courbe.</p>
        <p id="pushStatus" class="tiny">Vérification…</p>
      </div>
      <button id="pushToggleBtn" class="secondary small" type="button" data-enabled="false">Activer les notifications</button>
    `;
    settings.appendChild(row);
    document.getElementById('pushToggleBtn').addEventListener('click', togglePush);

    const previousRenderAll = window.renderAll;
    if (typeof previousRenderAll === 'function' && !window.__pushRenderWrapped) {
      window.__pushRenderWrapped = true;
      window.renderAll = function(...args) {
        const result = previousRenderAll.apply(this, args);
        setTimeout(refreshPushState, 0);
        return result;
      };
    }
    refreshPushState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
