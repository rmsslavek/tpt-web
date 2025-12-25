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
    const stressChk = addTestForm?.querySelector('[name="stress"]');
    const stressOn = addTestForm?.querySelector('[data-stress-on]');
    const stressOff = addTestForm?.querySelector('[data-stress-off]');
    const syncStress = () => {
      const on = stressChk?.checked;
      if (stressOn) stressOn.style.display = on ? 'flex' : 'none';
      if (stressOff) stressOff.style.display = on ? 'none' : 'block';
    };
    stressChk?.addEventListener('change', syncStress);
    syncStress();
    addTestForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(addTestForm);
      const id = (fd.get('id') || ('T' + Date.now())).toString().trim();
      const stress = fd.get('stress') === 'on';
      let input = (fd.get('input') || '').toString();
      let output = (fd.get('output') || '').toString();
      if (stress) {
        const inputFile = fd.get('inputFile');
        const outputFile = fd.get('outputFile');
        if (inputFile && inputFile.text) input = await inputFile.text();
        if (outputFile && outputFile.text) output = await outputFile.text();
        if (!input || !output) {
          alert('Za stress test dodajte ulaz i izlaz (upload ili tekst).');
          return;
        }
        const order = String(tests.length + 1).padStart(2, '0');
        tests.push({
          id: id || 'T' + Date.now(),
          in: input,
          out: output,
          isStress: true,
          inputFile: 'in' + order + '.txt',
          outputFile: 'out' + order + '.txt',
        });
      } else {
        if (!input || !output) {
          alert('Popunite ulaz i izlaz testa.');
          return;
        }
        tests.push({ id: id || 'T' + Date.now(), in: input, out: output });
      }
      persistTests(tests);
      addTestForm.reset();
      syncStress();
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
    const fmtBlock = (label, content, fileName) => {
      const big = (content || '').length > 2048;
      if (big) {
        return '<pre style="white-space:pre-wrap">FILE ' + (fileName || '') + ' (~' + (content||'').length + ' chars)</pre>';
      }
      return '<pre style="white-space:pre-wrap">' + label + ':\\n' + escapeHtml(content || '') + '</pre>';
    };
    adminBox.innerHTML =
      tests.length
        ? tests
            .map(
              (t) =>
                '<div class="panel" style="margin-bottom:.4rem">' +
                '<div class="muted">ID: ' +
                t.id +
                '</div>' +
                fmtBlock('INPUT', t.in, t.inputFile) +
                fmtBlock('OUTPUT', t.out, t.outputFile) +
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
    const langKey = (data.language || 'cpp').toLowerCase();
    const langMap = {
      cpp: { language: 'cpp', version: '10.2.0', fileName: 'main.cpp' },
      python: { language: 'python', version: '3.10.0', fileName: 'main.py' },
    };
    const langCfg = langMap[langKey] || langMap.cpp;

    let animTimer = null;
    let bitTimer = null;
    let dotCount = 0;
    const submitBtn = form.querySelector('button[type="submit"]');
    const bitsCanvas = submitBtn?.querySelector('.bits');
    const bitsCtx = bitsCanvas ? bitsCanvas.getContext('2d') : null;

    const clearBits = () => {
      if (bitsCtx && bitsCanvas) {
        bitsCtx.clearRect(0, 0, bitsCanvas.width, bitsCanvas.height);
      }
    };

    const stopAnim = () => {
      if (animTimer) clearInterval(animTimer);
      if (bitTimer) clearInterval(bitTimer);
      animTimer = null;
      bitTimer = null;
      dotCount = 0;
      clearBits();
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    };

    const startBits = () => {
      if (!bitsCtx || !bitsCanvas) return;
      bitTimer = setInterval(() => {
        bitsCtx.fillStyle = 'rgba(0,0,0,0.08)';
        bitsCtx.fillRect(0, 0, bitsCanvas.width, bitsCanvas.height);
        const x = Math.random() * bitsCanvas.width;
        const y = Math.random() * bitsCanvas.height;
        bitsCtx.fillStyle = '#00ff99';
        bitsCtx.font = '16px monospace';
        bitsCtx.fillText(Math.random() > 0.5 ? '1' : '0', x, y);
      }, 80);
    };

    const startAnim = () => {
      dotCount = 0;
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
      }
      if (verdictEl) verdictEl.innerHTML = '<p class="status pd">$ testiram kod</p>';
      startBits();
      animTimer = setInterval(() => {
        dotCount = dotCount >= 35 ? 1 : dotCount + 1;
        const dots = '.'.repeat(dotCount);
        if (verdictEl) verdictEl.innerHTML = '<p class="status pd">$ testiram kod' + dots + '</p>';
      }, 1000);
    };
    startAnim();

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
              language: langCfg.language,
              version: langCfg.version,
              files: [{ name: langCfg.fileName, content: code }],
              stdin: tests[i].in || '',
            }),
          });
          resp = await res.json();
        } catch (err) {
          console.error('Piston fetch error', err);
          stopAnim();
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
        stopAnim();
        if (verdictEl) {
          let msg =
            '<p class="status wa">Wrong Answer na testu #' +
            firstFail.idx +
            (firstFail.isSample ? ' (primer)' : '') +
            ' (' +
            firstFail.ms +
            ' ms) -' +
            (firstFail.testId || '') +
            '</p>';
          if (firstFail.stderr) {
            msg += '<p class="status wa">Greška izvršavanja:</p><pre>' + escapeHtml(firstFail.stderr) + '</pre>';
          } else {
            msg += '<p class="status wa">WA: izlaz ne odgovara očekivanom.</p>';
          }
          msg +=
            '<pre>Očekivano:\\n' +
            escapeHtml(firstFail.expected) +
            '</pre>' +
            '<pre>Dobijeno:\\n' +
            escapeHtml(firstFail.stdout) +
            '</pre>' +
            renderSummary(results);
          verdictEl.innerHTML = msg;
        }
      } else {
        stopAnim();
        if (verdictEl) verdictEl.innerHTML = '<p class="status ac">Accepted (' + adjustedRuntime + ' ms)</p>' + renderSummary(results);
      }
      saveSubmission(verdict, firstFail ? 'WA na testu #' + firstFail.idx : 'Accepted');

      function saveSubmission(code, text) {
        const store = JSON.parse(localStorage.getItem('ca_submissions') || '[]');
        const submission = {
          id: 'S' + Date.now(),
          problemId: problem.id,
          time: Date.now(),
          lang: langCfg.language,
          verdict: code,
          verdictText: text,
          length: (data.source || '').length,
          handle: (currentUser()?.handle || 'guest'),
          source: data.source || '',
        };
        store.unshift(submission);
        localStorage.setItem('ca_submissions', JSON.stringify(store));
        try{
          const lastMap = JSON.parse(localStorage.getItem('ca_last_code') || '{}');
          const existing = lastMap[problem.id];
          const isAc = code === 'AC';
          const existingIsAc = existing?.verdict === 'AC';
          if(isAc || !existingIsAc){
            lastMap[problem.id] = {
              id: submission.id,
              problemId: submission.problemId,
              time: submission.time,
              lang: submission.lang,
              verdict: submission.verdict,
              verdictText: submission.verdictText,
              length: submission.length,
              handle: submission.handle,
              source: submission.source,
            };
            localStorage.setItem('ca_last_code', JSON.stringify(lastMap));
          }
        }catch(err){
          console.warn('Cannot persist last code', err);
        }
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

