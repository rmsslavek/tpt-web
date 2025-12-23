import { db, currentUser } from './storage.js';

function main() {
  const dataEl = document.getElementById('problemData');
  if (!dataEl) return;

  // očisti query string (da kod iz textarea ne završi u URL-u)
  if (location.search) {
    history.replaceState(null, '', location.origin + location.pathname + location.hash);
  }

  const parsed = safeParse(dataEl.textContent || '{}', {});
  const problem = parsed.problem || null;
  const tests = Array.isArray(parsed.tests) ? parsed.tests : [];
  const isAdmin = !!parsed.isAdmin;

  const form = document.getElementById('submitForm');
  const adminBox = document.getElementById('testsAdmin');
  const addTestForm = document.getElementById('addTestForm');
  const verdictEl = document.getElementById('verdict');

  if (adminBox) {
    renderTestsAdmin();
    addTestForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(addTestForm).entries());
      tests.push({ id: 'T' + Date.now(), in: data.input || '', out: data.output || '' });
      persistTests(tests);
      addTestForm.reset();
      renderTestsAdmin();
    });
  }

  function persistTests(updated) {
    const problems = JSON.parse(localStorage.getItem('ca_problems') || '[]');
    const idx = problems.findIndex((pp) => pp.id === problem.id);
    if (idx >= 0) {
      problems[idx] = { ...problems[idx], tests: updated };
      db.saveProblems(problems);
    }
  }

  function renderTestsAdmin() {
    if (!adminBox) return;
    adminBox.innerHTML =
      tests.length
        ? tests
            .map(
              (t) =>
                '<div class="panel" style="margin-bottom:.4rem">' +
                '<div class="muted">ID: ' +
                t.id +
                '</div>' +
                '<pre style="white-space:pre-wrap">INPUT:\\n' +
                escapeHtml(t.in || '') +
                '</pre>' +
                '<pre style="white-space:pre-wrap">OUTPUT:\\n' +
                escapeHtml(t.out || '') +
                '</pre>' +
                '<button class="btn warn" data-del="' +
                t.id +
                '">Ukloni</button>' +
                '</div>'
            )
            .join('')
        : '<p class="muted">Nema test primera.</p>';
    adminBox.querySelectorAll('[data-del]')?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del');
        const i = tests.findIndex((x) => x.id === id);
        if (i >= 0) {
          tests.splice(i, 1);
          persistTests(tests);
          renderTestsAdmin();
        }
      });
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!tests.length) {
        if (verdictEl) verdictEl.innerHTML = '<p class="status wa">Nema definisanih testova za ovaj problem.</p>';
        return;
      }
    const data = Object.fromEntries(new FormData(form).entries());
    const code = data.source || '';
    if (verdictEl) verdictEl.innerHTML = '<p class="status pd">Pokrećem Piston...</p>';

      let verdict = 'AC';
      const results = [];
      let firstFail = null;
      for (let i = 0; i < tests.length; i++) {
        const t0 = performance.now();
        let resp;
        try {
          const res = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: 'cpp',
              version: '10.2.0',
              files: [{ name: 'main.cpp', content: code }],
              stdin: tests[i].in || '',
            }),
          });
          resp = await res.json();
        } catch (err) {
          console.error('Piston fetch error', err);
          if (verdictEl) verdictEl.innerHTML = '<p class="status wa">Greška u pozivu Piston API-ja</p><pre>' + String(err) + '</pre>';
          saveSubmission('CE', 'Piston API error');
          return;
        }
        const t1 = performance.now();
        const run = resp?.run || {};
        const stdout = String(run.output || run.stdout || '').trim();
        const stderr = String(run.stderr || '').trim();
        const expected = String(tests[i].out || '').trim();
        const ms = Math.round(t1 - t0);
        const ok = !stderr && stdout === expected;
        results.push({
          idx: i + 1,
          ok,
          rawMs: ms,
          stdout,
          expected,
          stderr,
          isSample: !!tests[i].isSample,
          testId: tests[i].id || ''
        });
        if (!ok) {
          verdict = 'WA';
          firstFail = results[results.length - 1];
          break;
        }
      }

      // Novi nacin racunanja vremena: sample = 0 ms; ostalo = (raw - baseline), min 1 ms ako negativno.
      const sampleBaseline = Math.max(0, ...results.filter((r) => r.isSample).map((r) => r.rawMs || 0), 0);
      results.forEach((r) => {
        r.ms = r.isSample ? 0 : Math.max(1, (r.rawMs || 0) - sampleBaseline);
      });
      const longestAdjusted = Math.max(0, ...results.filter((r) => !r.isSample).map((r) => r.ms || 0), 0);
      const adjustedRuntime = Math.max(1, longestAdjusted);
      firstFail = results.find((r) => !r.ok) || null;

      if (firstFail) {
        if (verdictEl) verdictEl.innerHTML =
          '<p class="status wa">Wrong Answer na testu #' +
          firstFail.idx +
          (firstFail.isSample ? ' (primer)' : '') +
          ' (' +
          firstFail.ms +
          ' ms) -' +
          (firstFail.testId || '') +
          '</p>' +
          (firstFail.stderr ? '<pre>' + escapeHtml(firstFail.stderr) + '</pre>' : '') +
          '<pre>Očekivano:\\n' +
          escapeHtml(firstFail.expected) +
          '</pre>' +
          '<pre>Dobijeno:\\n' +
          escapeHtml(firstFail.stdout) +
          '</pre>' +
          renderSummary(results);
      } else {
        if (verdictEl) verdictEl.innerHTML = '<p class="status ac">Accepted (' + adjustedRuntime + ' ms)</p>' + renderSummary(results);
      }
      saveSubmission(verdict, firstFail ? 'WA na testu #' + firstFail.idx : 'Accepted');

      function saveSubmission(code, text) {
        const store = JSON.parse(localStorage.getItem('ca_submissions') || '[]');
        store.unshift({
          id: 'S' + Date.now(),
          problemId: problem.id,
          time: Date.now(),
          lang: 'cpp',
          verdict: code,
          verdictText: text,
          length: (data.source || '').length,
          handle: (currentUser()?.handle || 'guest'),
        });
        localStorage.setItem('ca_submissions', JSON.stringify(store));
      }

      function renderSummary(list) {
        if (!list?.length) return '';
        const samples = list.filter((r) => r.isSample);
        const hidden = list.filter((r) => !r.isSample);
        const renderGroup = (arr, label) =>
          arr.length
            ? '<div style="margin-top:.2rem"><b>' +
              label +
              ':</b><ul style="padding-left:18px;margin:.1rem 0;">' +
              arr.map((r) => '<li>Test #' + r.idx + ': ' + (r.ok ? '✔' : '✖') + ' (' + r.ms + ' ms)</li>').join('') +
              '</ul></div>'
            : '';
        return (
          '<div style="margin-top:.4rem"><b>Rezime testova:</b>' +
          renderGroup(samples, 'Primeri') +
          renderGroup(hidden, 'Skriveni testovi') +
          '</div>'
        );
      }
    });
  }
}

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

main();

