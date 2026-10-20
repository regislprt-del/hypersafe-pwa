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

  function recentMonthlyTypeSeries(monthCount = 3) {
    const now = new Date();
    const months = [];
    for (let offset = monthCount - 1; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      const source = events.filter(event => {
        const date = eventDate(event);
        return date && date >= start && date < end;
      });
      const counts = typeCounts(source);
      months.push({
        title: start.toLocaleDateString('fr-FR', { month:'long', year:'numeric' }),
        rows: TYPES.map(([kind,label]) => ({
          label: label.replace('Soirée scénario avec anal','Scénario + anal'),
          value: counts.get(kind) || 0
        }))
      });
    }
    return months;
  }

  function yearlySummary() {
    const years = [...new Set(events.map(eventYear).filter(Number.isFinite))].sort((a,b) => b - a);
    return years.map(year => {
      const source = events.filter(event => eventYear(event) === year);
      const top = topType(source);

      let averageSource = source;
      let averageMonths = 12;
      let averageBasis = '12 mois';

      if (year === 2026) {
        const averageStart = new Date(2026, 8, 1);
        const averageEnd = new Date(2027, 0, 1);
        averageSource = source.filter(event => {
          const date = eventDate(event);
          return date && date >= averageStart && date < averageEnd;
        });
        averageMonths = 4;
        averageBasis = 'sept.–déc. (4 mois)';
      }

      return {
        year,
        total: source.length,
        average: averageSource.length / averageMonths,
        averageBasis,
        top: top ? `${top.label} (${top.count})` : '—'
      };
    });
  }

  function eventsBetween(start, end) {
    const a = start.getTime(), b = end.getTime();
    return events.filter(event => {
      const date = eventDate(event);
      return date && date.getTime() >= a && date.getTime() < b;
    });
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function calendarDayStarts(start, end) {
    const rows = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= limit) {
      rows.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }

  function daysWithoutEvents(start, end) {
    const source = eventsBetween(start, end);
    const active = new Set(source.map(event => {
      const date = eventDate(event);
      return date ? dayKey(date) : null;
    }).filter(Boolean));
    return calendarDayStarts(start, new Date(end.getTime() - 1)).filter(date => !active.has(dayKey(date))).length;
  }

  function longestNoEventStreak(start, end) {
    const source = eventsBetween(start, end);
    const active = new Set(source.map(event => {
      const date = eventDate(event);
      return date ? dayKey(date) : null;
    }).filter(Boolean));
    let longest = 0, current = 0;
    for (const date of calendarDayStarts(start, new Date(end.getTime() - 1))) {
      if (active.has(dayKey(date))) current = 0;
      else {
        current += 1;
        if (current > longest) longest = current;
      }
    }
    return longest;
  }

  function averageIntervalDays(source) {
    const sorted = source.map(eventDate).filter(Boolean).sort((a,b) => a - b);
    if (sorted.length < 2) return null;
    let total = 0;
    for (let i = 1; i < sorted.length; i++) total += sorted[i] - sorted[i-1];
    return total / (sorted.length - 1) / DAY_MS;
  }

  function weekdayAverageSeries(start, end) {
    const labels = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const occurrences = Array(7).fill(0);
    for (const date of calendarDayStarts(start, new Date(end.getTime() - 1))) {
      occurrences[(date.getDay() + 6) % 7] += 1;
    }
    const counts = Array(7).fill(0);
    eventsBetween(start, end).forEach(event => {
      const date = eventDate(event);
      if (date) counts[(date.getDay() + 6) % 7] += 1;
    });
    return labels.map((label,index) => ({
      label,
      value: occurrences[index] ? Math.round((counts[index] / occurrences[index]) * 100) / 100 : 0,
      displayValue: occurrences[index] ? (counts[index] / occurrences[index]).toLocaleString('fr-FR',{maximumFractionDigits:2}) : '0'
    }));
  }

  function timeBandSeries(start, end) {
    const bands = [
      { label:'00h–06h', min:0, max:6 },
      { label:'06h–12h', min:6, max:12 },
      { label:'12h–18h', min:12, max:18 },
      { label:'18h–00h', min:18, max:24 }
    ];
    const counts = bands.map(() => 0);
    eventsBetween(start, end).forEach(event => {
      const date = eventDate(event);
      if (!date) return;
      const hour = date.getHours();
      const index = bands.findIndex(b => hour >= b.min && hour < b.max);
      if (index >= 0) counts[index] += 1;
    });
    return bands.map((band,index) => ({ label:band.label, value:counts[index] }));
  }

  function cumulativeImpactByType(source) {
    const rows = TYPES.map(([kind,label]) => {
      const total = source
        .filter(event => event.kind === kind)
        .reduce((sum,event) => sum + Number(event.impact || 0), 0);
      return { label:label.replace('Soirée scénario avec anal','Scénario + anal'), value:Math.round(total * 10) / 10 };
    });
    return rows;
  }

  function typePercentageSeries(source) {
    const counts = typeCounts(source);
    const total = Math.max(1, source.length);
    return TYPES.map(([kind,label]) => {
      const percentage = (counts.get(kind) || 0) * 100 / total;
      return {
        label:label.replace('Soirée scénario avec anal','Scénario + anal'),
        value:Math.round(percentage * 10) / 10,
        displayValue:`${percentage.toLocaleString('fr-FR',{maximumFractionDigits:1})}%`
      };
    });
  }

  function rateStatistics(start, end, stepHours = 3) {
    if (!anchors.length) return { average:null, min:null, max:null, stddev:null, zones:[] };
    const earliest = new Date(anchors[0].anchor_at);
    const actualStart = start < earliest ? earliest : start;
    if (actualStart >= end) return { average:null, min:null, max:null, stddev:null, zones:[] };

    const sampleDates = [];
    const step = stepHours * 3600000;
    for (let t = actualStart.getTime(); t < end.getTime(); t += step) sampleDates.push(new Date(t));
    eventsBetween(actualStart, end).forEach(event => {
      const date = eventDate(event);
      if (date) sampleDates.push(date);
    });
    anchors.forEach(anchor => {
      const date = new Date(anchor.anchor_at);
      if (date >= actualStart && date < end) sampleDates.push(date);
    });
    sampleDates.push(new Date(end.getTime() - 1));

    const values = sampleDates
      .map(date => rateAt(date))
      .filter(value => value !== null && Number.isFinite(Number(value)))
      .map(Number);

    if (!values.length) return { average:null, min:null, max:null, stddev:null, zones:[] };

    const average = values.reduce((sum,value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum,value) => sum + Math.pow(value - average, 2), 0) / values.length;
    const zones = [
      { label:'0–12', min:0, max:12 },
      { label:'12–18', min:12, max:18 },
      { label:'18–31', min:18, max:31 },
      { label:'31–43', min:31, max:43 },
      { label:'43–78', min:43, max:78.0001 }
    ].map(zone => {
      const count = values.filter(value => value >= zone.min && value < zone.max).length;
      const pct = count * 100 / values.length;
      return {
        label:zone.label,
        value:Math.round(pct * 10) / 10,
        displayValue:`${pct.toLocaleString('fr-FR',{maximumFractionDigits:1})}%`
      };
    });

    return {
      average,
      min:Math.min(...values),
      max:Math.max(...values),
      stddev:Math.sqrt(variance),
      zones
    };
  }

  function monthlyTrendSeries(monthCount = 12) {
    const base = monthlySeries(monthCount);
    return base.map((row,index) => {
      const start = Math.max(0, index - 2);
      const sample = base.slice(start, index + 1);
      const movingAverage = sample.reduce((sum,item) => sum + Number(item.value || 0), 0) / sample.length;
      return { ...row, movingAverage:Math.round(movingAverage * 100) / 100 };
    });
  }

  function recentMonthComparisonData(monthCount = 3) {
    const now = new Date();
    const months = [];
    for (let offset = monthCount - 1; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      const counts = typeCounts(eventsBetween(start,end));
      months.push({
        label:start.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}),
        counts
      });
    }
    return months;
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

  function buildCurrentYearRatePoints() {
    if (!anchors.length) return [];
    const now = new Date();
    const earliest = new Date(anchors[0].anchor_at);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const start = yearStart < earliest ? earliest : yearStart;
    const points = [];
    const step = 24 * 3600000;
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
    const chartHeight = bottom - top;
    const valueToY = value => bottom - ((value - yMin) / Math.max(1, yMax - yMin)) * chartHeight;

    if (yMin === 0 && yMax === 78) {
      const levelBands = [
        [0,12,[74,222,128]],
        [12,18,[163,230,53]],
        [18,31,[250,204,21]],
        [31,43,[251,146,60]],
        [43,78,[248,113,113]]
      ];
      levelBands.forEach(([min,max,color]) => {
        const bandTop = valueToY(max);
        const bandBottom = valueToY(min);
        doc.setFillColor(...color);
        doc.rect(left, bandTop, right - left, bandBottom - bandTop, 'F');
      });
    }

    doc.setDrawColor(203,213,225);
    doc.setLineWidth(0.25);

    const ticks = yMin === 0 && yMax === 78
      ? [0,12,18,31,43,78]
      : [yMin, Math.round((yMax-yMin)*.25+yMin), Math.round((yMax-yMin)*.5+yMin), Math.round((yMax-yMin)*.75+yMin), yMax];

    ticks.forEach(v => {
      const py = valueToY(v);
      doc.line(left, py, right, py);
      doc.setFont('helvetica','normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71,85,105);
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
    const py = value => valueToY(value);

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

  function drawBarChart(doc, x, y, w, h, rows, title, sharedMax = null) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(15,23,42);
    safeText(doc, title, x, y);
    const top = y + 6, bottom = top + h - 13, left = x + 8, right = x + w;
    const max = Math.max(1, Number(sharedMax) || 0, ...rows.map(r => Number(r.value) || 0));
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
      safeText(doc, row.displayValue ?? row.value, bx + barW/2, Math.max(top + 4, bottom - bh - 1.5), { align:'center' });
    });
  }

  function drawMonthlyTrendChart(doc, x, y, w, h, rows, title) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(15,23,42);
    safeText(doc, title, x, y);

    const top = y + 6, bottom = top + h - 13, left = x + 8, right = x + w;
    const max = Math.max(1, ...rows.map(row => Math.max(Number(row.value)||0, Number(row.movingAverage)||0)));
    const gap = 1.5;
    const barW = Math.max(2, (right - left - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length));

    doc.setDrawColor(226,232,240);
    doc.line(left, bottom, right, bottom);

    const centers = [];
    rows.forEach((row,index) => {
      const value = Number(row.value) || 0;
      const bh = (value / max) * (bottom - top);
      const bx = left + index * (barW + gap);
      const cx = bx + barW / 2;
      centers.push(cx);

      doc.setFillColor(147,197,253);
      doc.rect(bx, bottom - bh, barW, bh, 'F');
      doc.setFont('helvetica','normal');
      doc.setFontSize(5.2);
      doc.setTextColor(100,116,139);
      safeText(doc, row.label, cx, bottom + 4, { align:'center' });
      doc.setTextColor(15,23,42);
      safeText(doc, value, cx, Math.max(top + 4, bottom - bh - 1.5), { align:'center' });
    });

    doc.setDrawColor(15,23,42);
    doc.setLineWidth(0.8);
    for (let i = 1; i < rows.length; i++) {
      const y1 = bottom - ((Number(rows[i-1].movingAverage)||0) / max) * (bottom - top);
      const y2 = bottom - ((Number(rows[i].movingAverage)||0) / max) * (bottom - top);
      doc.line(centers[i-1], y1, centers[i], y2);
    }

    doc.setFont('helvetica','normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71,85,105);
    safeText(doc, 'Barres : événements / mois  •  Ligne : moyenne mobile 3 mois', x, bottom + 9);
  }

  function drawZoneChart(doc, x, y, w, h, rows, title) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(15,23,42);
    safeText(doc, title, x, y);

    const colors = [
      [74,222,128],
      [163,230,53],
      [250,204,21],
      [251,146,60],
      [248,113,113]
    ];
    const top = y + 6, bottom = top + h - 13, left = x + 8, right = x + w;
    const gap = 4;
    const barW = (right - left - gap * (rows.length - 1)) / Math.max(1, rows.length);

    doc.setDrawColor(226,232,240);
    doc.line(left, bottom, right, bottom);

    rows.forEach((row,index) => {
      const value = Number(row.value) || 0;
      const bh = (value / 100) * (bottom - top);
      const bx = left + index * (barW + gap);
      doc.setFillColor(...colors[index % colors.length]);
      doc.rect(bx, bottom - bh, barW, bh, 'F');
      doc.setFont('helvetica','normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71,85,105);
      safeText(doc, row.label, bx + barW/2, bottom + 4, { align:'center' });
      doc.setTextColor(15,23,42);
      safeText(doc, row.displayValue ?? `${value}%`, bx + barW/2, Math.max(top + 4, bottom - bh - 1.5), { align:'center' });
    });
  }

  function drawSummaryText(doc, textValue, y) {
    const lines = doc.splitTextToSize(textValue, 182);
    doc.setFillColor(248,250,252);
    doc.setDrawColor(219,227,238);
    doc.roundedRect(14, y, 182, 8 + lines.length * 5, 2.5, 2.5, 'FD');
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(51,65,85);
    doc.text(lines, 18, y + 6);
    return y + 12 + lines.length * 5;
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
      const yearStart = new Date(currentYear, 0, 1);
      const calendarEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const calendarStart7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const calendarStart30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      const currentYearEvents = events.filter(event => eventYear(event) === currentYear);
      const previousYearEvents = events.filter(event => eventYear(event) === previousYear);
      const previous30Events = eventsBetween(start60, start30);

      const thisMonthStart = new Date(currentYear, now.getMonth(), 1);
      const nextMonthStart = new Date(currentYear, now.getMonth() + 1, 1);
      const previousMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
      const thisMonth = countBetween(thisMonthStart, nextMonthStart);
      const previousMonth = countBetween(previousMonthStart, thisMonthStart);

      const daysWithout7 = daysWithoutEvents(calendarStart7, calendarEnd);
      const daysWithout30 = daysWithoutEvents(calendarStart30, calendarEnd);
      const daysWithoutYear = daysWithoutEvents(yearStart, calendarEnd);
      const longestWithoutYear = longestNoEventStreak(yearStart, calendarEnd);
      const interval30 = averageIntervalDays(last30);
      const previousInterval30 = averageIntervalDays(previous30Events);

      const rateStats7 = rateStatistics(start7, now, 2);
      const rateStats30 = rateStatistics(start30, now, 3);
      const rateStatsYear = rateStatistics(yearStart, now, 6);
      const weekdayYear = weekdayAverageSeries(yearStart, now);
      const timeBandsYear = timeBandSeries(yearStart, now);
      const impactYear = cumulativeImpactByType(currentYearEvents);
      const percentageYear = typePercentageSeries(currentYearEvents);
      const monthComparison = recentMonthComparisonData(3);
      const monthlyTrend = monthlyTrendSeries(12);

      doc.setProperties({
        title: 'HyperSafe - Rapport détaillé',
        subject: 'Export complet des statistiques HyperSafe',
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

      y = sectionTitle(doc, 'Résumé automatique', y);
      const summaryParts = [
        `Sur les 30 derniers jours, ${count30} événement${count30 > 1 ? 's ont' : ' a'} été enregistré${count30 > 1 ? 's' : ''}, soit ${percentChange(count30, previous30)} par rapport aux 30 jours précédents.`,
        top30 ? `Le type le plus fréquent est « ${top30.label} » avec ${top30.count} occurrence${top30.count > 1 ? 's' : ''}.` : 'Aucun type dominant n’est identifié sur cette période.',
        `La moyenne quotidienne est de ${fmt(dailyAverage)} événement et la moyenne hebdomadaire de ${fmt(weeklyAverage)}.`,
        rateStats30.average === null ? '' : `Le taux moyen est de ${fmt(rateStats30.average)}, avec un minimum de ${fmt(rateStats30.min)} et un maximum de ${fmt(rateStats30.max)}.`,
        interval30 === null ? '' : `L’intervalle moyen entre deux événements est de ${interval30.toLocaleString('fr-FR',{maximumFractionDigits:1})} jour${interval30 >= 2 ? 's' : ''}.`
      ].filter(Boolean).join(' ');
      y = drawSummaryText(doc, summaryParts, y);

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Courbes et tendances', y);
      const rate30Points = buildRatePoints(30);
      drawLineChart(doc, 14, y, 182, 62, rate30Points, 'Évolution du taux sur les 30 derniers jours', 0, 78);
      y += 68;
      const ratePoints = buildRatePoints(90);
      drawLineChart(doc, 14, y, 182, 62, ratePoints, 'Évolution du taux sur les 90 derniers jours', 0, 78);
      y += 68;
      y = ensureSpace(doc, y, 70);
      const currentYearRatePoints = buildCurrentYearRatePoints();
      drawLineChart(doc, 14, y, 182, 62, currentYearRatePoints, `Évolution du taux sur l’année en cours - ${currentYear}`, 0, 78);
      y += 68;
      drawMonthlyTrendChart(doc, 14, y, 182, 60, monthlyTrend, 'Fréquence mensuelle des événements - 12 derniers mois');
      y += 66;

      y = ensureSpace(doc, y, 72);
      y = sectionTitle(doc, `Répartition par type - ${currentYear}`, y);
      const currentTypeCounts = typeCounts(currentYearEvents);
      const typeRows = TYPES.map(([kind,label]) => ({ label: label.replace('Soirée scénario avec anal','Scénario + anal'), value: currentTypeCounts.get(kind) || 0 }));
      drawBarChart(doc, 14, y, 182, 60, typeRows, `Événements par type en ${currentYear}`);
      y += 67;

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Répartition par type - 3 derniers mois', y);
      const recentMonths = recentMonthlyTypeSeries(3);
      const recentMonthsSharedMax = Math.max(
        1,
        ...recentMonths.flatMap(month => month.rows.map(row => Number(row.value) || 0))
      );
      recentMonths.forEach((month, index) => {
        if (index > 0) y += 4;
        drawBarChart(doc, 14, y, 182, 62, month.rows, `Événements par type - ${month.title}`, recentMonthsSharedMax);
        y += 65;
      });

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Comparaison détaillée des 3 derniers mois', y);
      const monthHeaders = monthComparison.map(month => month.label);
      const monthComparisonRows = TYPES.map(([kind,label]) => {
        const values = monthComparison.map(month => month.counts.get(kind) || 0);
        return [
          label,
          ...values,
          percentChange(values.at(-1) || 0, values[0] || 0)
        ];
      });
      doc.autoTable({
        startY:y,
        head:[['Type', ...monthHeaders, 'Évolution']],
        body:monthComparisonRows,
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Habitudes temporelles', y);
      drawBarChart(doc, 14, y, 182, 58, weekdayYear, `Moyenne d’événements par jour de la semaine - ${currentYear}`);
      y += 64;
      drawBarChart(doc, 14, y, 182, 58, timeBandsYear, `Répartition par tranche horaire - ${currentYear}`);
      y += 66;
      drawMetricCard(doc, 14, y, 42, 'Jours sans événement', daysWithout7, 'sur les 7 derniers jours');
      drawMetricCard(doc, 59, y, 42, 'Jours sans événement', daysWithout30, 'sur les 30 derniers jours');
      drawMetricCard(doc, 104, y, 42, 'Jours sans événement', daysWithoutYear, `depuis le 1er janvier ${currentYear}`);
      drawMetricCard(doc, 149, y, 47, 'Plus longue période', longestWithoutYear, 'jours consécutifs sans événement');
      y += 31;
      drawMetricCard(doc, 14, y, 86, 'Intervalle moyen entre événements', interval30 === null ? '—' : `${interval30.toLocaleString('fr-FR',{maximumFractionDigits:1})} j`, '30 derniers jours');
      drawMetricCard(doc, 104, y, 92, 'Intervalle moyen précédent', previousInterval30 === null ? '—' : `${previousInterval30.toLocaleString('fr-FR',{maximumFractionDigits:1})} j`, '30 jours précédents');

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, `Impact et répartition par type - ${currentYear}`, y);
      drawBarChart(doc, 14, y, 182, 68, impactYear, 'Impact cumulé par type (points retirés)');
      y += 74;
      drawBarChart(doc, 14, y, 182, 68, percentageYear, 'Part de chaque type dans le total des événements');
      y += 74;
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100,116,139);
      safeText(doc, 'L’impact cumulé mesure la somme des impacts enregistrés ; la répartition indique la part de chaque type dans le nombre total d’événements.', 14, y);

      doc.addPage();
      y = 18;
      y = sectionTitle(doc, 'Analyse du taux', y);
      doc.autoTable({
        startY:y,
        head:[['Période','Taux moyen','Minimum','Maximum','Variabilité']],
        body:[
          ['7 derniers jours', rateStats7.average === null ? '—' : fmt(rateStats7.average), rateStats7.min === null ? '—' : fmt(rateStats7.min), rateStats7.max === null ? '—' : fmt(rateStats7.max), rateStats7.stddev === null ? '—' : fmt(rateStats7.stddev)],
          ['30 derniers jours', rateStats30.average === null ? '—' : fmt(rateStats30.average), rateStats30.min === null ? '—' : fmt(rateStats30.min), rateStats30.max === null ? '—' : fmt(rateStats30.max), rateStats30.stddev === null ? '—' : fmt(rateStats30.stddev)],
          [`Année ${currentYear}`, rateStatsYear.average === null ? '—' : fmt(rateStatsYear.average), rateStatsYear.min === null ? '—' : fmt(rateStatsYear.min), rateStatsYear.max === null ? '—' : fmt(rateStatsYear.max), rateStatsYear.stddev === null ? '—' : fmt(rateStatsYear.stddev)]
        ],
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.5, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });
      y = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100,116,139);
      safeText(doc, 'Variabilité = écart-type du taux : plus la valeur est élevée, plus le taux fluctue.', 14, y);
      y += 8;
      drawZoneChart(doc, 14, y, 182, 58, rateStats30.zones, 'Temps estimé dans chaque zone - 30 derniers jours');
      y += 64;
      drawZoneChart(doc, 14, y, 182, 58, rateStatsYear.zones, `Temps estimé dans chaque zone - année ${currentYear}`);
      y += 64;
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100,116,139);
      safeText(doc, 'Les pourcentages de temps par zone sont estimés à partir d’échantillons réguliers du taux et des événements enregistrés.', 14, y);

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
        head:[['Année','Événements','Moyenne / mois','Base de calcul','Type le plus fréquent']],
        body:annual.map(row => [String(row.year), row.total, fmt(row.average), row.averageBasis, row.top]),
        theme:'grid',
        styles:{ font:'helvetica', fontSize:7.2, cellPadding:2 },
        headStyles:{ fillColor:[15,23,42], textColor:[255,255,255] },
        alternateRowStyles:{ fillColor:[248,250,252] },
        margin:{ left:14,right:14 }
      });
      y = doc.lastAutoTable.finalY + 6;
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100,116,139);
      safeText(doc, 'Pour 2026, la moyenne mensuelle est calculée uniquement sur septembre à décembre (4 mois), l’application ayant été créée le 29 août.', 14, y);
      y += 10;

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