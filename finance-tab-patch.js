// ============================================================
// FINANCE TAB PATCH — Artefact Tattoo Artist Booking Manager
// ============================================================
// This file contains everything needed to add a [fin] Finanzen
// tab to the existing single-file web app.
//
// INTEGRATION STEPS:
//   1. Inject FINANCE_CSS before the closing </style> tag
//   2. Add state properties (see SECTION 2)
//   3. Add tab button after the TODO tab button
//   4. Add renderFinanceView() call in the render() content switch
//   5. Paste all functions from SECTION 3–6 into the <script> block
//
// Each section has exact insertion comments.
// ============================================================
// ============================================================
// SECTION 1: CSS
// Insert this string before the closing </style> tag.
// You can inject it via: document.head.querySelector('style')
//   .textContent += FINANCE_CSS;
// Or paste the raw CSS into the <style> block.
// ============================================================

const FINANCE_CSS = `
/* ---- Finance Tab ---- */
.fin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: .75rem; margin-bottom: 1.25rem; }
.fin-card {
  background: var(--bg-card); border-radius: .75rem; padding: 1rem;
  cursor: pointer; transition: transform .15s, box-shadow .15s;
  border: 1px solid rgba(96,165,250,.08);
}
.fin-card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.35); }
.fin-card-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: .35rem; }
.fin-card-value { font-size: 1.45rem; font-weight: 700; color: #f1f5f9; }
.fin-card-sub { font-size: .72rem; color: #64748b; margin-top: .25rem; }
.fin-badge { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: .68rem; font-weight: 600; }
.fin-badge-green { background: rgba(34,197,94,.15); color: var(--green); }
.fin-badge-yellow { background: rgba(234,179,8,.15); color: var(--yellow); }
.fin-badge-red { background: rgba(239,68,68,.15); color: var(--red); }

.fin-detail {
  max-height: 0; overflow: hidden; transition: max-height .3s ease, padding .3s ease;
  background: rgba(15,23,42,.6); border-radius: 0 0 .75rem .75rem; margin-top: -.25rem;
  padding: 0 1rem; border: 1px solid rgba(96,165,250,.06); border-top: none;
}
.fin-detail.open { max-height: 600px; padding: .75rem 1rem; overflow-y: auto; }
.fin-detail table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.fin-detail th { text-align: left; color: #64748b; font-weight: 500; padding: .3rem 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.fin-detail td { padding: .3rem 0; color: #cbd5e1; }
.fin-detail td:last-child { text-align: right; font-variant-numeric: tabular-nums; }

.fin-section { margin-bottom: 1.5rem; }
.fin-section-title { font-size: .85rem; font-weight: 600; color: #e2e8f0; margin-bottom: .65rem; display: flex; align-items: center; gap: .4rem; }

.fin-compare { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
@media (max-width: 600px) { .fin-compare { grid-template-columns: 1fr; } }
.fin-loc-card { background: var(--bg-card); border-radius: .75rem; padding: 1rem; border: 1px solid rgba(96,165,250,.06); }
.fin-loc-name { font-size: .78rem; font-weight: 600; color: var(--accent); margin-bottom: .5rem; }
.fin-loc-row { display: flex; justify-content: space-between; font-size: .75rem; color: #94a3b8; padding: .2rem 0; }
.fin-loc-row span:last-child { color: #e2e8f0; font-weight: 500; }

.fin-bars { display: flex; align-items: flex-end; gap: .5rem; height: 140px; padding: .5rem 0; }
.fin-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .25rem; }
.fin-bar { width: 100%; border-radius: .35rem .35rem 0 0; min-height: 4px; transition: height .4s ease; }
.fin-bar-label { font-size: .6rem; color: #64748b; text-align: center; white-space: nowrap; }
.fin-bar-amount { font-size: .58rem; color: #94a3b8; text-align: center; }

.fin-artist { display: flex; align-items: center; gap: .65rem; padding: .55rem .75rem; background: var(--bg-card); border-radius: .6rem; margin-bottom: .4rem; cursor: pointer; transition: background .15s; border: 1px solid rgba(96,165,250,.05); }
.fin-artist:hover { background: rgba(15,23,42,.9); }
.fin-artist-rank { width: 1.6rem; height: 1.6rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 700; flex-shrink: 0; }
.fin-rank-1 { background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #1a1a2e; }
.fin-rank-2 { background: linear-gradient(135deg,#9ca3af,#6b7280); color: #fff; }
.fin-rank-3 { background: linear-gradient(135deg,#d97706,#b45309); color: #fff; }
.fin-rank-default { background: rgba(100,116,139,.2); color: #94a3b8; }
.fin-artist-name { flex: 1; font-size: .8rem; color: #e2e8f0; }
.fin-artist-rev { font-size: .82rem; font-weight: 600; color: var(--green); font-variant-numeric: tabular-nums; }
.fin-artist-count { font-size: .68rem; color: #64748b; margin-left: .5rem; white-space: nowrap; }

.fin-expense-row { margin-bottom: .45rem; }
.fin-expense-label { display: flex; justify-content: space-between; font-size: .75rem; color: #94a3b8; margin-bottom: .15rem; }
.fin-expense-bar-bg { height: 8px; background: rgba(255,255,255,.04); border-radius: 4px; overflow: hidden; }
.fin-expense-bar-fill { height: 100%; border-radius: 4px; transition: width .5s ease; }

.fin-upcoming { background: var(--bg-card); border-radius: .6rem; padding: .65rem .85rem; margin-bottom: .35rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(96,165,250,.05); }
.fin-upcoming-date { font-size: .72rem; color: #64748b; min-width: 4.5rem; }
.fin-upcoming-info { flex: 1; font-size: .78rem; color: #cbd5e1; margin: 0 .5rem; }
.fin-upcoming-amount { font-size: .82rem; font-weight: 600; color: var(--green); white-space: nowrap; }

.fin-month-nav { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
.fin-month-btn { background: rgba(96,165,250,.1); border: none; color: var(--accent); padding: .35rem .65rem; border-radius: .4rem; cursor: pointer; font-size: .8rem; }
.fin-month-btn:hover { background: rgba(96,165,250,.2); }
.fin-month-current { font-size: .95rem; font-weight: 600; color: #e2e8f0; }

.fin-loading { text-align: center; padding: 3rem 1rem; color: #64748b; font-size: .85rem; }
.fin-empty { color: #475569; font-size: .78rem; font-style: italic; padding: .5rem 0; }

.fin-spinner { display: inline-block; width: 1.2rem; height: 1.2rem; border: 2px solid rgba(96,165,250,.2); border-top-color: var(--accent); border-radius: 50%; animation: fin-spin .7s linear infinite; margin-right: .4rem; vertical-align: middle; }
@keyframes fin-spin { to { transform: rotate(360deg); } }
`;
// ============================================================
// SECTION 2: STATE ADDITIONS
// Add these properties to your existing `state` object,
// e.g. after state.todo or wherever convenient.
// ============================================================
// state.financeData = null;
// state.financeDetail = null;   // 'expected'|'actual'|'bank'|'artist:ID'|'cat:NAME'|null
// state.financeMonth = new Date().getMonth();
// state.financeLoading = false;
// ============================================================
// SECTION 3: TAB BUTTON
// Add this button HTML after the existing TODO tab button
// inside the render() function's tab bar area (~line 676).
// ============================================================
// <button class="tab ${state.tab==='finance'?'active':''}" onclick="setTab('finance')">[\u00a7] Finanzen</button>
// ============================================================
// SECTION 4: RENDER SWITCH
// In the render() function where content is built based on
// state.tab (~line 681), add this condition:
//   state.tab === 'finance' ? renderFinanceView() :
// ============================================================
// ============================================================
// SECTION 5: DATA LOADING
// Paste this function into the <script> block.
// Call it when the finance tab is first selected.
// ============================================================

async function loadFinanceData() {
  if (state.financeData && !state.financeData._stale) return;
  state.financeLoading = true;
  render();
  try {
    const [calRev, artRev, actRev, bankSum, finOv] = await Promise.all([
      db.collection('calendarRevenue').get(),
      db.collection('artistRevenue').get(),
      db.collection('actualRevenue').get(),
      db.collection('bankSummary').get(),
      db.collection('financialOverview').get()
    ]);
    const toArr = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.financeData = {
      calendarRevenue: toArr(calRev),
      artistRevenue: toArr(artRev),
      actualRevenue: toArr(actRev),
      bankSummary: toArr(bankSum),
      financialOverview: toArr(finOv),
      _ts: Date.now()
    };
  } catch (e) {
    console.error('Finance load error:', e);
    state.financeData = { calendarRevenue: [], artistRevenue: [], actualRevenue: [], bankSummary: [], financialOverview: [], _error: e.message };
  }
  state.financeLoading = false;
  render();
}
// ============================================================
// SECTION 6: RENDER + HELPERS
// Paste all of these into the <script> block.
// ============================================================

// -- Helpers --

const MONTH_NAMES_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_SHORT_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function eurFmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function numFmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('de-DE');
}

function toggleFinDetail(key) {
  state.financeDetail = state.financeDetail === key ? null : key;
  render();
}

function setFinMonth(dir) {
  state.financeMonth = Math.max(0, Math.min(11, state.financeMonth + dir));
  state.financeDetail = null;
  render();
}

function finGetOverview(m) {
  if (!state.financeData) return null;
  return state.financeData.financialOverview.find(r => r.month === m && r.year === new Date().getFullYear()) || null;
}

function finGetBank(m) {
  if (!state.financeData) return null;
  return state.financeData.bankSummary.find(r => r.month === m && r.year === new Date().getFullYear()) || null;
}

function finGetActual(m, loc) {
  if (!state.financeData) return null;
  return state.financeData.actualRevenue.find(r => r.month === m && r.year === new Date().getFullYear() && (!loc || r.location === loc)) || null;
}

function finGetCalendar(m, loc) {
  if (!state.financeData) return [];
  return state.financeData.calendarRevenue.filter(r => r.month === m && (!loc || r.location === loc));
}

function finGetArtists(m) {
  if (!state.financeData) return [];
  return state.financeData.artistRevenue.filter(r => r.month === m).sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
}

// -- Badge for liquidity --
function liquidityBadge(status) {
  if (!status) return '<span class="fin-badge fin-badge-yellow">Keine Daten</span>';
  const s = status.toLowerCase();
  if (s.includes('gut') || s.includes('positiv') || s.includes('good')) return `<span class="fin-badge fin-badge-green">${status}</span>`;
  if (s.includes('kritisch') || s.includes('negativ') || s.includes('bad')) return `<span class="fin-badge fin-badge-red">${status}</span>`;
  return `<span class="fin-badge fin-badge-yellow">${status}</span>`;
}

// -- Expense color palette --
function expenseColor(i) {
  const colors = ['#60a5fa','#f472b6','#a78bfa','#fb923c','#34d399','#fbbf24','#e879f9','#38bdf8','#f87171','#4ade80'];
  return colors[i % colors.length];
}
// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

function renderFinanceView() {
  if (state.financeLoading) {
    return `<div class="fin-loading"><span class="fin-spinner"></span> Finanzdaten werden geladen\u2026</div>`;
  }
  if (!state.financeData) {
    // Trigger load on first render
    setTimeout(() => loadFinanceData(), 0);
    return `<div class="fin-loading"><span class="fin-spinner"></span> Finanzdaten werden geladen\u2026</div>`;
  }
  if (state.financeData._error) {
    return `<div class="fin-loading" style="color:var(--red);">\u26a0 Fehler beim Laden: ${state.financeData._error}</div>`;
  }

  const m = state.financeMonth;
  const ov = finGetOverview(m);
  const bank = finGetBank(m);
  const artists = finGetArtists(m);

  return `
    ${renderFinMonthNav(m)}
    ${renderFinQuickCards(m, ov, bank)}
    ${renderFinCompare(m, ov)}
    ${renderFinMonthChart(m)}
    ${renderFinArtists(m, artists)}
    ${renderFinExpenses(m, bank)}
    ${renderFinUpcoming(m)}
  `;
}
// -- Month Navigation --
function renderFinMonthNav(m) {
  return `
  <div class="fin-month-nav">
    <button class="fin-month-btn" onclick="setFinMonth(-1)" ${m===0?'disabled':''}>&#9664;</button>
    <span class="fin-month-current">${MONTH_NAMES_DE[m]} ${new Date().getFullYear()}</span>
    <button class="fin-month-btn" onclick="setFinMonth(1)" ${m===11?'disabled':''}>&#9654;</button>
  </div>`;
}
// -- Quick Finance Cards --
function renderFinQuickCards(m, ov, bank) {
  const expected = ov ? (ov.expectedRevenue_total || 0) : 0;
  const actual = ov ? (ov.actualRevenue_total || 0) : 0;
  const income = bank ? (bank.totalIncome || 0) : 0;
  const expenses = bank ? (bank.totalExpenses || 0) : 0;
  const liq = ov ? ov.liquidityStatus : null;
  const det = state.financeDetail;

  // Detail panels
  const expectedDetail = det === 'expected' ? renderExpectedDetail(m) : '';
  const actualDetail = det === 'actual' ? renderActualDetail(m) : '';
  const bankDetail = det === 'bank' ? renderBankDetail(bank) : '';

  return `
  <div class="fin-grid">
    <div>
      <div class="fin-card" onclick="toggleFinDetail('expected')">
        <div class="fin-card-label">\ud83d\udcc5 Erwarteter Umsatz</div>
        <div class="fin-card-value">${eurFmt(expected)}</div>
        <div class="fin-card-sub">aus Kalender-Terminen</div>
      </div>
      <div class="fin-detail ${det==='expected'?'open':''}">${expectedDetail}</div>
    </div>
    <div>
      <div class="fin-card" onclick="toggleFinDetail('actual')">
        <div class="fin-card-label">\ud83d\udcb0 Tatsächlicher Umsatz</div>
        <div class="fin-card-value" style="color:var(--green)">${eurFmt(actual)}</div>
        <div class="fin-card-sub">aus Tagesabrechnungen</div>
      </div>
      <div class="fin-detail ${det==='actual'?'open':''}">${actualDetail}</div>
    </div>
    <div>
      <div class="fin-card" onclick="toggleFinDetail('bank')">
        <div class="fin-card-label">\ud83c\udfe6 Bank</div>
        <div class="fin-card-value">${eurFmt(income)}</div>
        <div class="fin-card-sub">Ausgaben: <span style="color:var(--red)">${eurFmt(Math.abs(expenses))}</span></div>
      </div>
      <div class="fin-detail ${det==='bank'?'open':''}">${bankDetail}</div>
    </div>
    <div>
      <div class="fin-card" style="cursor:default">
        <div class="fin-card-label">\ud83d\udca7 Liquidität</div>
        <div style="margin-top:.4rem">${liquidityBadge(liq)}</div>
        <div class="fin-card-sub">Netto: ${bank ? eurFmt(bank.netCashflow) : '—'}</div>
      </div>
    </div>
  </div>`;
}

// Detail: Expected Revenue breakdown by location
function renderExpectedDetail(m) {
  const achern = finGetCalendar(m, 'achern');
  const weil = finGetCalendar(m, 'weil');
  const row = (loc, data) => {
    if (!data.length) return `<tr><td>${loc}</td><td>—</td></tr>`;
    const d = data[0];
    return `<tr><td>${loc}</td><td>${eurFmt(d.totalRevenue)}</td></tr>
            <tr><td style="padding-left:1rem;color:#475569">Anzahlungen</td><td>${eurFmt(d.totalDeposit)}</td></tr>
            <tr><td style="padding-left:1rem;color:#475569">Termine</td><td>${numFmt(d.totalAppointments)}</td></tr>
            <tr><td style="padding-left:1rem;color:#475569">Rest offen</td><td>${eurFmt(d.totalRemaining)}</td></tr>`;
  };
  return `<table><thead><tr><th>Standort</th><th style="text-align:right">Betrag</th></tr></thead>
    <tbody>${row('Achern', achern)}${row('Weil am Rhein', weil)}</tbody></table>`;
}

// Detail: Actual Revenue breakdown
function renderActualDetail(m) {
  const recs = state.financeData.actualRevenue.filter(r => r.month === m && r.year === new Date().getFullYear());
  if (!recs.length) return '<div class="fin-empty">Keine Daten für diesen Monat</div>';
  return recs.map(r => `
    <div style="margin-bottom:.5rem">
      <div style="font-size:.75rem;font-weight:600;color:var(--accent);margin-bottom:.3rem">${r.location === 'achern' ? 'Achern' : 'Weil am Rhein'}</div>
      <table>
        <tr><td>Bar</td><td>${eurFmt(r.totalBar)}</td></tr>
        <tr><td>Karte</td><td>${eurFmt(r.totalKarte)}</td></tr>
        <tr><td>PayPal</td><td>${eurFmt(r.totalPayPal)}</td></tr>
        <tr><td>Beautinda</td><td>${eurFmt(r.totalBeautinda)}</td></tr>
        <tr><td>Gutscheine</td><td>${eurFmt(r.totalGutschein)}</td></tr>
        <tr><td>Tagesumsatz</td><td>${eurFmt(r.totalTagesumsatz)}</td></tr>
        <tr><td>Anzahlungen</td><td>${eurFmt(r.totalAnzahlungen)}</td></tr>
        <tr><td>Restzahlungen</td><td>${eurFmt(r.totalRestzahlungen)}</td></tr>
        <tr><td style="color:var(--red)">Vorschüsse</td><td style="color:var(--red)">${eurFmt(r.totalVorschuesse)}</td></tr>
        <tr><td style="color:var(--red)">Ausgaben</td><td style="color:var(--red)">${eurFmt(r.totalAusgaben)}</td></tr>
        <tr><td style="color:#64748b">Tage mit Daten</td><td>${r.daysWithData || '—'}</td></tr>
      </table>
    </div>
  `).join('');
}

// Detail: Bank categories
function renderBankDetail(bank) {
  if (!bank || !bank.categories) return '<div class="fin-empty">Keine Bankdaten</div>';
  const cats = bank.categories;
  const entries = Object.entries(cats).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!entries.length) return '<div class="fin-empty">Keine Kategorien</div>';
  return `<table><thead><tr><th>Kategorie</th><th style="text-align:right">Betrag</th></tr></thead><tbody>
    ${entries.map(([k, v]) => `<tr><td>${k}</td><td style="color:${v < 0 ? 'var(--red)' : 'var(--green)'}">${eurFmt(v)}</td></tr>`).join('')}
    </tbody></table>
    <div style="font-size:.68rem;color:#475569;margin-top:.3rem">${bank.transactionCount || 0} Transaktionen</div>`;
}
// -- Standort-Vergleich --
function renderFinCompare(m, ov) {
  const calA = finGetCalendar(m, 'achern')[0];
  const calW = finGetCalendar(m, 'weil')[0];
  const locCard = (name, cal, expRev, actRev) => {
    return `
    <div class="fin-loc-card">
      <div class="fin-loc-name">${name}</div>
      <div class="fin-loc-row"><span>Erwartet</span><span>${eurFmt(expRev)}</span></div>
      <div class="fin-loc-row"><span>Tatsächlich</span><span style="color:var(--green)">${eurFmt(actRev)}</span></div>
      <div class="fin-loc-row"><span>Termine</span><span>${cal ? numFmt(cal.totalAppointments) : '—'}</span></div>
      <div class="fin-loc-row"><span>Anzahlungen</span><span>${cal ? eurFmt(cal.totalDeposit) : '—'}</span></div>
      <div class="fin-loc-row"><span>Events m/ Umsatz</span><span>${cal ? numFmt(cal.eventsWithRevenue) : '—'}</span></div>
    </div>`;
  };
  return `
  <div class="fin-section">
    <div class="fin-section-title">\ud83d\udccd Standort-Vergleich</div>
    <div class="fin-compare">
      ${locCard('Achern', calA, ov?.expectedRevenue_achern, ov?.actualRevenue_achern)}
      ${locCard('Weil am Rhein', calW, ov?.expectedRevenue_weil, ov?.actualRevenue_weil)}
    </div>
  </div>`;
}
// -- Month Chart (6 months) --
function renderFinMonthChart(m) {
  const year = new Date().getFullYear();
  const now = new Date().getMonth();
  // Show 3 before + current + 2 after (clamped to 0-11)
  const start = Math.max(0, m - 3);
  const end = Math.min(11, m + 2);
  const months = [];
  for (let i = start; i <= end; i++) months.push(i);

  // Gather values
  const vals = months.map(mi => {
    const ov = state.financeData.financialOverview.find(r => r.month === mi && r.year === year);
    const actual = ov ? (ov.actualRevenue_total || 0) : 0;
    const expected = ov ? (ov.expectedRevenue_total || 0) : 0;
    return { month: mi, actual, expected, value: mi <= now ? actual : expected };
  });
  const maxVal = Math.max(...vals.map(v => v.value), 1);

  const bars = vals.map(v => {
    const pct = Math.round((v.value / maxVal) * 100);
    let color = 'rgba(100,116,139,.35)'; // future = gray
    if (v.month < now) color = 'var(--green)';
    if (v.month === now) color = 'var(--accent)';
    const isCurrent = v.month === m;
    return `
    <div class="fin-bar-col">
      <div class="fin-bar-amount">${v.value > 0 ? eurFmt(v.value) : ''}</div>
      <div class="fin-bar" style="height:${Math.max(pct, 3)}%;background:${color};${isCurrent ? 'box-shadow:0 0 8px rgba(96,165,250,.4);' : ''}"></div>
      <div class="fin-bar-label" style="${isCurrent ? 'color:#e2e8f0;font-weight:600' : ''}">${MONTH_SHORT_DE[v.month]}</div>
    </div>`;
  }).join('');

  return `
  <div class="fin-section">
    <div class="fin-section-title">\ud83d\udcc8 Monatsverlauf</div>
    <div style="display:flex;gap:.75rem;font-size:.6rem;color:#64748b;margin-bottom:.35rem">
      <span>\u25cf <span style="color:var(--green)">Tatsächlich</span></span>
      <span>\u25cf <span style="color:var(--accent)">Aktuell</span></span>
      <span>\u25cf <span style="color:rgba(100,116,139,.6)">Erwartet</span></span>
    </div>
    <div class="fin-bars">${bars}</div>
  </div>`;
}
// -- Künstler-Ranking --
function renderFinArtists(m, artists) {
  if (!artists.length) {
    return `<div class="fin-section">
      <div class="fin-section-title">\ud83c\udfc6 Künstler-Ranking</div>
      <div class="fin-empty">Keine Künstlerdaten für ${MONTH_NAMES_DE[m]}</div>
    </div>`;
  }
  const det = state.financeDetail;
  const rows = artists.map((a, i) => {
    const rank = i + 1;
    const rc = rank === 1 ? 'fin-rank-1' : rank === 2 ? 'fin-rank-2' : rank === 3 ? 'fin-rank-3' : 'fin-rank-default';
    const key = 'artist:' + a.artistId;
    const isOpen = det === key;
    let detail = '';
    if (isOpen && a.events && a.events.length) {
      detail = `<div class="fin-detail open" style="margin:0 0 .3rem 2.3rem;max-height:400px">
        <table><thead><tr><th>Termin</th><th style="text-align:right">Umsatz</th></tr></thead><tbody>
        ${a.events.slice(0, 20).map(ev => `<tr><td style="font-size:.72rem">${ev.title || ev.summary || '—'}</td><td>${eurFmt(ev.revenue || ev.price || 0)}</td></tr>`).join('')}
        </tbody></table>
      </div>`;
    } else if (isOpen) {
      detail = `<div class="fin-detail open" style="margin:0 0 .3rem 2.3rem"><div class="fin-empty">Keine Event-Details</div></div>`;
    }
    return `
    <div class="fin-artist" onclick="toggleFinDetail('${key}')">
      <div class="fin-artist-rank ${rc}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
      <div class="fin-artist-name">${a.artistName || 'Unbekannt'}</div>
      <div class="fin-artist-rev">${eurFmt(a.totalRevenue)}</div>
      <div class="fin-artist-count">${a.eventCount || 0} Termine</div>
    </div>${detail}`;
  }).join('');

  return `
  <div class="fin-section">
    <div class="fin-section-title">\ud83c\udfc6 Künstler-Ranking</div>
    ${rows}
  </div>`;
}
// -- Ausgaben-Kategorien --
function renderFinExpenses(m, bank) {
  if (!bank || !bank.categories) {
    return `<div class="fin-section">
      <div class="fin-section-title">\ud83d\udcca Ausgaben-Kategorien</div>
      <div class="fin-empty">Keine Bankdaten für ${MONTH_NAMES_DE[m]}</div>
    </div>`;
  }
  const cats = bank.categories;
  const entries = Object.entries(cats)
    .filter(([, v]) => v < 0)
    .map(([k, v]) => [k, Math.abs(v)])
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return `<div class="fin-section">
      <div class="fin-section-title">\ud83d\udcca Ausgaben-Kategorien</div>
      <div class="fin-empty">Keine Ausgaben-Kategorien</div>
    </div>`;
  }
  const maxExp = entries[0][1];
  const bars = entries.map(([cat, val], i) => {
    const pct = Math.round((val / maxExp) * 100);
    return `
    <div class="fin-expense-row">
      <div class="fin-expense-label"><span>${cat}</span><span>${eurFmt(val)}</span></div>
      <div class="fin-expense-bar-bg"><div class="fin-expense-bar-fill" style="width:${pct}%;background:${expenseColor(i)}"></div></div>
    </div>`;
  }).join('');

  return `
  <div class="fin-section">
    <div class="fin-section-title">\ud83d\udcca Ausgaben-Kategorien</div>
    ${bars}
  </div>`;
}
// -- Was kommt rein? (next 7 days) --
function renderFinUpcoming(m) {
  const now = new Date();
  const calData = state.financeData.calendarRevenue.filter(r => r.month === m);
  // Collect upcoming events from calendar data
  let upcoming = [];
  calData.forEach(r => {
    if (!r.events) return;
    let events = r.events;
    if (typeof events === 'string') {
      try { events = JSON.parse(events); } catch(e) { return; }
    }
    if (!Array.isArray(events)) return;
    events.forEach(ev => {
      const d = ev.start || ev.date || ev.startDate;
      if (!d) return;
      const evDate = new Date(d);
      const diffDays = (evDate - now) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 7) {
        upcoming.push({ date: evDate, title: ev.title || ev.summary || 'Termin', revenue: ev.revenue || ev.price || 0, location: r.location });
      }
    });
  });

  // Also try parsing eventsJson if events array was empty
  calData.forEach(r => {
    if (r.eventsJson && (!r.events || !r.events.length)) {
      try {
        const parsed = JSON.parse(r.eventsJson);
        if (Array.isArray(parsed)) {
          parsed.forEach(ev => {
            const d = ev.start || ev.date || ev.startDate;
            if (!d) return;
            const evDate = new Date(d);
            const diffDays = (evDate - now) / (1000 * 60 * 60 * 24);
            if (diffDays >= 0 && diffDays <= 7) {
              upcoming.push({ date: evDate, title: ev.title || ev.summary || 'Termin', revenue: ev.revenue || ev.price || 0, location: r.location });
            }
          });
        }
      } catch(e) { /* skip */ }
    }
  });

  // Deduplicate by title+date
  const seen = new Set();
  upcoming = upcoming.filter(u => {
    const key = u.title + u.date.toISOString().slice(0,10);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  upcoming.sort((a, b) => a.date - b.date);
  const dayFmt = d => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

  if (!upcoming.length) {
    return `<div class="fin-section">
      <div class="fin-section-title">\ud83d\udcc5 Was kommt rein? <span style="font-weight:400;color:#64748b;font-size:.7rem">(nächste 7 Tage)</span></div>
      <div class="fin-empty">Keine anstehenden Termine mit Umsatz</div>
    </div>`;
  }

  const total = upcoming.reduce((s, u) => s + (u.revenue || 0), 0);
  const rows = upcoming.slice(0, 12).map(u => `
    <div class="fin-upcoming">
      <div class="fin-upcoming-date">${dayFmt(u.date)}</div>
      <div class="fin-upcoming-info">${u.title} <span style="color:#475569;font-size:.65rem">${u.location === 'achern' ? 'AC' : 'WE'}</span></div>
      <div class="fin-upcoming-amount">${u.revenue > 0 ? eurFmt(u.revenue) : '—'}</div>
    </div>`).join('');

  return `
  <div class="fin-section">
    <div class="fin-section-title">\ud83d\udcc5 Was kommt rein? <span style="font-weight:400;color:#64748b;font-size:.7rem">(nächste 7 Tage · ${eurFmt(total)} erwartet)</span></div>
    ${rows}
  </div>`;
}
// ============================================================
// SECTION 7: CSS INJECTION HELPER
// Call this once at startup or when the finance tab loads.
// ============================================================

function injectFinanceCSS() {
  if (document.getElementById('finance-css')) return;
  const style = document.createElement('style');
  style.id = 'finance-css';
  style.textContent = FINANCE_CSS;
  document.head.appendChild(style);
}
// ============================================================
// SECTION 8: MODIFIED setTab() HOOK
// In your existing setTab() function, add this BEFORE render():
//
//   if (tab === 'finance') {
//     injectFinanceCSS();
//     loadFinanceData();
//   }
//
// This ensures CSS is injected and data loads on first visit.
// ============================================================
// ============================================================
// QUICK INTEGRATION CHECKLIST
// ============================================================
//
// 1. STATE — Add to your state object:
//      state.financeData = null;
//      state.financeDetail = null;
//      state.financeMonth = new Date().getMonth();
//      state.financeLoading = false;
//
// 2. TAB BUTTON — In render(), add after TODO button:
//      <button class="tab ${state.tab==='finance'?'active':''}"
//        onclick="setTab('finance')">[§] Finanzen</button>
//
// 3. CONTENT SWITCH — In render(), add in template literal:
//      ${state.tab === 'finance' ? renderFinanceView() : ''}
//
// 4. setTab() — Add before render() call:
//      if (tab === 'finance') {
//        injectFinanceCSS();
//        loadFinanceData();
//      }
//
// 5. PASTE all functions from this file into your <script> block:
//      FINANCE_CSS, injectFinanceCSS, loadFinanceData,
//      renderFinanceView, and all render/helper functions.
//
// That's it — no external dependencies needed.
// ============================================================
