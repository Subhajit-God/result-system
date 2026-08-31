/* ============================================================
   portal.js — Public Result Portal.

   This is a completely separate site from the admin app: no admin
   login, no IndexedDB, no write access. It only ever calls the
   'publicLookup' action on the same Apps Script backend, using
   PUBLIC_TOKEN — a read-only, single-student-only credential that
   is safe to ship in this public page's source. It is NOT the
   admin app's ACCESS_TOKEN; never put that token here.
   ============================================================ */

const PORTAL_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwhFSxfrvc5kUus7IbVUVyHXqsWKly0In5OJ7BUk5J67MUgdiRx08fWsZQD1Y07KkE/exec',
  publicToken: '0987654321'
};

async function lookupResult(studentId, dob, evaluation) {
  if (!PORTAL_CONFIG.appsScriptUrl || PORTAL_CONFIG.appsScriptUrl.startsWith('PASTE-')) {
    throw new Error('This portal has not been connected to a school system yet. Contact your school.');
  }
  const res = await fetch(PORTAL_CONFIG.appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'publicLookup', token: PORTAL_CONFIG.publicToken, studentId, dob, evaluation })
  });
  if (!res.ok) throw new Error('Could not reach the result server (HTTP ' + res.status + ').');
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

document.getElementById('lookup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('in-studentId').value.trim();
  const dob = document.getElementById('in-dob').value.trim();
  const evaluation = document.getElementById('in-evaluation').value;
  const alertBox = document.getElementById('lookup-alert');
  const btn = document.getElementById('lookup-btn');

  alertBox.innerHTML = '';
  document.getElementById('result-card').style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Checking…';

  try {
    const result = await lookupResult(studentId, dob, evaluation);
    renderResult(result);
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-err">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check Result';
  }
});

function renderResult(r) {
  document.getElementById('portal-school-name').textContent = r.schoolName || 'Result Portal';

  const card = document.getElementById('result-card');
  const infoPairs = [
    ['Student ID', r.student.studentId], ['Full Name', r.student.fullName],
    ['Class', r.student.class], ['Section', r.student.section],
    ['Roll Number', r.student.roll], ['Date of Birth', r.student.dob],
    ["Father's Name", r.student.fatherName], ["Mother's Name", r.student.motherName]
  ];

  card.innerHTML = `
    <div class="result-header">
      ${r.schoolLogoDataUrl ? `<img src="${escapeHtml(r.schoolLogoDataUrl)}" alt="School logo">` : ''}
      <div>
        <h2>${escapeHtml(r.schoolName || '')}</h2>
        <p>${escapeHtml(r.resultHeading || 'Summative Evaluation')} — ${escapeHtml(r.evaluation)} · Session ${escapeHtml(r.academicSession || '')}</p>
      </div>
    </div>

    <div class="info-grid">
      ${infoPairs.map(([l, v]) => `<div><div class="lbl">${l}</div><div class="val">${escapeHtml(v)}</div></div>`).join('')}
    </div>

    <table class="marks-table">
      <thead><tr><th>Subject</th><th class="num">Full Marks</th><th class="num">Theory</th><th class="num">Practical</th><th class="num">Obtained</th></tr></thead>
      <tbody>
        ${r.bySubject.map(s => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.fullMarks}</td>
            <td class="num">${s.structure === 'practical_only' ? '—' : s.theory}</td>
            <td class="num">${s.structure === 'theory_only' ? '—' : s.practical}</td>
            <td class="num">${s.entered ? s.obtained : 'Not entered'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary-stats">
      <div><div class="stat-lbl">Total</div><div class="stat-val">${r.obtainedTotal}/${r.fullMarksTotal}</div></div>
      <div><div class="stat-lbl">Percentage</div><div class="stat-val">${r.percentage}%</div></div>
      <div><div class="stat-lbl">Grade</div><div class="stat-val">${escapeHtml(r.grade) || '—'}</div></div>
      <div><div class="stat-lbl">Rank</div><div class="stat-val">${r.rank != null ? '#' + r.rank : (r.tied ? 'Pending' : '—')}</div></div>
    </div>

    ${r.remarks ? `<div class="alert alert-info"><b>Remarks:</b> ${escapeHtml(r.remarks)}</div>` : ''}

    <div style="display:flex;gap:10px;">
      <button class="btn" id="print-btn" style="width:auto;flex:1;" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn btn-ghost" id="new-search-btn" style="width:auto;flex:1;" onclick="document.getElementById('result-card').style.display='none';">New search</button>
    </div>
  `;
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
  return (str ?? '').toString().replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

// Prefill Student ID + Evaluation from a QR code / verification link
// (?sid=...&ev=...) — DOB is never in the link and must still be typed.
(function prefillFromUrl() {
  const params = new URLSearchParams(location.search);
  const sid = params.get('sid');
  const ev = params.get('ev');
  if (sid) document.getElementById('in-studentId').value = sid;
  if (ev) {
    const select = document.getElementById('in-evaluation');
    if ([...select.options].some(o => o.value === ev)) select.value = ev;
  }
  if (sid) document.getElementById('in-dob').focus();
})();
