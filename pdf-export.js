(() => {
  const DAY_MS = 86400000;
  const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

  function eventDate(event) {
    const date = new Date(event?.occurred_at);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventYear(event) {
    const day = String(event?.event_day || '');
    if (/^\d{4}-/.test(day)) return Number(day.slice(0, 4));
    const date = eventDate(event);
    return date ? date.getFullYear() : null;
  }

  function formatDate(date, withTime = false) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('fr-FR', withTime
      ? { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }
      : { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function countBetween(start, end) {
    const a = start.getTime(), b = end.getTime();
    return events.filter(event => {
      const date = eventDate(event);
      return date && date.getTime() >= a && date.getTime() < b;
    }).length;
  }

  function percentChange(current, previous) {
    if (!previous) return current ? 'Nouveau' : '0%';
    const value = Math.round(((current - previous) / previous) * 100);
    return `${value > 0 ? '+' : ''}${value}%`;
  }

  function typeCounts(source) {
    const map = new Map(TYPES.map(([kind]) => [kind, 0]));
    source.forEach(event => map.set(event.kind, (map.get(event.kind) || 0) + 1));
    return map;
  }

  function topType(source) {
    const counts = typeCounts(source);
    let winner = null, max = 0;
    for (const [kind, label] of TYPES) {
      const count = counts.get(kind) || 0;
      if (count > max) { max = count; winner = { kind, label, count }; }
    }
    return winner;
  }

  function computeEventRates() {
    const result = new Map();
    const sortedEvents = [...events].sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    const sortedAnchors = [...anchors].sort((a,b) => new Date(a.anchor_at) - new Date(b.anchor_at));
    let ai = 0, value = null, cursor = null;

    for (const event of sortedEvents) {
      const eventTime = new Date(event.occurred_at);
      while (ai < sortedAnchors.length && new Date(sortedAnchors[ai].anchor_at) <= eventTime) {
        value = clamp(Number(sortedAnchors[ai].score));
        cursor = new Date(sortedAnchors[ai].anchor_at);
        ai++;
      }
      if (value === null || !cursor) {
        result.set(event.id, null);
        continue;
      }
      value = clamp(value + Math.max(0, Math.floor((eventTime - cursor) / 3600000)));
      value = clamp(value - Number(event.impact || 0));
      cursor = eventTime;
      result.set(event.id, value);
    }
    return result;
  }

  function monthlySeries(monthCount = 12) {
    const now = new Date();
    const rows = [];
    for (let offset = monthCount - 1; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      rows.push({
        label: `${MONTHS_FR[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
        value: countBetween(start, end)
      });
    }
    return rows;
  }

  function yearlySummary() {
    const years = [...new Set(events.map(eventYear).filter(Number.isFinite))].sort((a,b) => b - a);
    return years.map(year => {
      const source = events.filter(event => eventYear(event) === year);
      const top = topType(source);
      return {
        year,
        total: source.length,
        average: source.length / 12,
        top: top ? `${top.label} (${top.count})` : '—'
      };
    });
  }

  function buildRatePoints(days = 90) {
    if (!anchors.length) return [];
    const now = new Date();
    const earliest = new Date(anchors[0].anchor_at);
    const requested = new Date(now.getTime() - days * DAY_MS);
    const start = requested < earliest ? earliest : requested;
    const points = [];
    const step = 12 * 3600000;
    for (let t = start.getTime(); t < now.getTime(); t += step) {
      const date = new Date(t);
      const value = rateAt(date);
      if (value !== null) points.push({ date, value });
    }
    points.push({ date: now, value: currentRate(now) });
    return points;
  }

  function safeText(doc, text, x, y, options) {
    doc.text(String(text ?? '—'), x, y, options);
  }

  function sectionTitle(doc, title, y) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);
    doc.setTextColor(15,23,42);
    safeText(doc, title, 14, y);
    doc.setDrawColor(226,232,240);
    doc.line(14, y + 2.5, 196, y + 2.5);
    return y + 9;
  }

  function ensureSpace(doc, y, needed = 35) {
    if (y + needed <= 282) return y;
    doc.addPage();
    return 18;
  }

  function drawMetricCard(doc, x, y, w, title, value, detail = '') {
    doc.setFillColor(248,250,252);
    doc.setDrawColor(219,227,238);
    doc.roundedRect(x, y, w, 24, 2.5, 2.5, 'FD');
    doc.setTextColor(100,116,139);
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    safeText(doc, title, x + 3, y + 5.5);
    doc.setTextColor(15,23,42);
    doc.setFontSize(15);
    safeText(doc, value, x + 3, y + 13.5);
    doc.setTextColor(100,116,139);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    safeText(doc, detail, x + 3, y + 20);
  }

  function drawLineChart(doc, x, y, w, h, points, title, yMin = 0, yMax = 78) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(15,23,42);
    safeText(doc, title, x, y);
    const top = y + 5, bottom = top + h - 10, left = x + 10, right = x + w;
    doc.setDrawColor(203,213,225);
    doc.setLineWidth(0.25);

    const ticks = [yMin, Math.round((yMax-yMin)*.25+yMin), Math.round((yMax-yMin)*.5+yMin), Math.round((yMax-yMin)*.75+yMin), yMax];
    ticks.forEach(v => {
      const py = bottom - ((v - yMin) / Math.max(1, yMax - yMin)) * (bottom - top);
      doc.line(left, py, right, py);
      doc.setFont('helvetica','normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100,116,139);
      safeText(doc, v, x, py + 2);
    });

    if (points.length < 2) {
      doc.setFontSize(8);
      safeText(doc, 'Pas assez de données pour tracer la courbe.', left, top + 12);
      return;
    }

    const minTime = points[0].date.getTime();
    const maxTime = points.at(-1).date.getTime();
    const span = Math.max(1, maxTime - minTime);
    const px = date => left + ((date.getTime() - minTime) / span) * (right - left);
    const py = value => bottom - ((value - yMin) / Math.max(1, yMax - yMin)) * (bottom - top);

    doc.setDrawColor(0,0,0);
    doc.setLineWidth(0.8);
    for (let i = 1; i < points.length; i++) {
      doc.line(px(points[i-1].date), py(points[i-1].value), px(points[i].date), py(points[i].value));
    }

    doc.setFont('helvetica','normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100,116,139);
    safeText(doc, formatDate(points[0].date), left, bottom + 5);
    safeText(doc, formatDate(points.at(-1).date), right, bottom + 5, { align:'right' });
  }

  function drawBarChart(doc, x, y, w, h, rows, title) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(15,23,42);
    safeText(doc, title, x, y);
    const top = y + 6, bottom = top + h - 13, left = x + 8, right = x + w;
    const max = Math.max(1, ...rows.map(r => Number(r.value) || 0));
    const gap = 1.5;
    const barW = Math.max(2, (right - left - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length));

    doc.setDrawColor(226,232,240);
    doc.line(left, bottom, right, bottom);
    rows.forEach((row, index) => {
      const bh = ((Number(row.value) || 0) / max) * (bottom - top);
      const bx = left + index * (barW + gap);
      doc.setFillColor(96,165,250);
      doc.rect(bx, bottom - bh, barW, bh, 'F');
      doc.setFont('helvetica','normal');
      doc.setTextColor(100,116,139);
      doc.setFontSize(rows.length > 8 ? 5.2 : 6.2);
      safeText(doc, row.label, bx + barW/2, bottom + 4, { align:'center' });
      doc.setTextColor(15,23,42);
      doc.setFontSize(5.8);
      safeText(doc, row.value, bx + barW/2, Math.max(top + 4, bottom - bh - 1.5), { align:'center' });
    });
  }

  async function exportDetailedPdf() {
    const button = document.getElementById('exportStatsPdf');
    if (button) {
      button.disabled = true;
      button.textContent = 'Création du PDF…';
    }

    try {
      const jsPDF = window.jspdf?.jsPDF;
      if (!jsPDF) throw new Error('Le module PDF n’est pas disponible. Vérifie la connexion internet puis réessaie.');

      const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
      if (typeof doc.autoTable !== 'function') throw new Error('Le module de tableaux PDF n’est pas disponible. Vérifie la connexion internet puis réessaie.');
      const now = new Date();
      const rateNow = currentRate(now);
      const rate72 = rateAt(new Date(now.getTime() - 72 * 3600000));
      const delta72 = rate72 === null ? null : Math.round((rateNow - rate72) * 10) / 10;

      const start7 = new Date(now.getTime() - 7 * DAY_MS);
      const start14 = new Date(now.getTime() - 14 * DAY_MS);
      const start30 = new Date(now.getTime() - 30 * DAY_MS);
      const start60 = new Date(now.getTime() - 60 * DAY_MS);
      const count7 = countBetween(start7, now);
      const previous7 = countBetween(start14, start7);
      const count30 = countBetween(start30, now);
      const previous30 = countBetween(start60, start30);
      const dailyAverage = count30 / 30;
      const weeklyAverage = count30 * 7 / 30;
      const last30 = events.filter(event => {
        const date = eventDate(event);
        return date && date >= start30 && date < now;
      });
      const top30 = topType(last30);

      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      const currentYearEvents = events.filter(event => eventYear(event) === currentYear);
      const previousYearEvents = events.filter(event => eventYear(event) === previousYear);

      const thisMonthStart = new Date(currentYear, now.getMonth(), 1);
      const nextMonthStart = new Date(currentYear, now.getMonth() + 1, 1);
      const previousMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
      const thisMonth = countBetween(thisMonthStart, nextMonthStart);
      const previousMonth = countBetween(previousMonthStart, thisMonthStart);

      doc.setProperties({
        title: 'HyperSafe - Rapport détaillé',
        subject: 'Export complet des statistiques et de l’historique HyperSafe',
        author: 'HyperSafe'
      });

      doc.setFillColor(15,23,42);
      doc.rect(0,0,210,38,'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(22);
      safeText(doc, 'HyperSafe - Rapport détaillé', 14, 17);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      safeText(doc, `Export généré le ${formatDate(now, true)}`, 14, 25);
      safeText(doc, `Période couverte : ${events.length ? formatDate(eventDate([...events].sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at))[0])) : 'aucune donnée'} à ${formatDate(now)}`, 14, 31);

      let y = 48;
      y = sectionTitle(doc, 'Synthèse générale', y);
      drawMetricCard(doc, 14, y, 34, 'Taux actuel', fmt(rateNow), 'maximum 78');
      drawMetricCard(doc, 51, y, 34, 'Tendance 72h', delta72 === null ? '—' : `${delta72 > 0 ? '+' : ''}${fmt(delta72)}`, delta72 === null ? 'données insuffisantes' : 'points');
      drawMetricCard(doc, 88, y, 34, '7 jours', count7, 'événements');
      drawMetricCard(doc, 125, y, 34, '30 jours', count30, 'événements');
      drawMetricCard(doc, 162, y, 34, 'Moy. quotidienne', fmt(dailyAverage), 'sur 30 jours');
      y += 31;
      drawMetricCard(doc, 14, y, 34, 'Moy. hebdo', fmt(weeklyAverage), 'sur 30 jours');
      drawMetricCard(doc, 51, y, 58, 'Type le plus fréquent (30 j)', top30?.label || '—', top30 ? `${top30.count} événement${top30.count > 1 ? 's' : ''}` : 'aucun événement');
      drawMetricCard(doc, 112, y, 40, 'Évolution 7 jours', percentChange(count7, previous7), `${count7} vs ${previous7}`);
      drawMetricCard(doc, 155, y, 41, 'Évolution 30 jours', percentChange(count30, previous30), `${count30} vs ${previous30}`);
      y += 31;
      drawMetricCard(doc, 14, y, 56, `${currentYear} vs ${previousYear}`, percentChange(currentYearEvents.length, previousYearEvents.length), `${currentYearEvents.length} vs ${previousYearEvents.length}`);
      drawMetricCard(doc, 73, y, 56, 'Mois en cours', percentChange(thisMonth, previousMonth), `${thisMonth} vs ${previousMonth}`);
      drawMetricCard(doc, 132, y, 64, '30 derniers j. vs 30 précédents', percentChange(count30, previous30), `${count30} vs ${previous30}`);
      y += 31;

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Courbes et tendances', y);
      const ratePoints = buildRatePoints(90);
      drawLineChart(doc, 14, y, 182, 62, ratePoints, 'Évolution du taux sur les 90 derniers jours', 0, 78);
      y += 68;
      drawBarChart(doc, 14, y, 182, 56, monthlySeries(12), 'Nombre d’événements par mois - 12 derniers mois');
      y += 62;

      y = ensureSpace(doc, y, 72);
      y = sectionTitle(doc, `Répartition par type - ${currentYear}`, y);
      const currentTypeCounts = typeCounts(currentYearEvents);
      const typeRows = TYPES.map(([kind,label]) => ({ label: label.replace('Soirée scénario avec anal','Scénario + anal'), value: currentTypeCounts.get(kind) || 0 }));
      drawBarChart(doc, 14, y, 182, 60, typeRows, `Événements par type en ${currentYear}`);
      y += 67;

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Statistiques détaillées par type', y);
      const totalTypeCounts = typeCounts(events);
      const last30TypeCounts = typeCounts(last30);
      const prevYearTypeCounts = typeCounts(previousYearEvents);
      const typeTable = TYPES.map(([kind,label]) => [
        label,
        Number(events.find(e => e.kind === kind)?.impact || 0).toLocaleString('fr-FR'),
        totalTypeCounts.get(kind) || 0,
        currentTypeCounts.get(kind) || 0,
        prevYearTypeCounts.get(kind) || 0,
        last30TypeCounts.get(kind) || 0
      ]);
      doc.autoTable({
        startY:y,
        head:[['Type','Impact','Total',String(currentYear),String(previousYear),'30 derniers j.']],
        body:typeTable,
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });
      y = doc.lastAutoTable.finalY + 10;

      y = sectionTitle(doc, 'Statistiques annuelles', ensureSpace(doc, y, 40));
      const annual = yearlySummary();
      doc.autoTable({
        startY:y,
        head:[['Année','Événements','Moyenne / mois','Type le plus fréquent']],
        body:annual.map(row => [String(row.year), row.total, fmt(row.average), row.top]),
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });
      y = doc.lastAutoTable.finalY + 10;

      y = sectionTitle(doc, 'Données mensuelles - année en cours', ensureSpace(doc, y, 50));
      const monthlyCurrentYear = MONTHS_FR.map((label, month) => {
        const start = new Date(currentYear, month, 1);
        const end = new Date(currentYear, month + 1, 1);
        return [label, countBetween(start,end)];
      });
      doc.autoTable({
        startY:y,
        head:[['Mois','Nombre d’événements']],
        body:monthlyCurrentYear,
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Valeurs de référence et ajustements', y);
      const anchorRows = [...anchors]
        .sort((a,b)=>new Date(a.anchor_at)-new Date(b.anchor_at))
        .map(anchor => [
          formatDate(new Date(anchor.anchor_at), true),
          fmt(anchor.score),
          anchor.created_by === session?.user?.id ? 'Vous' : 'Autre compte'
        ]);
      doc.autoTable({
        startY:y,
        head:[['Date / heure','Valeur','Saisi par']],
        body:anchorRows.length ? anchorRows : [['—','—','Aucun ajustement enregistré']],
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });
      y = doc.lastAutoTable.finalY + 10;

      y = sectionTitle(doc, 'Historique complet des événements', ensureSpace(doc, y, 28));
      const rateMap = computeEventRates();
      const detailRows = [...events]
        .sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))
        .map(event => [
          formatDate(eventDate(event), true),
          typeInfo(event.kind)?.[1] || event.kind,
          event.slot_no ?? '—',
          Number(event.impact || 0).toLocaleString('fr-FR'),
          rateMap.get(event.id) === null || rateMap.get(event.id) === undefined ? '—' : fmt(rateMap.get(event.id)),
          event.created_by === session?.user?.id ? 'Vous' : 'Autre compte'
        ]);
      doc.autoTable({
        startY:y,
        head:[['Date / heure','Type','N°','Impact','Taux après','Saisi par']],
        body:detailRows.length ? detailRows : [['—','Aucun événement','—','—','—','—']],
        theme:'grid',
        styles:{ font:'helvetica', fontSize:6.8, cellPadding:1.7, overflow:'linebreak' },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        columnStyles:{ 0:{cellWidth:29}, 1:{cellWidth:55}, 2:{cellWidth:10}, 3:{cellWidth:18}, 4:{cellWidth:22}, 5:{cellWidth:26} },
        margin:{ left:14,right:14 },
        didDrawPage: data => {
          if (data.pageNumber > 1) {
            doc.setFont('helvetica','normal');
            doc.setFontSize(7);
            doc.setTextColor(100,116,139);
          }
        }
      });

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setDrawColor(226,232,240);
        doc.line(14, 287, 196, 287);
        doc.setFont('helvetica','normal');
        doc.setFontSize(7);
        doc.setTextColor(100,116,139);
        safeText(doc, 'HyperSafe - Export confidentiel', 14, 292);
        safeText(doc, `Page ${page} / ${pages}`, 196, 292, { align:'right' });
      }

      const filename = `HyperSafe_rapport_detaille_${localDay(now)}.pdf`;
      doc.save(filename);
      toast('Rapport PDF détaillé créé');
    } catch (error) {
      toast(error?.message || 'Impossible de créer le PDF.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Exporter toutes les données en PDF';
      }
    }
  }

  function mount() {
    const button = document.getElementById('exportStatsPdf');
    if (button) button.addEventListener('click', exportDetailedPdf);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();