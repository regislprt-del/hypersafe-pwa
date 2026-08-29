(() => {
  let busy = false;

  function injectStyles() {
    if (document.getElementById('manualAdjustStyles')) return;
    const style = document.createElement('style');
    style.id = 'manualAdjustStyles';
    style.textContent = `
      .manual-adjust-card{margin-top:16px;margin-bottom:28px;text-align:center}
      .manual-adjust-card h2{font-size:19px;margin:0 0 5px}
      .manual-adjust-card p{margin:0;color:#64748b;font-size:13px;line-height:1.45}
      .manual-adjust-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
      .manual-adjust-btn{border:0;border-radius:18px;min-height:74px;font-size:28px;font-weight:850;cursor:pointer;box-shadow:0 5px 14px rgba(15,23,42,.08);transition:transform .08s ease,opacity .15s ease}
      .manual-adjust-btn:active{transform:scale(.98)}
      .manual-adjust-btn:disabled{opacity:.55;cursor:wait}
      .manual-minus{background:#dcfce7;color:#166534;border:1px solid #86efac}
      .manual-plus{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5}
      .manual-adjust-current{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:8px 12px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:13px}
      .manual-adjust-current strong{font-size:15px;margin:0;display:inline}
      @media(max-width:700px){.manual-adjust-card{margin-bottom:18px}.manual-adjust-btn{min-height:68px;font-size:26px}}
    `;
    document.head.appendChild(style);
  }

  function updateDisplayedValue() {
    const value = document.getElementById('manualAdjustValue');
    if (value && typeof currentRate === 'function' && typeof fmt === 'function') value.textContent = fmt(currentRate());
  }

  async function adjust(delta) {
    if (busy || !session || !profile?.couple_id || !sb) return;
    const before = currentRate();
    const next = clamp(before + delta);
    if (next === before) {
      toast(delta > 0 ? 'Le niveau maximum est déjà atteint.' : 'Le niveau minimum est déjà atteint.');
      return;
    }

    busy = true;
    const buttons = [...document.querySelectorAll('.manual-adjust-btn')];
    buttons.forEach(b => b.disabled = true);

    try {
      const { data, error } = await sb.from('anchors').insert({
        couple_id: profile.couple_id,
        score: next,
        created_by: session.user.id
      }).select().single();

      if (error) throw error;
      if (data && !anchors.some(a => a.id === data.id)) {
        anchors.push(data);
        anchors.sort((a,b) => new Date(a.anchor_at) - new Date(b.anchor_at));
      }

      if (data?.id && typeof window.notifyPartnerOfChange === 'function') window.notifyPartnerOfChange('anchors', data.id);
      renderAll();
      updateDisplayedValue();
      toast(`Niveau psychologique ${delta > 0 ? '+1' : '−1'} → ${fmt(next)}`);
    } catch (e) {
      toast(e.message || 'Impossible de modifier le niveau.');
    } finally {
      busy = false;
      buttons.forEach(b => b.disabled = false);
    }
  }

  function mount() {
    injectStyles();
    const app = document.getElementById('appView');
    if (!app || document.getElementById('manualAdjustCard')) return;

    const card = document.createElement('section');
    card.id = 'manualAdjustCard';
    card.className = 'card manual-adjust-card';
    card.innerHTML = `
      <h2>Ajustement manuel du niveau psychologique</h2>
      <p>À utiliser lorsqu'une évolution psychologique doit corriger la courbe indépendamment d'un rapport.</p>
      <div class="manual-adjust-actions">
        <button id="manualMinus" class="manual-adjust-btn manual-minus" type="button">−1</button>
        <button id="manualPlus" class="manual-adjust-btn manual-plus" type="button">+1</button>
      </div>
      <div class="manual-adjust-current">Niveau actuel : <strong id="manualAdjustValue">—</strong></div>
    `;
    app.appendChild(card);

    document.getElementById('manualMinus').addEventListener('click', () => adjust(-1));
    document.getElementById('manualPlus').addEventListener('click', () => adjust(1));

    const originalRenderAll = window.renderAll;
    if (typeof originalRenderAll === 'function' && !window.__manualAdjustRenderWrapped) {
      window.__manualAdjustRenderWrapped = true;
      window.renderAll = function(...args) {
        const result = originalRenderAll.apply(this, args);
        updateDisplayedValue();
        return result;
      };
    }

    updateDisplayedValue();
    setInterval(updateDisplayedValue, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
