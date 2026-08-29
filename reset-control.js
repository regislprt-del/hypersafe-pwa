(() => {
  let resetting = false;

  function injectStyles() {
    if (document.getElementById('resetControlStyles')) return;
    const style = document.createElement('style');
    style.id = 'resetControlStyles';
    style.textContent = `
      .danger-card{margin-top:16px;margin-bottom:28px;border:1px solid #fecaca;background:#fff7f7}
      .danger-card h2{font-size:19px;margin:0 0 5px;color:#991b1b}
      .danger-card p{margin:0;color:#7f1d1d;font-size:13px;line-height:1.45}
      .danger-reset-btn{margin-top:14px;width:100%;border:1px solid #ef4444;background:#fee2e2;color:#991b1b;border-radius:14px;min-height:50px;font-weight:800;cursor:pointer}
      .reset-modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px}
      .reset-modal{width:min(460px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
      .reset-modal h3{margin:0 0 8px;color:#991b1b;font-size:21px}
      .reset-modal p{margin:0 0 16px;color:#475569;font-size:13px;line-height:1.5}
      .reset-warning{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:11px 12px;border-radius:12px;margin-bottom:14px;font-size:13px;font-weight:700}
      .reset-modal label{display:grid;gap:7px;font-size:13px;font-weight:700}
      .reset-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
      .reset-cancel,.reset-confirm{border:0;border-radius:12px;min-height:46px;font-weight:800;cursor:pointer}
      .reset-cancel{background:#eef2f7;color:#334155}
      .reset-confirm{background:#b91c1c;color:#fff}
      .reset-confirm:disabled{opacity:.55;cursor:wait}
      @media(max-width:700px){.danger-card{margin-bottom:18px}.reset-modal-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function isOwner() {
    return !!(session?.user?.id && couple?.owner_id && session.user.id === couple.owner_id);
  }

  function updateVisibility() {
    const card = document.getElementById('dangerResetCard');
    if (card) card.classList.toggle('hidden', !isOwner());
  }

  function closeModal() {
    const backdrop = document.getElementById('resetModalBackdrop');
    const input = document.getElementById('resetPassword');
    if (input) input.value = '';
    if (backdrop) backdrop.classList.add('hidden');
  }

  function openModal() {
    if (!isOwner()) {
      toast('Seul le propriétaire du couple peut effectuer cette action.');
      return;
    }
    const backdrop = document.getElementById('resetModalBackdrop');
    backdrop.classList.remove('hidden');
    setTimeout(() => document.getElementById('resetPassword')?.focus(), 30);
  }

  async function performReset() {
    if (resetting || !isOwner() || !sb || !session?.user?.email) return;
    const input = document.getElementById('resetPassword');
    const password = input?.value || '';
    if (!password) {
      toast('Saisis ton mot de passe.');
      input?.focus();
      return;
    }

    resetting = true;
    const confirmBtn = document.getElementById('confirmTotalReset');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Vérification…'; }

    try {
      const verified = await sb.auth.signInWithPassword({
        email: session.user.email,
        password
      });
      if (verified.error) {
        toast('Mot de passe incorrect. Réinitialisation annulée.');
        return;
      }
      if (verified.data?.user?.id !== couple.owner_id) {
        toast('Ce compte n’est pas autorisé à réinitialiser les données.');
        return;
      }

      if (confirmBtn) confirmBtn.textContent = 'Réinitialisation…';
      const { error } = await sb.rpc('reset_couple');
      if (error) throw error;

      await loadAll();
      renderAll();
      closeModal();
      toast('Réinitialisation totale effectuée : niveau remis à 0.');
    } catch (e) {
      toast(e.message || 'Impossible de réinitialiser les données.');
    } finally {
      if (input) input.value = '';
      resetting = false;
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Effacer tout et remettre à 0'; }
    }
  }

  function mount() {
    injectStyles();
    const app = document.getElementById('appView');
    if (!app || document.getElementById('dangerResetCard')) return;

    const card = document.createElement('section');
    card.id = 'dangerResetCard';
    card.className = 'card danger-card hidden';
    card.innerHTML = `
      <h2>Zone sensible</h2>
      <p>Réinitialisation totale réservée au propriétaire. Efface définitivement l'historique et remet le niveau psychologique à 0, sans supprimer les comptes ni leur liaison.</p>
      <button id="openTotalReset" class="danger-reset-btn" type="button">Réinitialisation totale</button>
    `;
    app.appendChild(card);

    const backdrop = document.createElement('div');
    backdrop.id = 'resetModalBackdrop';
    backdrop.className = 'reset-modal-backdrop hidden';
    backdrop.innerHTML = `
      <div class="reset-modal" role="dialog" aria-modal="true" aria-labelledby="resetDialogTitle">
        <h3 id="resetDialogTitle">Réinitialisation totale</h3>
        <div class="reset-warning">Action irréversible : tous les événements et toutes les anciennes valeurs de référence seront supprimés.</div>
        <p>Pour confirmer que c'est bien toi, saisis le mot de passe de ton compte HyperSafe. Le mot de passe n'est jamais enregistré dans l'application.</p>
        <label>Mot de passe
          <input id="resetPassword" type="password" autocomplete="current-password" placeholder="Ton mot de passe" />
        </label>
        <div class="reset-modal-actions">
          <button id="cancelTotalReset" class="reset-cancel" type="button">Annuler</button>
          <button id="confirmTotalReset" class="reset-confirm" type="button">Effacer tout et remettre à 0</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    document.getElementById('openTotalReset').addEventListener('click', openModal);
    document.getElementById('cancelTotalReset').addEventListener('click', closeModal);
    document.getElementById('confirmTotalReset').addEventListener('click', performReset);
    document.getElementById('resetPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') performReset();
      if (e.key === 'Escape') closeModal();
    });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

    const previousRenderAll = window.renderAll;
    if (typeof previousRenderAll === 'function' && !window.__resetControlRenderWrapped) {
      window.__resetControlRenderWrapped = true;
      window.renderAll = function(...args) {
        const result = previousRenderAll.apply(this, args);
        updateVisibility();
        return result;
      };
    }

    updateVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
